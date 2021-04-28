use emver::Version;
use patch_db::HasModel;
use serde::{Deserialize, Serialize};

use crate::action::ActionImplementation;
use crate::s9pk::manifest::PackageId;
use crate::volume::{Volume, VolumeId, Volumes};
use crate::{Error, ResultExt};

#[derive(Debug, Deserialize, Serialize, HasModel)]
pub struct BackupActions {
    pub create: ActionImplementation,
    pub restore: ActionImplementation,
}
impl BackupActions {
    pub async fn backup(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
    ) -> Result<(), Error> {
        let mut volumes = volumes.to_read_only();
        volumes.insert(VolumeId::Backup, Volume::Backup { read_only: false });
        self.create
            .execute(pkg_id, pkg_version, &volumes, None::<()>)
            .await?
            .map_err(|e| anyhow::anyhow!("{}", e.1))
            .with_kind(crate::ErrorKind::Backup)?;
        Ok(())
    }

    pub async fn restore(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
    ) -> Result<(), Error> {
        let mut volumes = volumes.clone();
        volumes.insert(VolumeId::Backup, Volume::Backup { read_only: true });
        self.restore
            .execute(pkg_id, pkg_version, &volumes, None::<()>)
            .await?
            .map_err(|e| anyhow::anyhow!("{}", e.1))
            .with_kind(crate::ErrorKind::Restore)?;
        Ok(())
    }
}
