use std::collections::HashMap;

use anyhow::anyhow;
use bollard::container::{ListContainersOptions, StartContainerOptions, StopContainerOptions};
use bollard::models::{ContainerStateStatusEnum, ContainerSummaryInner};
use bollard::Docker;
use futures::StreamExt;
use hashlink::LinkedHashMap;
use patch_db::{DbHandle, HasModel, Map, MapModel};
use serde::{Deserialize, Serialize};

use self::health_check::HealthCheckResult;
use crate::action::docker::DockerAction;
use crate::context::RpcContext;
use crate::dependencies::DependencyError;
use crate::id::InterfaceId;
use crate::s9pk::manifest::{Manifest, PackageId};
use crate::util::Invoke;
use crate::Error;

pub mod health_check;

// Assume docker for now
pub async fn synchronize_all(ctx: &RpcContext) -> Result<(), Error> {
    let mut db = ctx.db.handle();
    let mut pkg_ids = crate::db::DatabaseModel::new()
        .package_data()
        .keys(&mut db)
        .await?;
    let mut container_names = Vec::with_capacity(pkg_ids.len());
    for id in pkg_ids.clone().into_iter() {
        if let Some(version) = &*crate::db::DatabaseModel::new()
            .package_data()
            .idx_model(&id)
            .expect(&mut db)
            .await?
            .installed()
            .map(|i| i.manifest().version())
            .get(&mut db)
            .await?
        {
            container_names.push(DockerAction::container_name(id.as_ref(), version));
        } else {
            pkg_ids.remove(&id);
        }
    }
    let mut filters = HashMap::new();
    filters.insert("name".to_owned(), container_names);
    let info = ctx
        .docker
        .list_containers(Some(ListContainersOptions {
            all: true,
            size: false,
            limit: None,
            filters,
        }))
        .await?;
    let mut fuckening = false;
    for summary in info {
        let id = if let Some(id) = summary.names.iter().flatten().find_map(|s| {
            DockerAction::uncontainer_name(s.as_str()).and_then(|id| pkg_ids.take(id))
        }) {
            id
        } else {
            continue;
        };
        async fn status<Db: DbHandle>(
            docker: &Docker,
            id: &PackageId,
            db: &mut Db,
            summary: &ContainerSummaryInner,
        ) -> Result<bool, Error> {
            let pkg_data = crate::db::DatabaseModel::new()
                .package_data()
                .idx_model(id)
                .check(db)
                .await?
                .ok_or_else(|| {
                    Error::new(
                        anyhow!("VersionedPackageData does not exist"),
                        crate::ErrorKind::Database,
                    )
                })?;
            let (status, manifest) = if let Some(installed) = pkg_data.installed().check(db).await?
            {
                (
                    installed.clone().status().get(db).await?,
                    installed.manifest().get(db).await?,
                )
            } else {
                return Ok(false);
            };

            status.main.synchronize(docker, &*manifest, summary).await
        }
        match status(&ctx.docker, &id, &mut db, &summary).await {
            Ok(a) => fuckening |= a,
            Err(e) => log::error!("Error syncronizing status of {}: {}", id, e),
        }
    }

    if fuckening {
        tokio::process::Command::new("service")
            .arg("docker")
            .arg("restart")
            .invoke(crate::ErrorKind::Docker)
            .await?;
    }

    for id in pkg_ids {
        log::warn!("No container for {}", id);
    }

    Ok(())
}

pub async fn check_all(ctx: &RpcContext) -> Result<(), Error> {
    let mut db = ctx.db.handle();
    let pkg_ids = crate::db::DatabaseModel::new()
        .package_data()
        .keys(&mut db)
        .await?;
    async fn main_status<Db: DbHandle>(id: PackageId, mut db: Db) -> Result<(), Error> {
        let pkg_data = crate::db::DatabaseModel::new()
            .package_data()
            .idx_model(&id)
            .check(&mut db)
            .await?
            .ok_or_else(|| {
                Error::new(
                    anyhow!("VersionedPackageData does not exist"),
                    crate::ErrorKind::Database,
                )
            })?;
        let (mut status, manifest) =
            if let Some(installed) = pkg_data.installed().check(&mut db).await? {
                (
                    installed.clone().status().get_mut(&mut db).await?,
                    installed.manifest().get(&mut db).await?,
                )
            } else {
                return Ok(());
            };

        status.main.check(&*manifest).await?;

        status.save(&mut db).await?;

        Ok(())
    }
    drop(db);
    futures::stream::iter(pkg_ids)
        .for_each_concurrent(None, |id| async move {
            if let Err(e) = tokio::spawn(main_status(id.clone(), ctx.db.handle()))
                .await
                .unwrap()
            {
                log::error!("Error running health check for {}: {}", id, e);
                log::debug!("{:?}", e);
            }
        })
        .await;

    // TODO: dependencies

    Ok(())
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Status {
    pub configured: bool,
    pub main: MainStatus,
    pub dependencies: DependencyErrors,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "status")]
#[serde(rename_all = "kebab-case")]
pub enum MainStatus {
    Stopped,
    Running {
        main: HealthCheckResult,
        interfaces: LinkedHashMap<InterfaceId, HealthCheckResult>,
    },
    BackingUp {
        running: bool,
    },
    Restoring {
        running: bool,
    },
}
impl MainStatus {
    pub async fn synchronize(
        &self,
        docker: &Docker,
        manifest: &Manifest,
        summary: &ContainerSummaryInner,
    ) -> Result<bool, Error> {
        // true if Docker Fuckening
        async fn check_fuckening(docker: &Docker, manifest: &Manifest) -> Result<bool, Error> {
            Ok(docker
                .inspect_container(
                    &DockerAction::container_name(&manifest.id, &manifest.version),
                    None,
                )
                .await?
                .state
                .as_ref()
                .and_then(|s| s.status)
                == Some(ContainerStateStatusEnum::RUNNING))
        }
        let name = DockerAction::container_name(&manifest.id, &manifest.version);
        let state = summary.state.as_ref().map(|s| s.as_str());
        match state {
            Some("created") | Some("exited") => match self {
                MainStatus::Stopped => (),
                MainStatus::Running { .. } => {
                    docker
                        .start_container(&name, None::<StartContainerOptions<String>>)
                        .await?;
                }
                MainStatus::BackingUp { .. } => (),
                MainStatus::Restoring { .. } => (),
            },
            Some("running") | Some("restarting") => match self {
                MainStatus::Stopped | MainStatus::Restoring { .. } => {
                    docker
                        .stop_container(&name, Some(StopContainerOptions { t: 30 }))
                        .await?;
                    return check_fuckening(docker, manifest).await;
                }
                MainStatus::Running { .. } => (),
                MainStatus::BackingUp { .. } => {
                    docker.pause_container(&name).await?;
                }
            },
            Some("paused") => match self {
                MainStatus::Stopped | MainStatus::Restoring { .. } => {
                    docker.unpause_container(&name).await?;
                    docker
                        .stop_container(&name, Some(StopContainerOptions { t: 30 }))
                        .await?;
                    return check_fuckening(docker, manifest).await;
                }
                MainStatus::Running { .. } => {
                    docker.unpause_container(&name).await?;
                }
                MainStatus::BackingUp { .. } => (),
            },
            unknown => {
                return Err(Error::new(
                    anyhow!("Unexpected Docker Status: {:?}", unknown),
                    crate::ErrorKind::Docker,
                ));
            }
        }
        Ok(false)
    }
    pub async fn check(&mut self, manifest: &Manifest) -> Result<(), Error> {
        match self {
            MainStatus::Running { main, interfaces } => {
                let (main_res, iface_res) = tokio::try_join!(
                    manifest
                        .health_check
                        .check(&manifest.id, &manifest.version, &manifest.volumes),
                    manifest.interfaces.check_all(
                        &manifest.id,
                        &manifest.version,
                        &manifest.volumes
                    )
                )?;
                *main = main_res;
                *interfaces = iface_res;
            }
            _ => (),
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DependencyErrors(LinkedHashMap<PackageId, DependencyError>);
impl Map for DependencyErrors {
    type Key = PackageId;
    type Value = DependencyError;
    fn get(&self, key: &Self::Key) -> Option<&Self::Value> {
        self.0.get(key)
    }
}
impl HasModel for DependencyErrors {
    type Model = MapModel<Self>;
}
