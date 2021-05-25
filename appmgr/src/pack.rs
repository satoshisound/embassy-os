use std::borrow::Cow;
use std::path::{Path, PathBuf};

use futures::stream::StreamExt;
use linear_map::IndexMap;
use rand::SeedableRng;
use tokio_tar as tar;

use crate::config::{ConfigRuleEntry, ConfigSpec};
use crate::manifest::{ImageConfig, Manifest};
use crate::util::{from_cbor_async_reader, from_json_async_reader, from_yaml_async_reader};
use crate::version::VersionT;
use crate::ResultExt;

#[derive(Clone, Debug, thiserror::Error)]
pub enum Error {
    #[error("Invalid Directory Name: {0}")]
    InvalidDirectoryName(String),
    #[error("Invalid File Name: {0}")]
    InvalidFileName(String),
    #[error("Invalid Output Path: {0}")]
    InvalidOutputPath(String),
}
impl From<Error> for crate::Error {
    fn from(err: Error) -> Self {
        crate::Error::new(err, crate::ErrorKind::Pack)
    }
}

pub async fn pack(path: &str, output: &str) -> Result<(), crate::Error> {
    let path = Path::new(path.trim_end_matches("/"));
    let output = Path::new(output);
    log::info!(
        "Starting pack of {} to {}.",
        path.file_name()
            .and_then(|a| a.to_str())
            .ok_or_else(|| Error::InvalidDirectoryName(format!("{}", path.display())))?,
        output.display(),
    );
    let out_file = tokio::fs::File::create(output).await?;
    let mut out = tar::Builder::new(out_file);
    log::info!("Reading {}/manifest.yaml.", path.display());
    let manifest: Manifest = crate::util::from_yaml_async_reader(
        tokio::fs::File::open(path.join("manifest.yaml"))
            .await
            .with_ctx(|_| (crate::ErrorKind::Filesystem, "manifest.yaml"))?,
    )
    .await?;
    log::info!("Writing manifest to archive.");
    let bin_manifest = serde_cbor::to_vec(&manifest).with_kind(crate::ErrorKind::Serialization)?;
    let mut manifest_header = tar::Header::new_gnu();
    manifest_header.set_size(bin_manifest.len() as u64);
    out.append_data(
        &mut manifest_header,
        "manifest.cbor",
        std::io::Cursor::new(bin_manifest),
    )
    .await?;
    let manifest = manifest.into_latest()?;
    crate::ensure_code!(
        crate::version::Current::new()
            .semver()
            .satisfies(&manifest.os_version_required),
        crate::ErrorKind::VersionIncompatible,
        "Unsupported AppMgr version: expected {}",
        manifest.os_version_required
    );
    log::info!("Reading {}/config_spec.yaml.", path.display());
    let config_spec: ConfigSpec = from_yaml_async_reader(
        tokio::fs::File::open(path.join("config_spec.yaml"))
            .await
            .with_ctx(|_| (crate::ErrorKind::Filesystem, "config_spec.yaml"))?,
    )
    .await?;
    log::info!("Writing config spec to archive.");
    let bin_config_spec =
        serde_cbor::to_vec(&config_spec).with_kind(crate::ErrorKind::Serialization)?;
    let mut config_spec_header = tar::Header::new_gnu();
    config_spec_header.set_size(bin_config_spec.len() as u64);
    out.append_data(
        &mut config_spec_header,
        "config_spec.cbor",
        std::io::Cursor::new(bin_config_spec),
    )
    .await?;
    log::info!("Reading {}/config_rules.yaml.", path.display());
    let config_rules: Vec<ConfigRuleEntry> = from_yaml_async_reader(
        tokio::fs::File::open(path.join("config_rules.yaml"))
            .await
            .with_ctx(|_| (crate::ErrorKind::Filesystem, "config_rules.yaml"))?,
    )
    .await?;
    log::info!("Writing config rules to archive.");
    let bin_config_rules =
        serde_cbor::to_vec(&config_rules).with_kind(crate::ErrorKind::Serialization)?;
    let mut config_rules_header = tar::Header::new_gnu();
    config_rules_header.set_size(bin_config_rules.len() as u64);
    out.append_data(
        &mut config_rules_header,
        "config_rules.cbor",
        std::io::Cursor::new(bin_config_rules),
    )
    .await?;
    if manifest.has_instructions {
        log::info!("Packing instructions.md");
        out.append_path_with_name(path.join("instructions.md"), "instructions.md")
            .await?;
    }
    log::info!("Copying over assets.");
    for asset in &manifest.assets {
        let src_path = Path::new("assets").join(&asset.src);
        log::info!("Reading {}/{}.", path.display(), src_path.display());
        let file_path = path.join(&src_path);
        let src = tokio::fs::File::open(&file_path).await.with_ctx(|_| {
            (
                crate::ErrorKind::Filesystem,
                file_path.display().to_string(),
            )
        })?;
        log::info!("Writing {} to archive.", src_path.display());
        if src.metadata().await?.is_dir() {
            out.append_dir_all(&asset.src, &file_path).await?;
            let mut h = tar::Header::new_gnu();
            h.set_size(0);
            h.set_path(format!("APPMGR_DIR_END:{}", asset.src.display()))?;
            h.set_cksum();
            out.append(&h, tokio::io::empty()).await?;
        } else {
            out.append_path_with_name(&file_path, &asset.src).await?;
        }
    }
    match manifest.image {
        ImageConfig::Tar => {
            log::info!("Reading {}/image.tar.", path.display());
            let image = tokio::fs::File::open(path.join("image.tar"))
                .await
                .with_ctx(|_| (crate::ErrorKind::Filesystem, "image.tar"))?;
            log::info!("Writing image.tar to archive.");
            let mut header = tar::Header::new_gnu();
            header.set_size(image.metadata().await?.len());
            out.append_data(&mut header, "image.tar", image).await?;
        }
    }
    out.into_inner().await?;

    Ok(())
}

pub fn validate_path<P: AsRef<Path>>(p: P) -> Result<(), Error> {
    let path = p.as_ref();
    if path.is_absolute() {
        return Err(Error::InvalidFileName(format!("{}", path.display())));
    }
    for seg in path {
        if seg == ".." {
            return Err(Error::InvalidFileName(format!("{}", path.display())));
        }
    }
    Ok(())
}

pub async fn verify(path: &str) -> Result<(), crate::Error> {
    let path = Path::new(path.trim_end_matches("/"));
    crate::ensure_code!(
        path.extension()
            .and_then(|a| a.to_str())
            .ok_or_else(|| Error::InvalidFileName(format!("{}", path.display())))?
            == "s9pk",
        crate::ErrorKind::ValidateS9pk,
        "Extension Must Be '.s9pk'"
    );
    let name = path
        .file_stem()
        .and_then(|a| a.to_str())
        .ok_or_else(|| Error::InvalidFileName(format!("{}", path.display())))?;
    crate::ensure_code!(
        !name.starts_with("start9")
            && name
                .chars()
                .filter(|c| !c.is_alphanumeric() && c != &'-')
                .next()
                .is_none(),
        crate::ErrorKind::ValidateS9pk,
        "Invalid Application ID"
    );
    log::info!(
        "Starting verification of {}.",
        path.file_name()
            .and_then(|a| a.to_str())
            .ok_or_else(|| Error::InvalidFileName(format!("{}", path.display())))?,
    );
    {}
    log::info!("Opening file.");
    let r = tokio::fs::File::open(&path)
        .await
        .with_ctx(|_| (crate::ErrorKind::Filesystem, path.display().to_string()))?;
    log::info!("Extracting archive.");
    let mut pkg = tar::Archive::new(r);
    let mut entries = pkg.entries()?;
    log::info!("Opening manifest from archive.");
    let manifest = entries
        .next()
        .await
        .ok_or_else(|| crate::install::Error::CorruptedPkgFile("missing manifest"))??;
    crate::ensure_code!(
        manifest.path()?.to_str() == Some("manifest.cbor"),
        crate::ErrorKind::ValidateS9pk,
        "Package File Invalid or Corrupted: expected manifest.cbor, got {}",
        manifest.path()?.display()
    );
    log::trace!("Deserializing manifest.");
    let manifest: Manifest = from_cbor_async_reader(manifest).await?;
    let manifest = manifest.into_latest()?;
    crate::ensure_code!(
        crate::version::Current::new()
            .semver()
            .satisfies(&manifest.os_version_required),
        crate::ErrorKind::ValidateS9pk,
        "Unsupported AppMgr Version: expected {}",
        manifest.os_version_required
    );
    crate::ensure_code!(
        manifest.id == name,
        crate::ErrorKind::ValidateS9pk,
        "Package Name Does Not Match Expected"
    );
    if let (Some(public), Some(shared)) = (&manifest.public, &manifest.shared) {
        crate::ensure_code!(
            !public.starts_with(shared) && !shared.starts_with(public),
            crate::ErrorKind::ValidateS9pk,
            "Public Directory Conflicts With Shared Directory"
        )
    }
    if let Some(public) = &manifest.public {
        validate_path(public)?;
    }
    if let Some(shared) = &manifest.shared {
        validate_path(shared)?;
    }
    for action in &manifest.actions {
        crate::ensure_code!(
            !action.command.is_empty(),
            crate::ErrorKind::ValidateS9pk,
            "Command Cannot Be Empty: {}",
            action.id
        );
    }
    log::info!("Opening config spec from archive.");
    let config_spec = entries
        .next()
        .await
        .ok_or_else(|| crate::install::Error::CorruptedPkgFile("missing config spec"))??;
    crate::ensure_code!(
        config_spec.path()?.to_str() == Some("config_spec.cbor"),
        crate::ErrorKind::ValidateS9pk,
        "Package File Invalid or Corrupted: expected config_rules.cbor, got {}",
        config_spec.path()?.display()
    );
    log::trace!("Deserializing config spec.");
    let config_spec: ConfigSpec = from_cbor_async_reader(config_spec).await?;
    log::trace!("Validating config spec.");
    config_spec
        .validate(&manifest)
        .with_kind(crate::ErrorKind::ValidateS9pk)?;
    let config = config_spec.gen(&mut rand::rngs::StdRng::from_entropy(), &None)?;
    config_spec
        .matches(&config)
        .with_kind(crate::ErrorKind::ValidateS9pk)?;
    log::info!("Opening config rules from archive.");
    let config_rules = entries
        .next()
        .await
        .ok_or_else(|| crate::install::Error::CorruptedPkgFile("missing config rules"))??;
    crate::ensure_code!(
        config_rules.path()?.to_str() == Some("config_rules.cbor"),
        crate::ErrorKind::ValidateS9pk,
        "Package File Invalid or Corrupted: expected config_rules.cbor, got {}",
        config_rules.path()?.display()
    );
    log::trace!("Deserializing config rules.");
    let config_rules: Vec<ConfigRuleEntry> = from_cbor_async_reader(config_rules).await?;
    log::trace!("Validating config rules against config spec.");
    let mut cfgs = IndexMap::new();
    cfgs.insert(name, Cow::Borrowed(&config));
    for rule in &config_rules {
        rule.check(&config, &cfgs).with_ctx(|_| {
            (
                crate::ErrorKind::ValidateS9pk,
                "Default config does not satisfy rule",
            )
        })?;
    }
    if manifest.has_instructions {
        let instructions = entries
            .next()
            .await
            .ok_or_else(|| crate::install::Error::CorruptedPkgFile("missing instructions"))??;
        crate::ensure_code!(
            instructions.path()?.to_str() == Some("instructions.md"),
            crate::ErrorKind::ValidateS9pk,
            "Package File Invalid or Corrupted: expected instructions.md, got {}",
            instructions.path()?.display()
        );
    }
    match &manifest.image {
        ImageConfig::Tar => {
            #[derive(Clone, Debug, serde::Deserialize)]
            #[serde(rename_all = "PascalCase")]
            struct DockerManifest {
                config: PathBuf,
                repo_tags: Vec<String>,
                layers: Vec<PathBuf>,
            }
            let image_name = format!("start9/{}", manifest.id);
            log::debug!("Opening image.tar from archive.");
            let image = entries
                .next()
                .await
                .ok_or_else(|| crate::install::Error::CorruptedPkgFile("missing image.tar"))??;
            let image_path = image.path()?;
            if image_path != Path::new("image.tar") {
                return Err(crate::Error::new(
                    anyhow::anyhow!(
                        "Package File Invalid or Corrupted: expected image.tar, got {}",
                        image_path.display()
                    ),
                    crate::ErrorKind::ValidateS9pk,
                ));
            }
            log::info!("Verifying image.tar.");
            let mut image_tar = tar::Archive::new(image);
            let image_manifest = image_tar
                .entries()?
                .map(|e| {
                    let e = e?;
                    Ok((e.path()?.to_path_buf(), e))
                })
                .filter_map(|res: Result<(PathBuf, tar::Entry<_>), std::io::Error>| {
                    futures::future::ready(match res {
                        Ok((path, e)) => {
                            if path == Path::new("manifest.json") {
                                Some(Ok(e))
                            } else {
                                None
                            }
                        }
                        Err(e) => Some(Err(e)),
                    })
                })
                .next()
                .await
                .ok_or_else(|| {
                    crate::install::Error::CorruptedPkgFile("image.tar is missing manifest.json")
                })??;
            let image_manifest: Vec<DockerManifest> =
                from_json_async_reader(image_manifest).await?;
            image_manifest
                .into_iter()
                .flat_map(|a| a.repo_tags)
                .map(|t| {
                    if t.starts_with("start9/") {
                        if t.split(":").next().unwrap() != image_name {
                            Err(crate::Error::new(
                                anyhow::anyhow!("Contains prohibited image tag: {}", t),
                                crate::ErrorKind::ValidateS9pk,
                            ))
                        } else {
                            Ok(())
                        }
                    } else {
                        Ok(())
                    }
                })
                .collect::<Result<_, _>>()?;
        }
    };

    Ok(())
}
