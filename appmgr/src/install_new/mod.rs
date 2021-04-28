use std::fmt::Display;
use std::io::SeekFrom;
use std::path::Path;
use std::pin::Pin;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use emver::Version;
use futures::TryStreamExt;
use hashlink::LinkedHashMap;
use http::HeaderMap;
use patch_db::json_ptr::JsonPointer;
use patch_db::{
    DbHandle, HasModel, MapModel, Model, ModelData, OptionModel, PatchDbHandle, Revision,
};
use reqwest::Response;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncRead, AsyncSeek, AsyncSeekExt, AsyncWrite, AsyncWriteExt};

use self::progress::{InstallProgress, InstallProgressTracker};
use crate::context::RpcContext;
use crate::db::{PackageDataEntry, VersionedPackageData};
use crate::s9pk::manifest::{Manifest, PackageId};
use crate::s9pk::reader::S9pkReader;
use crate::util::{AsyncFileExt, VersionString};
use crate::Error;

pub mod progress;

pub const PKG_CACHE: &'static str = "/mnt/embassy-os/cache/packages";
pub const PKG_PUBLIC_DIR: &'static str = "/mnt/embassy-os/public/package-data";

pub async fn download_install_s9pk(
    ctx: RpcContext,
    pkg_id: &PackageId,
    version: &VersionString,
    s9pk: Response,
) -> Result<(), Error> {
    let mut db = ctx.db.handle();

    let pkg_cache_dir = Path::new(PKG_CACHE).join(pkg_id).join(version.as_str());
    tokio::fs::create_dir_all(&pkg_cache_dir).await?;
    let pkg_cache = AsRef::<Path>::as_ref(pkg_id).with_extension("s9pk");

    let ver_pkg_data = crate::db::DatabaseModel::new()
        .package_data()
        .idx_model(pkg_id);
    if !ver_pkg_data.exists(&mut db).await? {
        ver_pkg_data
            .put(&mut db, &VersionedPackageData::default())
            .await?;
    }
    let pkg_data_entry = ver_pkg_data
        .check(&mut db)
        .await?
        .ok_or_else(|| {
            Error::new(
                anyhow::anyhow!("VersionedPackageData does not exist"),
                crate::ErrorKind::Database,
            )
        })?
        .idx_model(&version);

    let res = (|| async {
        let progress = InstallProgress::new(s9pk.content_length());

        async fn check_cache(
            pkg_id: &PackageId,
            version: &VersionString,
            pkg_cache: &Path,
            headers: &HeaderMap,
            progress: &Arc<InstallProgress>,
            model: OptionModel<PackageDataEntry>,
            ctx: &RpcContext,
            db: &mut PatchDbHandle,
        ) -> Option<S9pkReader<InstallProgressTracker<File>>> {
            fn warn_ok<T, E: Display>(
                pkg_id: &PackageId,
                version: &VersionString,
                res: Result<T, E>,
            ) -> Option<T> {
                match res {
                    Ok(a) => Some(a),
                    Err(e) => {
                        log::warn!(
                            "Install {}@{}: Could not open cache: {}",
                            pkg_id,
                            version.as_str(),
                            e
                        );
                        None
                    }
                }
            }
            let hash = headers.get("x-s9pk-hash")?;
            let file = warn_ok(pkg_id, version, File::maybe_open(&pkg_cache).await)??;
            let progress_reader = InstallProgressTracker::new(file, progress.clone());
            let rdr = warn_ok(
                pkg_id,
                version,
                progress
                    .track_read_during(model, &ctx.db, db, || {
                        S9pkReader::from_reader(progress_reader)
                    })
                    .await,
            )?;
            if hash.as_bytes() == rdr.hash_str().as_bytes() {
                Some(rdr)
            } else {
                None
            }
        }
        let cached = check_cache(
            pkg_id,
            version,
            &pkg_cache,
            s9pk.headers(),
            &progress,
            pkg_data_entry.clone(),
            &ctx,
            &mut db,
        )
        .await;

        let mut s9pk_reader = if let Some(cached) = cached {
            cached
        } else {
            File::delete(&pkg_cache).await?;
            let mut dst = OpenOptions::new()
                .create(true)
                .write(true)
                .read(true)
                .open(&pkg_cache)
                .await?;

            progress
                .track_download_during(pkg_data_entry.clone(), &ctx.db, &mut db, || async {
                    let mut progress_writer =
                        InstallProgressTracker::new(&mut dst, progress.clone());
                    tokio::io::copy(
                        &mut tokio_util::io::StreamReader::new(s9pk.bytes_stream().map_err(|e| {
                            std::io::Error::new(
                                if e.is_connect() {
                                    std::io::ErrorKind::ConnectionRefused
                                } else if e.is_timeout() {
                                    std::io::ErrorKind::TimedOut
                                } else {
                                    std::io::ErrorKind::Other
                                },
                                e,
                            )
                        })),
                        &mut progress_writer,
                    )
                    .await?;
                    progress.download_complete();
                    Ok(())
                })
                .await?;

            dst.seek(SeekFrom::Start(0)).await?;

            let progress_reader = InstallProgressTracker::new(dst, progress.clone());
            let rdr = progress
                .track_read_during(pkg_data_entry.clone(), &ctx.db, &mut db, || {
                    S9pkReader::from_reader(progress_reader)
                })
                .await?;
            rdr
        };
        install_s9pk(&ctx, &mut db, pkg_id, version, &mut s9pk_reader, progress).await?;

        Ok(())
    })()
    .await;

    if let Err(e) = res {
        pkg_data_entry
            .put(&mut db, &PackageDataEntry::InstallFailed)
            .await?;
        Err(e)
    } else {
        Ok(())
    }
}

pub async fn install_s9pk<R: AsyncRead + AsyncSeek + Unpin>(
    ctx: &RpcContext,
    db: &mut PatchDbHandle,
    pkg_id: &PackageId,
    version_string: &VersionString,
    rdr: &mut S9pkReader<InstallProgressTracker<R>>,
    progress: Arc<InstallProgress>,
) -> Result<(), Error> {
    rdr.validate().await?;
    rdr.validated();
    let option_model = crate::db::DatabaseModel::new()
        .package_data()
        .idx_model(pkg_id)
        .check(db)
        .await?
        .ok_or_else(|| {
            Error::new(
                anyhow::anyhow!("VersionedPackageData does not exist"),
                crate::ErrorKind::Database,
            )
        })?
        .idx_model(&version_string);
    let model = option_model.clone().check(db).await?.ok_or_else(|| {
        Error::new(
            anyhow::anyhow!("PackageDataEntry does not exist"),
            crate::ErrorKind::Database,
        )
    })?;

    log::info!(
        "Install {}@{}: Unpacking Manifest",
        pkg_id,
        version_string.as_str()
    );
    let manifest = progress
        .track_read_during(option_model.clone(), &ctx.db, db, || rdr.manifest())
        .await?;
    log::info!(
        "Install {}@{}: Unpacked Manifest",
        pkg_id,
        version_string.as_str()
    );

    let public_dir_path = Path::new(PKG_PUBLIC_DIR)
        .join(pkg_id)
        .join(version_string.as_str());
    tokio::fs::create_dir_all(&public_dir_path).await?;

    log::info!(
        "Install {}@{}: Unpacking LICENSE.md",
        pkg_id,
        version_string.as_str()
    );
    progress
        .track_read_during(option_model.clone(), &ctx.db, db, || async {
            let license_path = public_dir_path.join("LICENSE.md");
            let mut dst = File::create(&license_path).await?;
            tokio::io::copy(&mut rdr.license().await?, &mut dst).await?;
            dst.sync_all().await?;
            Ok(())
        })
        .await?;
    log::info!(
        "Install {}@{}: Unpacked LICENSE.md",
        pkg_id,
        version_string.as_str()
    );

    let icon_path = Path::new("icon").with_extension(&manifest.assets.icon_type());
    log::info!(
        "Install {}@{}: Unpacking {}",
        pkg_id,
        version_string.as_str(),
        icon_path.display()
    );
    progress
        .track_read_during(option_model.clone(), &ctx.db, db, || async {
            let icon_path = public_dir_path.join(&icon_path);
            let mut dst = File::create(&icon_path).await?;
            tokio::io::copy(&mut rdr.icon().await?, &mut dst).await?;
            dst.sync_all().await?;
            Ok(())
        })
        .await?;
    log::info!(
        "Install {}@{}: Unpacked {}",
        pkg_id,
        version_string.as_str(),
        icon_path.display()
    );

    log::info!(
        "Install {}@{}: Unpacking Docker Images",
        pkg_id,
        version_string.as_str(),
    );
    progress
        .track_read_during(option_model.clone(), &ctx.db, db, || async {
            let mut load = tokio::process::Command::new("docker")
                .arg("load")
                .stdin(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()?;
            let mut dst = load.stdin.take().ok_or_else(|| {
                Error::new(
                    anyhow::anyhow!("Could not write to stdin of docker load"),
                    crate::ErrorKind::Docker,
                )
            })?;
            tokio::io::copy(&mut rdr.docker_images().await?, &mut dst).await?;
            dst.flush().await?;
            dst.shutdown().await?;
            drop(dst);
            let res = load.wait_with_output().await?;
            if !res.status.success() {
                Err(Error::new(
                    anyhow::anyhow!(
                        "{}",
                        String::from_utf8(res.stderr)
                            .unwrap_or_else(|e| format!("Could not parse stderr: {}", e))
                    ),
                    crate::ErrorKind::Docker,
                ))
            } else {
                Ok(())
            }
        })
        .await?;
    log::info!(
        "Install {}@{}: Unpacked Docker Images",
        pkg_id,
        version_string.as_str(),
    );

    if let Some(mut instructions_rdr) = rdr.instructions().await? {
        log::info!(
            "Install {}@{}: Unpacking INSTRUCTIONS.md",
            pkg_id,
            version_string.as_str()
        );
        progress
            .track_read_during(option_model.clone(), &ctx.db, db, || async {
                let instructions_path = public_dir_path.join("INSTRUCTIONS.md");
                let mut dst = File::create(&instructions_path).await?;
                tokio::io::copy(&mut instructions_rdr, &mut dst).await?;
                dst.sync_all().await?;
                Ok(())
            })
            .await?;
        log::info!(
            "Install {}@{}: Unpacked INSTRUCTIONS.md",
            pkg_id,
            version_string.as_str()
        );
    }

    todo!("Create container, setup interfaces");

    Ok(())
}
