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
    todo!()
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
