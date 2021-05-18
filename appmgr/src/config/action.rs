use emver::Version;
use hashlink::LinkedHashMap;
use patch_db::HasModel;
use serde::{Deserialize, Serialize};

use super::{Config, ConfigSpec};
use crate::action::ActionImplementation;
use crate::dependencies::Dependencies;
use crate::id::InterfaceId;
use crate::net::host::Hosts;
use crate::s9pk::manifest::PackageId;
use crate::volume::Volumes;
use crate::Error;

#[derive(Debug, Deserialize, Serialize, HasModel)]
#[serde(rename_all = "kebab-case")]
pub struct ConfigRes {
    pub config: Option<Config>,
    pub spec: ConfigSpec,
}

#[derive(Clone, Debug, Deserialize, Serialize, HasModel)]
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
        hosts: &Hosts,
    ) -> Result<ConfigRes, Error> {
        self.get
            .execute(pkg_id, pkg_version, volumes, hosts, None::<()>, false)
            .await
            .and_then(|res| {
                res.map_err(|e| Error::new(anyhow::anyhow!("{}", e.1), crate::ErrorKind::ConfigGen))
            })
    }

    pub async fn set(
        &self,
        pkg_id: &PackageId,
        pkg_version: &Version,
        dependencies: &Dependencies,
        volumes: &Volumes,
        hosts: &Hosts,
        input: Config,
    ) -> Result<LinkedHashMap<PackageId, Vec<InterfaceId>>, Error> {
        let res: LinkedHashMap<PackageId, Vec<InterfaceId>> = self
            .set
            .execute(pkg_id, pkg_version, volumes, hosts, Some(input), false)
            .await
            .and_then(|res| {
                res.map_err(|e| {
                    Error::new(
                        anyhow::anyhow!("{}", e.1),
                        crate::ErrorKind::ConfigRulesViolation,
                    )
                })
            })?;
        Ok(res
            .into_iter()
            .filter(|(pkg, _)| dependencies.0.contains_key(pkg))
            .collect())
    }
}
