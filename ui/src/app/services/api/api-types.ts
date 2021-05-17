import { Dump, Operation, Revision } from 'patch-db-client'
import { PackagePropertiesVersioned } from 'src/app/util/properties.util'
import { ConfigSpec } from 'src/app/pkg-config/config-types'
import { DataModel, DependencyError } from 'src/app/models/patch-db/data-model'

export module RR {

  // DB

  export type GetRevisionsRes = Revision[] | Dump<DataModel>

  export type GetDumpRes = Dump<DataModel>

  export type SetDBValueReq = WithExpire<{ pointer: string, value: any }> // db.put.ui
  export type SetDBValueRes = WithRevision<null>

  // auth

  export type LoginReq = { password: string } // auth.login - unauthed
  export type LoginRes = null

  export type LogoutReq = { } // auth.logout
  export type LogoutRes = null

  // server

  export type GetServerLogsReq = { before?: string } // server.logs
  export type GetServerLogsRes = Log[]

  export type GetServerMetricsReq = { } // server.metrics
  export type GetServerMetricsRes = ServerMetrics

  export type UpdateServerReq = WithExpire<{ }> // server.update
  export type UpdateServerRes = WithRevision<null>

  export type RestartServerReq = { } // server.restart
  export type RestartServerRes = null

  export type ShutdownServerReq = { } // server.shutdown
  export type ShutdownServerRes = null

  // network

  export type RefreshLanReq = { } // network.lan.refresh
  export type RefreshLanRes = null

  // registry

  export type SetRegistryReq = WithExpire<{ url: string }> // registry.set
  export type SetRegistryRes = WithRevision<null>

  // notification

  export type GetNotificationsReq = WithExpire<{ page: number, 'per-page': number }> // notification.list
  export type GetNotificationsRes = WithRevision<ServerNotification[]>

  export type DeleteNotificationReq = { id: string } // notification.delete
  export type DeleteNotificationRes = null

  // wifi

  export type AddWifiReq = { // wifi.add
    ssid: string
    password: string
    country: string
    priority: number
    connect: boolean
  }
  export type AddWifiRes = null

  export type ConnectWifiReq = WithExpire<{ ssid: string }> // wifi.connect
  export type ConnectWifiRes = WithRevision<null>

  export type DeleteWifiReq = WithExpire<{ ssid: string }> // wifi.delete
  export type DeleteWifiRes = WithRevision<null>

  // ssh

  export type GetSSHKeysReq = { } // ssh.get
  export type GetSSHKeysRes = SSHKeys

  export type AddSSHKeyReq = { pubkey: string } // ssh.add
  export type AddSSHKeyRes = SSHKeys

  export type DeleteSSHKeyReq = { hash: string } // ssh.delete
  export type DeleteSSHKeyRes = null

  // backup

  export type CreateBackupReq = WithExpire<{ logicalname: string, password: string }> // backup.create
  export type CreateBackupRes = WithRevision<null>

  export type RestoreBackupReq = { logicalname: string, password: string } // backup.restore - unauthed
  export type RestoreBackupRes = null

  // disk

  export type GetDisksReq = { } // disk.list
  export type GetDisksRes = DiskInfo

  export type EjectDisksReq = { logicalname: string } // disk.eject
  export type EjectDisksRes = null

  // package

  export type GetPackageInstructionsReq = { id: string } // package.instructions
  export type GetPackageInstructionsRes = string

  export type GetPackagePropertiesReq = { id: string } // package.properties
  export type GetPackagePropertiesRes = PackagePropertiesVersioned<number>

  export type GetPackageLogsReq = { id: string, before?: string } // package.logs
  export type GetPackageLogsRes = Log[]

  export type InstallPackageReq = WithExpire<{ id: string, version: string }> // package.install
  export type InstallPackageRes = WithRevision<null>

  export type DryUpdatePackageReq = UpdatePackageReq // package.update.dry
  export type DryUpdatePackageRes = BreakageRes

  export type UpdatePackageReq = WithExpire<{ id: string, version: string }> // package.update
  export type UpdatePackageRes = WithRevision<null>

  export type GetPackageConfigReq = { id: string } // package.config.get
  export type GetPackageConfigRes = { spec: ConfigSpec, config: object }

  export type DrySetPackageConfigReq = SetPackageConfigReq // package.config.set.dry
  export type DrySetPackageConfigRes = BreakageRes

  export type SetPackageConfigReq = WithExpire<{ id: string, config: object }> // package.config.set
  export type SetPackageConfigRes = WithRevision<null>

  export type RestorePackageReq = WithExpire<{ id: string, logicalname: string, password: string }> // package.backup.restore
  export type RestorePackageRes = WithRevision<null>

  export type ExecutePackageActionReq = { id: string, 'action-id': string, input?: object } // package.action
  export type ExecutePackageActionRes = ActionResponse

  export type StartPackageReq = WithExpire<{ id: string }> // package.start
  export type StartPackageRes = WithRevision<null>

  export type DryStopPackageReq = StopPackageReq // package.stop.dry
  export type DryStopPackageRes = BreakageRes

  export type StopPackageReq = WithExpire<{ id: string }> // package.stop
  export type StopPackageRes = WithRevision<null>

  export type DryRemovePackageReq = RemovePackageReq // package.remove.dry
  export type DryRemovePackageRes = BreakageRes

  export type RemovePackageReq = WithExpire<{ id: string }> // package.remove
  export type RemovePackageRes = WithRevision<null>

  export type DryConfigureDependencyReq = { 'dependency-id': string, 'dependent-id': string } // package.dependency.configure.dry
  export type DryConfigureDependencyRes = object


  // marketplace @TODO

  // export type GetVersionLatestReq = { }
  // export type GetVersionLatestRes = { versionLatest: string, releaseNotes: string }

  // export type GetAppAvailableReq = { }
  // export type GetAppAvailableRes = ApiAppAvailableFull

  // export type GetAppAvailableVersionInfoRes = AppAvailableVersionSpecificInfo
  // export type GetAppsAvailableRes = AppAvailablePreview[]
}

export type WithExpire<T> = { expireId?: string } & T
export type WithRevision<T> = { response: T, revision?: Revision }

export interface BreakageRes {
  patch: Operation[],
  breakages: Breakages
}

export interface Breakages {
  [id: string]: DependencyError
}

export interface Log {
  timestamp: string
  log: string
}

export interface ActionResponse {
  message: string
  value: string | number | boolean | null
  copyable: boolean
  qr: boolean
}

export interface ServerMetrics {
  [key: string]: {
    [key: string]: {
      value: string | number | null
      unit?: string
    }
  }
}

export interface DiskInfo {

}

export interface DiskInfoEntry {
  size: string
  description: string | null
  partitions: PartitionInfo
}

export interface PartitionInfo {
  [logicalname: string]: PartitionInfoEntry
}

export interface PartitionInfoEntry {
  'is-mounted': boolean // We do not allow backups to mounted partitions
  size: string | null
  label: string | null
}

export interface ServerSpecs {
  [key: string]: string | number
}

export interface SSHKeys {
  [hash: string]: SSHKeyEntry
}

export interface SSHKeyEntry {
  alg: string
  hostname: string
  pubkey: string
}

export interface ServerNotification {
  id: string
  'package-id': string | null
  createdAt: string
  code: string
  title: string
  message: string
}
