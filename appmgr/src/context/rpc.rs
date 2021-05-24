use std::net::{IpAddr, SocketAddr};
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use bollard::Docker;
use patch_db::PatchDb;
use rpc_toolkit::url::Host;
use rpc_toolkit::Context;
use serde::Deserialize;
use sqlx::SqlitePool;
use tokio::fs::File;
use tokio::sync::RwLock;

use crate::util::{from_yaml_async_reader, AsyncFileExt};
use crate::{Error, ResultExt};

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct RpcContextConfig {
    pub bind: Option<SocketAddr>,
    pub db: Option<PathBuf>,
    pub secret_store: Option<PathBuf>,
}
pub struct RpcContextSeed {
    pub bind: SocketAddr,
    pub db: PatchDb,
    pub secret_store: SqlitePool,
    pub docker: Docker,
}

#[derive(Clone)]
pub struct MaybeAuthedRpcContext(Arc<RwLock<Option<Arc<RpcContextSeed>>>>);
impl MaybeAuthedRpcContext {
    pub fn new() -> Self {
        MaybeAuthedRpcContext(Arc::new(RwLock::new(None)))
    }
    pub async fn init(&self) -> Result<(), Error> {
        let mut seed = self.0.write().await;
        let cfg_path = Path::new(crate::CONFIG_PATH);
        let base = if let Some(f) = File::maybe_open(cfg_path)
            .await
            .with_ctx(|_| (crate::ErrorKind::Filesystem, cfg_path.display().to_string()))?
        {
            from_yaml_async_reader(f).await?
        } else {
            RpcContextConfig::default()
        };
        *seed = Some(Arc::new(RpcContextSeed {
            bind: base.bind.unwrap_or(([127, 0, 0, 1], 5960).into()),
            db: PatchDb::open(
                base.db
                    .unwrap_or_else(|| Path::new("/mnt/embassy-os/embassy.db").to_owned()),
            )
            .await?,
            secret_store: SqlitePool::connect(&format!(
                "sqlite://{}",
                base.secret_store
                    .unwrap_or_else(|| Path::new("/mnt/embassy-os/secrets.db").to_owned())
                    .display()
            ))
            .await?,
            docker: Docker::connect_with_unix_defaults()?,
        }));
        Ok(())
    }
    pub async fn authed(&self) -> Result<RpcContext, Error> {
        if let Some(ctx) = self.0.read().await.clone() {
            Ok(RpcContext(ctx))
        } else {
            Err(Error::new(
                anyhow::anyhow!("Encrypted disk has not been unlocked"),
                crate::ErrorKind::Authorization,
            ))
        }
    }
}

#[derive(Clone)]
pub struct RpcContext(Arc<RpcContextSeed>);
impl Context for RpcContext {
    fn host(&self) -> Host<&str> {
        match self.0.bind.ip() {
            IpAddr::V4(a) => Host::Ipv4(a),
            IpAddr::V6(a) => Host::Ipv6(a),
        }
    }
    fn port(&self) -> u16 {
        self.0.bind.port()
    }
}
impl Deref for RpcContext {
    type Target = RpcContextSeed;
    fn deref(&self) -> &Self::Target {
        &*self.0
    }
}
