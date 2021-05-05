use std::net::Ipv4Addr;
use std::path::Path;

use emver::Version;
use hashlink::{LinkedHashMap, LinkedHashSet};
use patch_db::HasModel;
use serde::{Deserialize, Serialize};

use self::docker::DockerAction;
use crate::apps::DockerStatus;
use crate::config::{Config, ConfigSpec};
use crate::id::Id;
use crate::s9pk::manifest::PackageId;
use crate::util::{IpPool, ValuePrimative};
use crate::volume::Volumes;
use crate::{Error, ResultExt};

pub mod docker;

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

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename = "kebab-case")]
#[serde(tag = "type")]
pub enum ActionImplementation {
    Docker(DockerAction),
}
impl ActionImplementation {
    pub async fn install(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
        ip_pool: &mut IpPool,
    ) -> Result<Ipv4Addr, Error> {
        match self {
            ActionImplementation::Docker(action) => {
                action.create(pkg_id, pkg_version, volumes, ip_pool).await
            }
        }
    }
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
