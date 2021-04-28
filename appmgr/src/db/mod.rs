use std::sync::Arc;

use emver::Version;
use hashlink::LinkedHashMap;
use patch_db::json_ptr::JsonPointer;
use patch_db::{DbHandle, HasModel, Map, MapModel, ModelData};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::install_new::progress::InstallProgress;
use crate::s9pk::manifest::{Manifest, PackageId};
use crate::util::VersionString;
use crate::Error;

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct Database {
    #[model]
    pub package_data: AllPackageData,
    pub ui: Value,
    pub agent: Value,
}
impl DatabaseModel {
    pub fn new() -> Self {
        Self::from(JsonPointer::default())
    }
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

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct VersionedPackageData(pub LinkedHashMap<Version, PackageDataEntry>);
impl Map for VersionedPackageData {
    type Key = VersionString;
    type Value = PackageDataEntry;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(&*key)
    }
}
impl HasModel for VersionedPackageData {
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
        let variant: ModelData<String> = self.0.child("state").get(db).await?;
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
}
