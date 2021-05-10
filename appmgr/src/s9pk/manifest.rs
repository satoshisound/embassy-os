use std::borrow::Borrow;
use std::net::Ipv4Addr;
use std::path::{Path, PathBuf};

use hashlink::LinkedHashMap;
use patch_db::HasModel;
use serde::{Deserialize, Serialize, Serializer};
use url::Url;

use crate::action::ActionImplementation;
use crate::backup_new::BackupActions;
use crate::config::action::ConfigActions;
use crate::dependencies::Dependencies;
use crate::id::{Id, InterfaceId, SYSTEM_ID};
use crate::migration::Migrations;
use crate::status::health_check::{HealthCheck, HealthCheckResult};
use crate::tor::HiddenServiceVersion;
use crate::util::Version;
use crate::volume::Volumes;
use crate::Error;

pub const SYSTEM_PACKAGE_ID: PackageId<&'static str> = PackageId(SYSTEM_ID);

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct PackageId<S: AsRef<str> = String>(Id<S>);
impl<S: AsRef<str>> AsRef<PackageId<S>> for PackageId<S> {
    fn as_ref(&self) -> &PackageId<S> {
        self
    }
}
impl<S: AsRef<str>> std::fmt::Display for PackageId<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", &self.0)
    }
}
impl<S: AsRef<str>> AsRef<str> for PackageId<S> {
    fn as_ref(&self) -> &str {
        self.0.as_ref()
    }
}
impl<S: AsRef<str>> Borrow<str> for PackageId<S> {
    fn borrow(&self) -> &str {
        self.0.as_ref()
    }
}
impl<S: AsRef<str>> AsRef<Path> for PackageId<S> {
    fn as_ref(&self) -> &Path {
        self.0.as_ref().as_ref()
    }
}
impl<'de, S> Deserialize<'de> for PackageId<S>
where
    S: AsRef<str>,
    Id<S>: Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        Ok(PackageId(Deserialize::deserialize(deserializer)?))
    }
}
impl<S> Serialize for PackageId<S>
where
    S: AsRef<str>,
{
    fn serialize<Ser>(&self, serializer: Ser) -> Result<Ser::Ok, Ser::Error>
    where
        Ser: Serializer,
    {
        Serialize::serialize(&self.0, serializer)
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct Manifest {
    pub id: PackageId,
    pub title: String,
    pub version: Version,
    pub description: Description,
    #[serde(default)]
    pub assets: Assets,
    #[serde(default)]
    pub build: Option<Vec<String>>,
    pub release_notes: String,
    pub license: String, // type of license
    pub wrapper_repo: Url,
    pub upstream_repo: Url,
    pub support_site: Option<Url>,
    pub marketing_site: Option<Url>,
    #[serde(default)]
    pub alerts: Alerts,
    #[model]
    pub main: ActionImplementation,
    pub health_check: HealthCheck,
    #[model]
    pub config: Option<ConfigActions>,
    #[model]
    pub volumes: Volumes,
    // #[serde(default = "current_version")]
    pub min_os_version: Version,
    // #[serde(default)]
    pub interfaces: Interfaces,
    // #[serde(default)]
    #[model]
    pub backup: BackupActions,
    #[serde(default)]
    #[model]
    pub migrations: Migrations,
    // #[serde(default)]
    pub actions: Actions,
    // #[serde(default)]
    pub permissions: Permissions,
    // #[serde(default)]
    pub dependencies: Dependencies,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Interfaces(LinkedHashMap<InterfaceId, Interface>); // TODO
impl Interfaces {
    pub async fn install(&self, ip: &Ipv4Addr) -> Result<(), Error> {
        todo!()
    }
    pub async fn check_all(
        &self,
        pkg_id: &PackageId,
        version: &Version,
        volumes: &Volumes,
    ) -> Result<LinkedHashMap<InterfaceId, HealthCheckResult>, Error> {
        todo!()
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Interface {
    tor_config: Option<TorConfig>,
    lan_config: Option<LinkedHashMap<u16, LanPortConfig>>,
    ui: bool,
    protocols: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct TorConfig {
    #[serde(default)]
    hidden_service_version: HiddenServiceVersion,
    port_mapping: LinkedHashMap<u16, u16>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct LanPortConfig {
    ssl: bool,
    mapping: u16,
}

#[derive(Debug, Deserialize, Serialize)]
pub enum Actions {} // TODO
#[derive(Debug, Deserialize, Serialize)]
pub enum Permissions {} // TODO

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Assets {
    #[serde(default)]
    license: Option<PathBuf>,
    #[serde(default)]
    icon: Option<PathBuf>,
    #[serde(default)]
    docker_images: Option<PathBuf>,
    #[serde(default)]
    instructions: Option<PathBuf>,
}
impl Assets {
    pub fn license_path(&self) -> &Path {
        self.license
            .as_ref()
            .map(|a| a.as_path())
            .unwrap_or(Path::new("LICENSE.md"))
    }
    pub fn icon_path(&self) -> &Path {
        self.icon
            .as_ref()
            .map(|a| a.as_path())
            .unwrap_or(Path::new("icon.png"))
    }
    pub fn icon_type(&self) -> &str {
        self.icon
            .as_ref()
            .and_then(|icon| icon.extension())
            .and_then(|ext| ext.to_str())
            .unwrap_or("png")
    }
    pub fn docker_images_path(&self) -> &Path {
        self.docker_images
            .as_ref()
            .map(|a| a.as_path())
            .unwrap_or(Path::new("images.tar"))
    }
    pub fn instructions_path(&self) -> &Path {
        self.instructions
            .as_ref()
            .map(|a| a.as_path())
            .unwrap_or(Path::new("INSTRUCTIONS.md"))
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Description {
    pub short: String,
    pub long: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Alerts {
    pub install: Option<String>,
    pub uninstall: Option<String>,
    pub restore: Option<String>,
    pub start: Option<String>,
    pub stop: Option<String>,
}
