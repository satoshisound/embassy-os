use std::path::Path;

use futures::future::try_join_all;
use hashlink::LinkedHashMap;
use serde::{Deserialize, Serialize};

use crate::util::Invoke;
use crate::{Error, ResultExt as _};

pub const ROOT_DISK: &'static str = "/dev/mmcblk0";
pub const MAIN_DISK: &'static str = "/dev/sda";

pub struct Disks(LinkedHashMap<String, DiskInfo>);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct DiskInfo {
    pub size: String,
    pub description: Option<String>,
    pub partitions: LinkedHashMap<String, PartitionInfo>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct PartitionInfo {
    pub is_mounted: bool,
    pub size: Option<String>,
    pub label: Option<String>,
}

pub async fn list() -> Result<Disks, Error> {
    let output = tokio::process::Command::new("parted")
        .arg("-lm")
        .invoke(crate::ErrorKind::GParted)
        .await?;
    let output_str = std::str::from_utf8(&output)?;
    let disks = output_str
        .split("\n\n")
        .filter_map(|s| -> Option<(String, DiskInfo)> {
            let mut lines = s.split("\n");
            let has_size = lines.next()? == "BYT;";
            let disk_info_line = lines.next()?;
            let mut disk_info_iter = disk_info_line.split(":");
            let logicalname = disk_info_iter.next()?.to_owned();
            let partition_prefix = if logicalname.ends_with(|c: char| c.is_digit(10)) {
                logicalname.clone() + "p"
            } else {
                logicalname.clone()
            };
            let size = disk_info_iter.next()?.to_owned();
            disk_info_iter.next()?; // transport-type
            disk_info_iter.next()?; // logical-sector-size
            disk_info_iter.next()?; // physical-sector-size
            disk_info_iter.next()?; // partition-table-type
            let description = disk_info_iter.next()?;
            let description = if description.is_empty() {
                None
            } else {
                Some(description.to_owned())
            };
            Some((
                logicalname,
                DiskInfo {
                    size,
                    description,
                    partitions: lines
                        .filter_map(|partition_info_line| -> Option<(String, PartitionInfo)> {
                            let mut partition_info_iter = partition_info_line.split(":");
                            let partition_idx = partition_info_iter.next()?;
                            let logicalname = partition_prefix.clone() + partition_idx;
                            let size = if has_size {
                                partition_info_iter.next()?; // begin
                                partition_info_iter.next()?; // end
                                Some(partition_info_iter.next()?.to_owned())
                            } else {
                                None
                            };
                            Some((
                                logicalname,
                                PartitionInfo {
                                    is_mounted: false,
                                    size,
                                    label: None,
                                },
                            ))
                        })
                        .collect(),
                },
            ))
        });
    Ok(Disks(
        try_join_all(disks.map(|(logicalname, disk)| async move {
            Ok::<_, Error>((
                logicalname,
                DiskInfo {
                    partitions: try_join_all(disk.partitions.into_iter().map(
                        |(logicalname, mut partition)| async move {
                            let mut blkid_command = tokio::process::Command::new("blkid");
                            let (blkid_res, findmnt_status) = futures::join!(
                                blkid_command
                                    .arg(&logicalname)
                                    .arg("-s")
                                    .arg("LABEL")
                                    .arg("-o")
                                    .arg("value")
                                    .invoke(crate::ErrorKind::Blkid),
                                tokio::process::Command::new("findmnt")
                                    .arg(&logicalname)
                                    .stdout(std::process::Stdio::null())
                                    .stderr(std::process::Stdio::null())
                                    .status()
                            );
                            let blkid_output = blkid_res?;
                            let label = std::str::from_utf8(&blkid_output)?.trim();
                            if !label.is_empty() {
                                partition.label = Some(label.to_owned());
                            }
                            if findmnt_status?.success() {
                                partition.is_mounted = true;
                            }
                            Ok::<_, Error>((logicalname, partition))
                        },
                    ))
                    .await?
                    .into_iter()
                    .collect(),
                    ..disk
                },
            ))
        }))
        .await?
        .into_iter()
        .collect(),
    ))
}

pub async fn mount_main_disk(logicalname: &str, password: &str) -> Result<(), Error> {}

pub async fn mount<P: AsRef<Path>>(logicalname: &str, mount_point: P) -> Result<(), Error> {
    let is_mountpoint = tokio::process::Command::new("mountpoint")
        .arg(mount_point.as_ref())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await?;
    if is_mountpoint.success() {
        unmount(mount_point.as_ref()).await?;
    }
    tokio::fs::create_dir_all(&mount_point).await?;
    let mount_output = tokio::process::Command::new("mount")
        .arg(logicalname)
        .arg(mount_point.as_ref())
        .output()
        .await?;
    crate::ensure_code!(
        mount_output.status.success(),
        crate::ErrorKind::Filesystem,
        "Error Mounting Drive: {}",
        std::str::from_utf8(&mount_output.stderr).unwrap_or("Unknown Error")
    );
    Ok(())
}

pub async fn unmount<P: AsRef<Path>>(mount_point: P) -> Result<(), Error> {
    log::info!("Unmounting {}.", mount_point.as_ref().display());
    let umount_output = tokio::process::Command::new("umount")
        .arg(mount_point.as_ref())
        .output()
        .await?;
    crate::ensure_code!(
        umount_output.status.success(),
        crate::ErrorKind::Filesystem,
        "Error Unmounting Drive: {}: {}",
        mount_point.as_ref().display(),
        std::str::from_utf8(&umount_output.stderr).unwrap_or("Unknown Error")
    );
    tokio::fs::remove_dir_all(mount_point.as_ref())
        .await
        .with_ctx(|_| {
            (
                crate::ErrorKind::Filesystem,
                format!("rm {}", mount_point.as_ref().display()),
            )
        })?;
    Ok(())
}

#[must_use]
pub struct MountGuard<P: AsRef<Path>> {
    path: Option<P>,
}
impl<P: AsRef<Path>> MountGuard<P> {
    pub async fn new(logicalname: &str, mount_point: P) -> Result<Self, Error> {
        mount(logicalname, mount_point.as_ref()).await?;
        Ok(Self {
            path: Some(mount_point),
        })
    }
    pub async fn unmount(mut self) -> Result<(), Error> {
        if let Some(ref path) = self.path {
            unmount(path).await?;
            self.path = None;
        }
        Ok(())
    }
}
impl<P: AsRef<Path>> Drop for MountGuard<P> {
    fn drop(&mut self) {
        if let Some(ref path) = self.path {
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(unmount(path))
                .unwrap()
        }
    }
}
