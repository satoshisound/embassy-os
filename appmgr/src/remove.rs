use std::path::Path;

use linear_map::LinkedHashMap;

use crate::dependencies::{DependencyError, TaggedDependencyError};
use crate::{Error, ResultExt as _};

pub async fn remove(
    name: &str,
    purge: bool,
    dry_run: bool,
) -> Result<LinkedHashMap<String, TaggedDependencyError>, Error> {
    let manifest = crate::apps::manifest(name).await?;
    let mut res = LinkedHashMap::new();
    crate::stop_dependents(name, dry_run, DependencyError::NotInstalled, &mut res).await?;
    if dry_run {
        return Ok(res);
    }
    let image_name = format!("start9/{}", name);
    log::info!("Removing app from manifest.");
    crate::apps::remove(name).await?;
    log::info!("Stopping docker container.");
    let res = crate::control::stop_app(name, false, false)
        .await
        .unwrap_or_else(|e| {
            log::error!("Error stopping app: {}", e);
            LinkedHashMap::new()
        });
    log::info!("Removing docker container.");
    if !std::process::Command::new("docker")
        .args(&["rm", name])
        .stdout(std::process::Stdio::null())
        .stderr(match log::max_level() {
            log::LevelFilter::Error => std::process::Stdio::null(),
            _ => std::process::Stdio::inherit(),
        })
        .status()?
        .success()
    {
        log::error!("Failed to Remove Docker Container");
    };
    if !std::process::Command::new("docker")
        .args(&["rmi", &image_name])
        .stdout(std::process::Stdio::null())
        .stderr(match log::max_level() {
            log::LevelFilter::Error => std::process::Stdio::null(),
            _ => std::process::Stdio::inherit(),
        })
        .status()?
        .success()
    {
        log::error!("Failed to Remove Docker Image");
    };
    if purge {
        log::info!("Removing tor hidden service.");
        crate::tor::rm_svc(name).await?;
        log::info!("Removing app metadata.");
        let metadata_path = Path::new(crate::PERSISTENCE_DIR).join("apps").join(name);
        tokio::fs::remove_dir_all(&metadata_path)
            .await
            .with_ctx(|_| {
                (
                    crate::ErrorKind::Filesystem,
                    format!("rm {}", metadata_path.display()),
                )
            })?;
        log::info!("Unbinding shared filesystem.");
        let installed_apps = crate::apps::list_info().await?;
        for (dep, _) in manifest.dependencies.0.iter() {
            let path = Path::new(crate::VOLUMES)
                .join(name)
                .join("start9")
                .join("public")
                .join(&dep);
            if path.exists() {
                crate::disks::unmount(&path).await?;
            } else {
                log::warn!("{} does not exist, skipping...", path.display());
            }
            let path = Path::new(crate::VOLUMES)
                .join(name)
                .join("start9")
                .join("shared")
                .join(&dep);
            if path.exists() {
                crate::disks::unmount(&path).await?;
            } else {
                log::warn!("{} does not exist, skipping...", path.display());
            }
            if installed_apps.contains_key(dep) {
                let dep_man = crate::apps::manifest(dep).await?;
                if let Some(shared) = dep_man.shared {
                    let path = Path::new(crate::VOLUMES).join(dep).join(&shared).join(name);
                    if path.exists() {
                        tokio::fs::remove_dir_all(&path).await.with_ctx(|_| {
                            (
                                crate::ErrorKind::Filesystem,
                                format!("rm {}", path.display()),
                            )
                        })?;
                    }
                }
            } else {
                log::warn!("{} is not installed, skipping...", dep);
            }
        }
        if manifest.public.is_some() || manifest.shared.is_some() {
            for dependent in crate::apps::dependents(name, false).await? {
                let path = Path::new(crate::VOLUMES)
                    .join(&dependent)
                    .join("start9")
                    .join("public")
                    .join(name);
                if path.exists() {
                    crate::disks::unmount(&path).await?;
                } else {
                    log::warn!("{} does not exist, skipping...", path.display());
                }
                let path = Path::new(crate::VOLUMES)
                    .join(dependent)
                    .join("start9")
                    .join("shared")
                    .join(name);
                if path.exists() {
                    crate::disks::unmount(&path).await?;
                } else {
                    log::warn!("{} does not exist, skipping...", path.display());
                }
            }
        }
        log::info!("Destroying mounted volume.");
        let volume_path = Path::new(crate::VOLUMES).join(name);
        tokio::fs::remove_dir_all(&volume_path)
            .await
            .with_ctx(|_| {
                (
                    crate::ErrorKind::Filesystem,
                    format!("rm {}", volume_path.display()),
                )
            })?;
        log::info!("Pruning unused docker images.");
        crate::ensure_code!(
            std::process::Command::new("docker")
                .args(&["image", "prune", "-a", "-f"])
                .stdout(std::process::Stdio::null())
                .stderr(match log::max_level() {
                    log::LevelFilter::Error => std::process::Stdio::null(),
                    _ => std::process::Stdio::inherit(),
                })
                .status()?
                .success(),
            crate::ErrorKind::Docker,
            "Failed to Prune Docker Images"
        );
    };

    Ok(res)
}
