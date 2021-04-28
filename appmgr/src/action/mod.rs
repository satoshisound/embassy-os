use std::borrow::Cow;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

use emver::Version;
use hashlink::{LinkedHashMap, LinkedHashSet};
use patch_db::HasModel;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::apps::DockerStatus;
use crate::config::{Config, ConfigSpec};
use crate::id::{Id, ImageId};
use crate::s9pk::manifest::{PackageId, SYSTEM_PACKAGE_ID};
use crate::util::{Invoke, IpPool, ValuePrimative};
use crate::volume::{VolumeId, Volumes};
use crate::{Error, ResultExt};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize)]
pub struct ActionId<S: AsRef<str> = String>(Id<S>);
impl<S: AsRef<str>> AsRef<ActionId<S>> for ActionId<S> {
    fn as_ref(&self) -> &ActionId<S> {
        self
    }
}
impl<S: AsRef<str>> std::fmt::Display for ActionId<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", &self.0)
    }
}
impl<S: AsRef<str>> AsRef<str> for ActionId<S> {
    fn as_ref(&self) -> &str {
        self.0.as_ref()
    }
}
impl<S: AsRef<str>> AsRef<Path> for ActionId<S> {
    fn as_ref(&self) -> &Path {
        self.0.as_ref().as_ref()
    }
}
impl<'de, S> Deserialize<'de> for ActionId<S>
where
    S: AsRef<str>,
    Id<S>: Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        Ok(ActionId(Deserialize::deserialize(deserializer)?))
    }
}

pub struct Actions(pub LinkedHashMap<ActionId, Action>);

#[derive(Debug, Deserialize)]
#[serde(tag = "version")]
pub enum ActionResult {
    #[serde(rename = "0")]
    V0(ActionResultV0),
}

#[derive(Debug, Deserialize)]
pub struct ActionResultV0 {
    pub message: String,
    pub value: ValuePrimative,
    pub copyable: bool,
    pub qr: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Action {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub warning: Option<String>,
    pub implementation: ActionImplementation,
    pub allowed_statuses: LinkedHashSet<DockerStatus>,
    #[serde(default)]
    pub input_spec: ConfigSpec,
}
impl Action {
    pub async fn execute(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
        input: Config,
    ) -> Result<Result<ActionResult, String>, Error> {
        self.input_spec
            .matches(&input)
            .with_kind(crate::ErrorKind::ConfigSpecViolation)?;
        self.implementation
            .execute(pkg_id, pkg_version, volumes, Some(input))
            .await
            .map(|e| e.map_err(|e| e.1))
    }
}

pub trait PresetActionImpl: Sized {
    fn implementation(&self) -> &'static ActionImplementation;
}

pub enum ActionImplOrPreset<P: PresetActionImpl> {
    Custom(ActionImplementation),
    Preset(P),
}
impl<P: PresetActionImpl> std::ops::Deref for ActionImplOrPreset<P> {
    type Target = ActionImplementation;
    fn deref(&self) -> &Self::Target {
        match self {
            ActionImplOrPreset::Custom(a) => a,
            ActionImplOrPreset::Preset(p) => p.implementation(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename = "kebab-case")]
#[serde(tag = "type")]
pub enum ActionImplementation {
    Docker(DockerAction),
}
impl ActionImplementation {
    pub async fn execute<I: Serialize, O: for<'de> Deserialize<'de>>(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
        input: Option<I>,
    ) -> Result<Result<O, (i32, String)>, Error> {
        match self {
            ActionImplementation::Docker(action) => {
                action.execute(pkg_id, pkg_version, volumes, input).await
            }
        }
    }
}

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
    ) -> Result<(), Error> {
        tokio::process::Command::new("docker")
            .arg("create")
            .arg("--net")
            .arg("start9")
            .arg("--ip")
            .arg(format!(
                "{}",
                ip_pool
                    .get()
                    .ok_or_else(|| anyhow::anyhow!("No available IP addresses"))
                    .with_kind(crate::ErrorKind::Network)?,
            ))
            .arg("--name")
            .arg(self.container_name(pkg_id))
            .args(self.docker_args(pkg_id, pkg_version, volumes))
            .invoke(crate::ErrorKind::Docker)
            .await?;
        Ok(())
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

    fn container_name(&self, pkg_id: &PackageId) -> String {
        format!("{}_{}", pkg_id, self.image)
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
            res.push(OsString::from(self.container_name(pkg_id)).into());
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
