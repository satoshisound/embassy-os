use std::net::Ipv4Addr;
use std::sync::Arc;

use indexmap::{IndexMap, IndexSet};
use patch_db::json_ptr::JsonPointer;
use patch_db::{DbHandle, HasModel, Map, MapModel, Model, ModelData, OptionModel};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config::action::ConfigRes;
use crate::config::spec::{PackagePointerSpecVariant, SystemPointerSpec, ValueSpecPointer};
use crate::id::InterfaceId;
use crate::install::progress::InstallProgress;
use crate::net::Network;
use crate::s9pk::manifest::{Manifest, PackageId};
use crate::status::health_check::HealthCheckId;
use crate::status::Status;
use crate::util::Version;
use crate::Error;

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct Database {
    #[model]
    pub server_info: ServerInfo,
    #[model]
    pub package_data: AllPackageData,
    pub broken_packages: Vec<PackageId>,
    #[model]
    pub network: Network,
    pub ui: Value,
}
impl DatabaseModel {
    pub fn new() -> Self {
        Self::from(JsonPointer::default())
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct ServerInfo {
    id: String,
    version: Version,
    lan_address: Url,
    tor_address: Url,
    updating: bool,
    registry: Url,
    unread_notification_count: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AllPackageData(pub IndexMap<PackageId, PackageDataEntry>);
impl Map for AllPackageData {
    type Key = PackageId;
    type Value = PackageDataEntry;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(key)
    }
}
impl HasModel for AllPackageData {
    type Model = MapModel<Self>;
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct StaticFiles {
    license: Url,
    instructions: Url,
    icon: Url,
}
impl StaticFiles {
    pub fn local(id: &PackageId, version: &Version, icon_type: &str) -> Result<Self, Error> {
        Ok(StaticFiles {
            license: format!(
                "/public/package-data/{}/{}/LICENSE.md",
                id,
                version.as_str()
            )
            .parse()?,
            instructions: format!(
                "/public/package-data/{}/{}/INSTRUCTIONS.md",
                id,
                version.as_str()
            )
            .parse()?,
            icon: format!(
                "/public/package-data/{}/{}/icon.{}",
                id,
                version.as_str(),
                icon_type
            )
            .parse()?,
        })
    }
    pub fn remote(id: &PackageId, version: &Version, icon_type: &str) -> Result<Self, Error> {
        Ok(StaticFiles {
            license: format!("/registry/packages/{}/{}/LICENSE.md", id, version.as_str())
                .parse()?,
            instructions: format!(
                "/registry/packages/{}/{}/INSTRUCTIONS.md",
                id,
                version.as_str()
            )
            .parse()?,
            icon: format!(
                "/registry/packages/{}/{}/icon.{}",
                id,
                version.as_str(),
                icon_type
            )
            .parse()?,
        })
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(tag = "state")]
#[serde(rename_all = "kebab-case")]
pub enum PackageDataEntry {
    #[serde(rename_all = "kebab-case")]
    Installing {
        static_files: StaticFiles,
        unverified_manifest: Manifest,
        install_progress: Arc<InstallProgress>,
    }, // { state: "installing", 'install-progress': InstallProgress }
    #[serde(rename_all = "kebab-case")]
    Updating {
        static_files: StaticFiles,
        installed: InstalledPackageDataEntry,
        install_progress: Arc<InstallProgress>,
    },
    #[serde(rename_all = "kebab-case")]
    Removing {
        static_files: StaticFiles,
        installed: InstalledPackageDataEntry,
    },
    #[serde(rename_all = "kebab-case")]
    Installed {
        static_files: StaticFiles,
        installed: InstalledPackageDataEntry,
    },
}
impl PackageDataEntryModel {
    pub fn installed(self) -> OptionModel<InstalledPackageDataEntry> {
        self.0.child("installed").into()
    }
    pub fn install_progress(self) -> OptionModel<InstallProgress> {
        self.0.child("install-progress").into()
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct InstalledPackageDataEntry {
    #[model]
    pub manifest: Manifest,
    #[model]
    pub status: Status,
    pub system_pointers: Vec<SystemPointerSpec>,
    pub dependents: IndexMap<PackageId, Vec<PackagePointerSpecVariant>>,
    pub required_dependencies: IndexMap<PackageId, IndexSet<HealthCheckId>>,
    #[model]
    pub interface_info: InterfaceInfo,
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct InterfaceInfo {
    pub ip: Ipv4Addr,
    #[model]
    pub addresses: InterfaceAddressMap,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct InterfaceAddressMap(pub IndexMap<InterfaceId, InterfaceAddresses>);
impl Map for InterfaceAddressMap {
    type Key = InterfaceId;
    type Value = InterfaceAddresses;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(key)
    }
}
impl HasModel for InterfaceAddressMap {
    type Model = MapModel<Self>;
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct InterfaceAddresses {
    pub tor_address: Option<String>,
    pub lan_address: Option<String>,
}
