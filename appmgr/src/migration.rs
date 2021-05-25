use emver::VersionRange;
use indexmap::IndexMap;
use patch_db::HasModel;
use serde::{Deserialize, Serialize};

use crate::action::ActionImplementation;

#[derive(Clone, Debug, Default, Deserialize, Serialize, HasModel)]
pub struct Migrations {
    pub from: IndexMap<VersionRange, ActionImplementation>,
    pub to: IndexMap<VersionRange, ActionImplementation>,
}
