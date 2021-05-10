use std::borrow::Cow;
use std::ffi::{OsStr, OsString};
use std::net::Ipv4Addr;
use std::path::PathBuf;

use emver::Version;
use hashlink::LinkedHashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::id::ImageId;
use crate::s9pk::manifest::{PackageId, SYSTEM_PACKAGE_ID};
use crate::util::{Invoke, IpPool};
use crate::volume::{VolumeId, Volumes};
use crate::{Error, ResultExt};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename = "kebab-case")]
pub enum DockerIOFormat {
    Json,
    Yaml,
    Cbor,
    Toml,
}
impl std::fmt::Display for DockerIOFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        use DockerIOFormat::*;
        match self {
            Json => write!(f, "JSON"),
            Yaml => write!(f, "YAML"),
            Cbor => write!(f, "CBOR"),
            Toml => write!(f, "TOML"),
        }
    }
}
impl DockerIOFormat {
    pub fn to_vec<T: Serialize>(&self, value: &T) -> Result<Vec<u8>, Error> {
        match self {
            DockerIOFormat::Json => {
                serde_json::to_vec(value).with_kind(crate::ErrorKind::Serialization)
            }
            DockerIOFormat::Yaml => {
                serde_yaml::to_vec(value).with_kind(crate::ErrorKind::Serialization)
            }
            DockerIOFormat::Cbor => {
                serde_cbor::to_vec(value).with_kind(crate::ErrorKind::Serialization)
            }
            DockerIOFormat::Toml => {
                serde_toml::to_vec(value).with_kind(crate::ErrorKind::Serialization)
            }
        }
    }
    pub fn from_slice<T: for<'de> Deserialize<'de>>(&self, slice: &[u8]) -> Result<T, Error> {
        match self {
            DockerIOFormat::Json => {
                serde_json::from_slice(slice).with_kind(crate::ErrorKind::Deserialization)
            }
            DockerIOFormat::Yaml => {
                serde_yaml::from_slice(slice).with_kind(crate::ErrorKind::Deserialization)
            }
            DockerIOFormat::Cbor => {
                serde_cbor::from_slice(slice).with_kind(crate::ErrorKind::Deserialization)
            }
            DockerIOFormat::Toml => {
                serde_toml::from_slice(slice).with_kind(crate::ErrorKind::Deserialization)
            }
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct DockerAction {
    pub image: ImageId,
    #[serde(default)]
    pub system: bool,
    pub entrypoint: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub mounts: LinkedHashMap<VolumeId, PathBuf>,
    #[serde(default)]
    pub io_format: Option<DockerIOFormat>,
    #[serde(default)]
    pub inject: bool,
    #[serde(default)]
    pub shm_size_mb: Option<usize>, // TODO: use postfix sizing? like 1k vs 1m vs 1g
}
impl DockerAction {
    pub async fn create(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
        ip_pool: &mut IpPool,
    ) -> Result<Ipv4Addr, Error> {
        let ip = ip_pool
            .get()
            .ok_or_else(|| anyhow::anyhow!("No available IP addresses"))
            .with_kind(crate::ErrorKind::Network)?;
        tokio::process::Command::new("docker")
            .arg("create")
            .arg("--net")
            .arg("start9")
            .arg("--ip")
            .arg(format!("{}", ip))
            .arg("--name")
            .arg(Self::container_name(pkg_id, pkg_version))
            .args(self.docker_args(pkg_id, pkg_version, volumes))
            .invoke(crate::ErrorKind::Docker)
            .await?;
        Ok(ip)
    }

    pub async fn execute<I: Serialize, O: for<'de> Deserialize<'de>>(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
        input: Option<I>,
    ) -> Result<Result<O, (i32, String)>, Error> {
        let mut cmd = tokio::process::Command::new("docker");
        if self.inject {
            cmd.arg("exec");
        } else {
            cmd.arg("run").arg("--rm");
        }
        cmd.args(self.docker_args(pkg_id, pkg_version, volumes));
        let input_buf = if let (Some(input), Some(format)) = (&input, &self.io_format) {
            cmd.stdin(std::process::Stdio::piped());
            Some(format.to_vec(input)?)
        } else {
            None
        };
        let mut handle = cmd.spawn().with_kind(crate::ErrorKind::Docker)?;
        if let (Some(input), Some(stdin)) = (&input_buf, &mut handle.stdin) {
            use tokio::io::AsyncWriteExt;
            stdin
                .write_all(input)
                .await
                .with_kind(crate::ErrorKind::Docker)?;
        }
        let res = handle
            .wait_with_output()
            .await
            .with_kind(crate::ErrorKind::Docker)?;
        Ok(if res.status.success() {
            Ok(if let Some(format) = &self.io_format {
                match format.from_slice(&res.stdout) {
                    Ok(a) => a,
                    Err(e) => {
                        log::warn!(
                            "Failed to deserialize stdout from {}: {}, falling back to UTF-8 string.",
                            format,
                            e
                        );
                        serde_json::from_value(String::from_utf8(res.stdout)?.into())
                            .with_kind(crate::ErrorKind::Deserialization)?
                    }
                }
            } else if res.stdout.is_empty() {
                serde_json::from_value(Value::Null).with_kind(crate::ErrorKind::Deserialization)?
            } else {
                serde_json::from_value(String::from_utf8(res.stdout)?.into())
                    .with_kind(crate::ErrorKind::Deserialization)?
            })
        } else {
            Err((
                res.status.code().unwrap_or_default(),
                String::from_utf8(res.stderr)?,
            ))
        })
    }

    pub fn container_name(pkg_id: &PackageId, version: &Version) -> String {
        format!("service_{}_{}", pkg_id, version)
    }

    pub fn uncontainer_name(name: &str) -> Option<&str> {
        name.strip_prefix("service_")
            .and_then(|name| name.split("_").next())
    }

    fn docker_args<'a>(
        &'a self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
    ) -> Vec<Cow<'a, OsStr>> {
        let mut res = Vec::with_capacity(
            (2 * self.mounts.len()) // --mount <MOUNT_ARG>
                + (2 * self.shm_size_mb.is_some() as usize) // --shm-size <SHM_SIZE>
                + 3 // --entrypoint <ENTRYPOINT> <IMAGE>
                + self.args.len(), // [ARG...]
        );
        for (volume_id, dst) in &self.mounts {
            let src = if let Some(path) = volumes.get_path_for(pkg_id, volume_id) {
                path
            } else {
                continue;
            };
            res.push(OsStr::new("--mount").into());
            res.push(
                OsString::from(format!(
                    "type=bind,src={},dst={}",
                    src.display(),
                    dst.display()
                ))
                .into(),
            );
        }
        if let Some(shm_size_mb) = self.shm_size_mb {
            res.push(OsStr::new("--shm-size").into());
            res.push(OsString::from(format!("{}m", shm_size_mb)).into());
        }
        if self.inject {
            res.push(OsString::from(Self::container_name(pkg_id, pkg_version)).into());
            res.push(OsStr::new(&self.entrypoint).into());
        } else {
            res.push(OsStr::new("--entrypoint").into());
            res.push(OsStr::new(&self.entrypoint).into());
            if self.system {
                res.push(OsString::from(self.image.for_package(SYSTEM_PACKAGE_ID, None)).into());
            } else {
                res.push(OsString::from(self.image.for_package(pkg_id, Some(pkg_version))).into());
            }
        }
        res.extend(self.args.iter().map(|s| OsStr::new(s).into()));

        res
    }
}
