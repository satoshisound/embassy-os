use std::time::Duration;

use embassy::context::{EitherContext, RpcContext};
use embassy::status::synchronize_all;
use embassy::util::daemon;
use embassy::{Error, ErrorKind};
use futures::TryFutureExt;
use rpc_toolkit::hyper::StatusCode;
use rpc_toolkit::rpc_server;

fn status_fn(_: i32) -> StatusCode {
    StatusCode::OK
}

async fn inner_main() -> Result<(), Error> {
    let rpc_ctx = RpcContext::init().await?;
    let ctx = EitherContext::Rpc(rpc_ctx.clone());
    let server = rpc_server!(embassy::main_api, ctx, status_fn);
    let status_ctx = rpc_ctx.clone();
    let status_daemon = daemon(
        move || {
            let ctx = status_ctx.clone();
            async move {
                if let Err(e) = synchronize_all(&ctx).await {
                    log::error!("Error in Status Sync daemon: {}", e);
                    log::debug!("{:?}", e);
                }
            }
        },
        Duration::from_millis(500),
    );
    let health_daemon = daemon(move || async move { todo!() }, Duration::from_millis(500));
    futures::try_join!(
        server.map_err(|e| Error::new(e, ErrorKind::Network)),
        status_daemon.map_err(|e| Error::new(
            e.context("Status Sync daemon panicked!"),
            ErrorKind::Unknown
        )),
        health_daemon.map_err(|e| Error::new(
            e.context("Health Check daemon panicked!"),
            ErrorKind::Unknown
        )),
    )?;
    Ok(())
}

fn main() {
    let rt = tokio::runtime::Runtime::new().expect("failed to initialize runtime");
    match rt.block_on(inner_main()) {
        Ok(_) => (),
        Err(e) => {
            drop(rt);
            eprintln!("{}", e.source);
            log::debug!("{:?}", e.source);
            drop(e.source);
            std::process::exit(e.kind as i32)
        }
    }
}
