use std::net::Ipv4Addr;
use std::sync::Arc;

use hashlink::LinkedHashMap;
use patch_db::json_ptr::JsonPointer;
use patch_db::{DbHandle, HasModel, Map, MapModel, Model, ModelData, OptionModel};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::id::InterfaceId;
use crate::install_new::progress::InstallProgress;
use crate::s9pk::manifest::{Manifest, PackageId};
use crate::status::Status;
use crate::util::{IpPool, Version};
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
    pub resources: Resources,
    pub ui: Value,
    pub agent: Value,
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

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct Resources {
    ip_pool: IpPool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AllPackageData(pub LinkedHashMap<PackageId, PackageDataEntry>);
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

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(tag = "state")]
#[serde(rename_all = "kebab-case")]
pub enum PackageDataEntry {
    #[serde(rename_all = "kebab-case")]
    Installing {
        install_progress: Arc<InstallProgress>,
    }, // { state: "installing", 'install-progress': InstallProgress }
    #[serde(rename_all = "kebab-case")]
    Updating {
        installed: InstalledPackageDataEntry,
        install_progress: Arc<InstallProgress>,
    },
    #[serde(rename_all = "kebab-case")]
    Removing {
        installed: InstalledPackageDataEntry,
    },
    #[serde(rename_all = "kebab-case")]
    Installed {
        installed: InstalledPackageDataEntry,
    },
}
impl PackageDataEntryModel {
    pub fn installed(self) -> OptionModel<InstalledPackageDataEntry> {
        self.0.child("installed").into()
    }
    pub fn install_progress(self) -> OptionModel<InstalledPackageDataEntry> {
        self.0.child("install-progress").into()
    }
}
#[derive(Debug, Clone)]
pub enum PackageDataEntryModelKnown {
    Installing {
        install_progress: Model<Arc<InstallProgress>>,
    },
    Updating {
        installed: InstalledPackageDataEntryModel,
        install_progress: Model<Arc<InstallProgress>>,
    },
    Removing {
        installed: InstalledPackageDataEntryModel,
    },
    Installed {
        installed: InstalledPackageDataEntryModel,
    },
}
impl PackageDataEntryModel {
    pub async fn check<Db: DbHandle>(
        self,
        db: &mut Db,
    ) -> Result<PackageDataEntryModelKnown, Error> {
        let variant: ModelData<String> = self.0.clone().child("state").get(db).await?;
        Ok(match &**variant {
            "installing" => PackageDataEntryModelKnown::Installing {
                install_progress: JsonPointer::from(self.0)
                    .join_end("install-progress")
                    .into(),
            },
            "updating" => PackageDataEntryModelKnown::Updating {
                installed: JsonPointer::from(self.0.clone())
                    .join_end("installed")
                    .into(),
                install_progress: JsonPointer::from(self.0)
                    .join_end("install-progress")
                    .into(),
            },
            "removing" => PackageDataEntryModelKnown::Removing {
                installed: JsonPointer::from(self.0).join_end("installed").into(),
            },
            "installed" => PackageDataEntryModelKnown::Installed {
                installed: JsonPointer::from(self.0).join_end("installed").into(),
            },
            _ => {
                return Err(Error::new(
                    anyhow::anyhow!("invalid variant for PackageDataEntry"),
                    crate::ErrorKind::Database,
                ))
            }
        })
    }
}
impl PackageDataEntryModelKnown {
    pub fn as_installed(&self) -> Option<&InstalledPackageDataEntryModel> {
        match self {
            PackageDataEntryModelKnown::Installed { installed } => Some(installed),
            PackageDataEntryModelKnown::Removing { installed, .. } => Some(installed),
            PackageDataEntryModelKnown::Updating { installed, .. } => Some(installed),
            _ => None,
        }
    }
    pub fn as_install_progress(&self) -> Option<&Model<Arc<InstallProgress>>> {
        match self {
            PackageDataEntryModelKnown::Installing { install_progress } => Some(install_progress),
            PackageDataEntryModelKnown::Updating {
                install_progress, ..
            } => Some(install_progress),
            _ => None,
        }
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct InstalledPackageDataEntry {
    #[model]
    manifest: Manifest,
    status: Status,
    #[model]
    interface_info: InterfaceInfo,
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct InterfaceInfo {
    ip: Ipv4Addr,
    #[model]
    addresses: InterfaceAddressMap,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct InterfaceAddressMap(pub LinkedHashMap<InterfaceId, InterfaceAddresses>);
impl Map for InterfaceAddressMap {
    type Key = InterfaceId;
    type Value = InterfaceAddresses;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(&key)
    }
}
impl HasModel for InterfaceAddressMap {
    type Model = MapModel<Self>;
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct InterfaceAddresses {
    tor_address: Option<String>,
    lan_address: Option<String>,
}
