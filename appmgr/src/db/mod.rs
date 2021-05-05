use std::sync::Arc;

use hashlink::LinkedHashMap;
use patch_db::json_ptr::JsonPointer;
use patch_db::{DbHandle, HasModel, Map, MapModel, ModelData};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::install_new::progress::InstallProgress;
use crate::s9pk::manifest::{Manifest, PackageId};
use crate::status::Status;
use crate::util::{IpPool, Version};
use crate::Error;

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct Database {
    #[model]
    pub package_data: AllPackageData,
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
pub struct Resources {
    ip_pool: IpPool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AllPackageData(pub LinkedHashMap<PackageId, VersionedPackageData>);
impl Map for AllPackageData {
    type Key = PackageId;
    type Value = VersionedPackageData;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(key)
    }
}
impl HasModel for AllPackageData {
    type Model = MapModel<Self>;
}

#[derive(Debug, Default, Deserialize, Serialize, HasModel)]
pub struct VersionedPackageData {
    selected: Option<Version>,
    #[model]
    versions: VersionedPackageDataMap,
}
impl VersionedPackageDataModel {
    pub async fn selected_version<Db: DbHandle>(
        self,
        db: &mut Db,
    ) -> Result<Option<PackageDataEntryModel>, Error> {
        let selected = self.clone().selected().get(db).await?;
        if let Some(selected) = &*selected {
            Ok(Some(self.versions().idx_model(&selected).expect(db).await?))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct VersionedPackageDataMap(pub LinkedHashMap<Version, PackageDataEntry>);
impl Map for VersionedPackageDataMap {
    type Key = Version;
    type Value = PackageDataEntry;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(&key)
    }
}
impl HasModel for VersionedPackageDataMap {
    type Model = MapModel<Self>;
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(tag = "state")]
#[serde(rename_all = "kebab-case")]
pub enum PackageDataEntry {
    Installing(Arc<InstallProgress>),
    InstallFailed,
    Removing,
    Installed(InstalledPackageDataEntry),
}
#[derive(Debug, Clone)]
pub enum PackageDataEntryModelKnown {
    Installing,
    Removing,
    Installed(InstalledPackageDataEntryModel),
}
impl PackageDataEntryModel {
    pub async fn check<Db: DbHandle>(
        self,
        db: &mut Db,
    ) -> Result<PackageDataEntryModelKnown, Error> {
        let variant: ModelData<String> = self.0.clone().child("state").get(db).await?;
        Ok(match &**variant {
            "installing" => PackageDataEntryModelKnown::Installing,
            "removing" => PackageDataEntryModelKnown::Removing,
            "installed" => PackageDataEntryModelKnown::Installed(JsonPointer::from(self.0).into()),
            _ => {
                return Err(Error::new(
                    anyhow::anyhow!("invalid variant for PackageDataEntry"),
                    crate::ErrorKind::Database,
                ))
            }
        })
    }
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
pub struct InstalledPackageDataEntry {
    #[model]
    manifest: Manifest,
    status: Status,
}
