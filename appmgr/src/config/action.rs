use emver::Version;
use patch_db::HasModel;
use serde::{Deserialize, Serialize};

use super::{Config, ConfigSpec};
use crate::action::ActionImplementation;
use crate::s9pk::manifest::PackageId;
use crate::volume::Volumes;
use crate::Error;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct ConfigRes {
    config: Option<Config>,
    spec: ConfigSpec,
}

#[derive(Debug, Deserialize, Serialize, HasModel)]
pub struct ConfigActions {
    pub get: ActionImplementation,
    pub set: ActionImplementation,
}
impl ConfigActions {
    pub async fn get(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
    ) -> Result<ConfigRes, Error> {
        self.get
            .execute(pkg_id, pkg_version, volumes, None::<()>)
            .await
            .and_then(|res| {
                res.map_err(|e| Error::new(anyhow::anyhow!("{}", e.1), crate::ErrorKind::ConfigGen))
            })
    }

    pub async fn set(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        volumes: &Volumes,
        input: Config,
    ) -> Result<(), Error> {
        self.get
            .execute(pkg_id, pkg_version, volumes, Some(input))
            .await
            .and_then(|res| {
                res.map_err(|e| {
                    Error::new(
                        anyhow::anyhow!("{}", e.1),
                        crate::ErrorKind::ConfigRulesViolation,
                    )
                })
            })
    }
}
