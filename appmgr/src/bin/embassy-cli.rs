use std::time::Duration;

use clap::Arg;
use embassy::context::{CliContext, EitherContext};
use embassy::db::model::Database;
use embassy::status::{check_all, synchronize_all};
use embassy::util::daemon;
use embassy::{Error, ErrorKind};
use futures::TryFutureExt;
use patch_db::json_ptr::JsonPointer;
use rpc_toolkit::hyper::StatusCode;
use rpc_toolkit::run_cli;

fn status_fn(_: i32) -> StatusCode {
    StatusCode::OK
}

fn inner_main() -> Result<(), Error> {
    simple_logging::log_to_stderr(log::LevelFilter::Info);
    run_cli!(
        embassy::main_api,
        app => app
            .arg(Arg::with_name("host").long("host").short("h").takes_value(true))
            .arg(Arg::with_name("port").long("port").short("p").takes_value(true)),
        matches => EitherContext::Cli(CliContext::init(matches)?),
        |code| if code < 0 { 1 } else { code }
    )
}

fn main() {
    match inner_main() {
        Ok(_) => (),
        Err(e) => {
            eprintln!("{}", e.source);
            log::debug!("{:?}", e.source);
            drop(e.source);
            std::process::exit(e.kind as i32)
        }
    }
}
