use std::time::Duration;

use futures::future::{BoxFuture, FutureExt};
use indexmap::{IndexMap, IndexSet};
use itertools::Itertools;
use patch_db::{DbHandle, DiffPatch};
use rand::SeedableRng;
use regex::Regex;
use rpc_toolkit::command;
use serde_json::Value;

use crate::config::spec::PackagePointerSpecVariant;
use crate::context::{ExtendedContext, RpcContext};
use crate::db::model::InstalledPackageDataEntryModel;
use crate::db::util::WithRevision;
use crate::dependencies::{BreakageRes, DependencyError};
use crate::net::host::Hosts;
use crate::s9pk::manifest::PackageId;
use crate::util::{
    display_none, display_serializable, from_yaml_async_reader, parse_duration,
    parse_stdin_deserializable, to_yaml_async_writer, IoFormat,
};
use crate::{Error, ResultExt as _};

pub mod action;
pub mod spec;
pub mod util;

pub use spec::{ConfigSpec, Defaultable};
use util::NumRange;

use self::action::ConfigRes;
use self::spec::ValueSpecPointer;

pub type Config = serde_json::Map<String, Value>;
pub trait TypeOf {
    fn type_of(&self) -> &'static str;
}
impl TypeOf for Value {
    fn type_of(&self) -> &'static str {
        match self {
            Value::Array(_) => "list",
            Value::Bool(_) => "boolean",
            Value::Null => "null",
            Value::Number(_) => "number",
            Value::Object(_) => "object",
            Value::String(_) => "string",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigurationError {
    #[error("Timeout Error")]
    TimeoutError(#[from] TimeoutError),
    #[error("No Match: {0}")]
    NoMatch(#[from] NoMatchWithPath),
    #[error("System Error: {0}")]
    SystemError(Error),
}
impl From<ConfigurationError> for Error {
    fn from(err: ConfigurationError) -> Self {
        let kind = match &err {
            ConfigurationError::SystemError(e) => e.kind,
            _ => crate::ErrorKind::ConfigGen,
        };
        crate::Error::new(err, kind)
    }
}

#[derive(Clone, Copy, Debug, thiserror::Error)]
#[error("Timeout Error")]
pub struct TimeoutError;

#[derive(Clone, Debug, thiserror::Error)]
pub struct NoMatchWithPath {
    pub path: Vec<String>,
    pub error: MatchError,
}
impl NoMatchWithPath {
    pub fn new(error: MatchError) -> Self {
        NoMatchWithPath {
            path: Vec::new(),
            error,
        }
    }
    pub fn prepend(mut self, seg: String) -> Self {
        self.path.push(seg);
        self
    }
}
impl std::fmt::Display for NoMatchWithPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.path.iter().rev().join("."), self.error)
    }
}
impl From<NoMatchWithPath> for Error {
    fn from(e: NoMatchWithPath) -> Self {
        ConfigurationError::from(e).into()
    }
}

#[derive(Clone, Debug, thiserror::Error)]
pub enum MatchError {
    #[error("String {0:?} Does Not Match Pattern {1}")]
    Pattern(String, Regex),
    #[error("String {0:?} Is Not In Enum {1:?}")]
    Enum(String, IndexSet<String>),
    #[error("Field Is Not Nullable")]
    NotNullable,
    #[error("Length Mismatch: expected {0}, actual: {1}")]
    LengthMismatch(NumRange<usize>, usize),
    #[error("Invalid Type: expected {0}, actual: {1}")]
    InvalidType(&'static str, &'static str),
    #[error("Number Out Of Range: expected {0}, actual: {1}")]
    OutOfRange(NumRange<f64>, f64),
    #[error("Number Is Not Integral: {0}")]
    NonIntegral(f64),
    #[error("Variant {0:?} Is Not In Union {1:?}")]
    Union(String, IndexSet<String>),
    #[error("Variant Is Missing Tag {0:?}")]
    MissingTag(String),
    #[error("Property {0:?} Of Variant {1:?} Conflicts With Union Tag")]
    PropertyMatchesUnionTag(String, String),
    #[error("Name of Property {0:?} Conflicts With Map Tag Name")]
    PropertyNameMatchesMapTag(String),
    #[error("Pointer Is Invalid: {0}")]
    InvalidPointer(spec::ValueSpecPointer),
    #[error("Object Key Is Invalid: {0}")]
    InvalidKey(String),
    #[error("Value In List Is Not Unique")]
    ListUniquenessViolation,
}

#[command(subcommands(get, set))]
pub fn config(
    #[context] ctx: RpcContext,
    #[arg] id: PackageId,
) -> Result<ExtendedContext<RpcContext, PackageId>, Error> {
    Ok(ExtendedContext::from(ctx).map(|_| id))
}

#[command(display(display_serializable))]
pub async fn get(
    #[context] ctx: ExtendedContext<RpcContext, PackageId>,
    #[arg(long = "format")] format: Option<IoFormat>,
) -> Result<ConfigRes, Error> {
    let mut db = ctx.base().db.handle();
    let pkg_model = crate::db::DatabaseModel::new()
        .package_data()
        .idx_model(ctx.extension())
        .and_then(|m| m.installed())
        .expect(&mut db)
        .await
        .with_kind(crate::ErrorKind::NotFound)?;
    let action = pkg_model
        .clone()
        .manifest()
        .config()
        .get(&mut db)
        .await?
        .to_owned()
        .ok_or_else(|| {
            Error::new(
                anyhow::anyhow!("{} has no config", ctx.extension()),
                crate::ErrorKind::NotFound,
            )
        })?;
    let version = pkg_model.clone().manifest().version().get(&mut db).await?;
    let volumes = pkg_model.manifest().volumes().get(&mut db).await?;
    let hosts = crate::db::DatabaseModel::new()
        .network()
        .hosts()
        .get(&mut db)
        .await?;
    action
        .get(ctx.extension(), &*version, &*volumes, &*hosts)
        .await
}

#[command(subcommands(self(set_impl(async)), set_dry), display(display_none))]
pub fn set(
    #[context] ctx: ExtendedContext<RpcContext, PackageId>,
    #[arg(long = "format")] format: Option<IoFormat>,
    #[arg(long = "timeout", parse(parse_duration))] timeout: Option<Duration>,
    #[arg(stdin, parse(parse_stdin_deserializable))] config: Option<Config>,
    #[arg(rename = "expireId", long = "expire-id")] expire_id: Option<String>,
) -> Result<
    ExtendedContext<RpcContext, (PackageId, Option<Config>, Option<Duration>, Option<String>)>,
    Error,
> {
    Ok(ctx.map(|id| (id, config, timeout, expire_id)))
}

#[command(display(display_serializable))]
pub async fn set_dry(
    #[context] ctx: ExtendedContext<
        RpcContext,
        (PackageId, Option<Config>, Option<Duration>, Option<String>),
    >,
) -> Result<BreakageRes, Error> {
    let (ctx, (id, config, timeout, _)) = ctx.split();
    let mut db = ctx.db.handle();
    let hosts = crate::db::DatabaseModel::new()
        .network()
        .hosts()
        .get(&mut db)
        .await?;
    let mut tx = db.begin().await?;
    let mut breakages = IndexMap::new();
    configure(
        &mut tx,
        &*hosts,
        &id,
        config,
        &timeout,
        true,
        &mut IndexMap::new(),
        &mut breakages,
    )
    .await?;
    crate::db::DatabaseModel::new()
        .package_data()
        .idx_model(&id)
        .expect(&mut tx)
        .await?
        .installed()
        .expect(&mut tx)
        .await?
        .status()
        .configured()
        .put(&mut tx, &true)
        .await?;
    Ok(BreakageRes {
        patch: tx.abort().await?,
        breakages,
    })
}

pub async fn set_impl(
    ctx: ExtendedContext<RpcContext, (PackageId, Option<Config>, Option<Duration>, Option<String>)>,
) -> Result<WithRevision<()>, Error> {
    let (ctx, (id, config, timeout, expire_id)) = ctx.split();
    let mut db = ctx.db.handle();
    let hosts = crate::db::DatabaseModel::new()
        .network()
        .hosts()
        .get(&mut db)
        .await?;
    let mut tx = db.begin().await?;
    let mut breakages = IndexMap::new();
    configure(
        &mut tx,
        &*hosts,
        &id,
        config,
        &timeout,
        false,
        &mut IndexMap::new(),
        &mut breakages,
    )
    .await?;
    crate::db::DatabaseModel::new()
        .package_data()
        .idx_model(&id)
        .expect(&mut tx)
        .await?
        .installed()
        .expect(&mut tx)
        .await?
        .status()
        .configured()
        .put(&mut tx, &true)
        .await?;
    Ok(WithRevision {
        response: (),
        revision: tx.commit(expire_id).await?,
    })
}

fn configure<'a, Db: DbHandle>(
    db: &'a mut Db,
    hosts: &'a Hosts,
    id: &'a PackageId,
    config: Option<Config>,
    timeout: &'a Option<Duration>,
    dry_run: bool,
    overrides: &'a mut IndexMap<PackageId, Config>,
    breakages: &'a mut IndexMap<PackageId, DependencyError>,
) -> BoxFuture<'a, Result<(), Error>> {
    async move {
        let pkg_model = crate::db::DatabaseModel::new()
            .package_data()
            .idx_model(id)
            .and_then(|m| m.installed())
            .expect(&mut db)
            .await
            .with_kind(crate::ErrorKind::NotFound)?;
        let action = pkg_model
            .clone()
            .manifest()
            .config()
            .get(&mut db)
            .await?
            .to_owned()
            .ok_or_else(|| {
                Error::new(
                    anyhow::anyhow!("{} has no config", id),
                    crate::ErrorKind::NotFound,
                )
            })?;
        let version = pkg_model.clone().manifest().version().get(&mut db).await?;
        let dependencies = pkg_model
            .clone()
            .manifest()
            .dependencies()
            .get(&mut db)
            .await?;
        let dependents = pkg_model.clone().dependents().get(&mut db).await?;
        let volumes = pkg_model.manifest().volumes().get(&mut db).await?;
        let get_res = action.get(id, &*version, &*volumes, &*hosts).await?;
        let original = get_res
            .config
            .clone()
            .map(Value::Object)
            .unwrap_or_default();
        let spec = get_res.spec;
        let config = if let Some(config) = config.or_else(|| get_res.config.clone()) {
            config
        } else {
            spec.gen(&mut rand::rngs::StdRng::from_entropy(), timeout)?
        };
        spec.matches(&config)?;
        spec.update(db, &*overrides, &mut config).await?;
        if Some(&config) == get_res.config.as_ref() {
            Ok(())
        } else {
            overrides.insert(id.clone(), config.clone());
            let prev = get_res.config.map(Value::Object).unwrap_or_default();
            let next = Value::Object(config.clone());
            for (dependent, ptrs) in &*dependents {
                let dependent_model = crate::db::DatabaseModel::new()
                    .package_data()
                    .idx_model(dependent)
                    .and_then(|pkg| pkg.installed())
                    .expect(db)
                    .await?;
                if let Some(cfg) = &*dependent_model
                    .clone()
                    .manifest()
                    .dependencies()
                    .idx_model(id)
                    .expect(db)
                    .await?
                    .config()
                    .get(db)
                    .await?
                {
                    let version = dependent_model.manifest().version().get(db).await?;
                    if let Err(error) = cfg.check(dependent, &*version, &config).await? {
                        let dep_err = DependencyError::ConfigUnsatisfied { error };
                        fn handle_broken_dependents<'a, Db: DbHandle>(
                            db: &'a mut Db,
                            model: InstalledPackageDataEntryModel,
                            error: DependencyError,
                            breakages: &mut IndexMap<PackageId, DependencyError>,
                        ) -> BoxFuture<'a, Result<(), Error>> {
                            async move {
                                let status = model.status().get_mut(db).await?;

                                todo!()
                            }
                            .boxed()
                        }
                        handle_broken_dependents(db, dependent_model, dep_err, breakages).await?;
                    } else {
                        for ptr in ptrs {
                            if let PackagePointerSpecVariant::Config { selector, multi } = ptr {
                                if selector.select(*multi, &next) != selector.select(*multi, &prev)
                                {
                                    configure(
                                        db, hosts, dependent, None, timeout, dry_run, overrides,
                                        breakages,
                                    )
                                    .await?;
                                }
                            }
                        }
                    }
                }
            }
            let res = action
                .set(id, &*version, &*dependencies, &*volumes, hosts, &config)
                .await?;
            Ok(())
        }
    }
    .boxed()
}
