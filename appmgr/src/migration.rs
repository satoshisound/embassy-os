use emver::VersionRange;
use hashlink::LinkedHashMap;
use patch_db::HasModel;
use serde::{Deserialize, Serialize};

use crate::action::ActionImplementation;

#[derive(Clone, Debug, Default, Deserialize, Serialize, HasModel)]
pub struct Migrations {
    pub from: LinkedHashMap<VersionRange, ActionImplementation>,
    pub to: LinkedHashMap<VersionRange, ActionImplementation>,
}
