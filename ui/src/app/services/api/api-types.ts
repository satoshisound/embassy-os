import { Operation } from 'patch-db-client'
import { AppAvailablePreview, AppAvailableVersionSpecificInfo } from 'src/app/models/app-types'
import { AppPropertiesVersioned } from 'src/app/util/properties.util'

export type Unit = { never?: never; } // hack for the unit typ

export module ReqRes {
  // ** REST **

  export type LoginReq = { password: string }
  export type LoginRes = Unit

  export type LogoutReq = { }
  export type LogoutRes = Unit

  // server

  export type GetVersionReq = { }
  export type GetVersionRes = { version: string }

  export type GetServerLogsReq = { }
  export type GetServerLogsRes = string[]

  export type GetServerMetricsReq = { }
  export type GetServerMetricsRes = ServerMetrics

  export type RefreshLanReq = { }
  export type RefreshLanRes = Unit

  export type UpdateAgentReq = { version: string }
  export type UpdateAgentRes = Unit

  export type UpdateServerConfigReq = { value: string }
  export type UpdateServerConfigRes = Unit

  export type RestartServerReq = { }
  export type RestartServerRes = Unit

  export type ShutdownServerReq = { }
  export type ShutdownServerRes = Unit

  // ** RPC **

  export type GetAppPropertiesReq = { id: string }
  export type GetAppPropertiesRes = AppPropertiesVersioned<number>

  export type GetAppLogsReq = { id: string, before?: string }
  export type GetAppLogsRes = Log[]

  export type InstallAppReq = { id: string, version: string }
  export type InstallAppRes = Unit

  export type DryrunUpdateAppReq = { id: string, version: string }
  export type DryrunUpdateAppRes = { patch: Operation[], breakages: string[] }

  export type PostUpdateAppReq = { id: string, version: string }
  export type PostUpdateAppRes = Unit

  export type AppActionRequest = { id: string }
  export type AppActionResponse = string

  export type GetVersionLatestRes = { versionLatest: string, releaseNotes: string }
  export type GetAppAvailableRes = ApiAppAvailableFull
  export type GetAppAvailableVersionInfoRes = AppAvailableVersionSpecificInfo
  export type GetAppsAvailableRes = AppAvailablePreview[]
  export type GetExternalDisksRes = DiskInfo[]
  export type GetAppInstalledRes = ApiAppInstalledFull
  export type GetAppConfigRes = ApiAppConfig
  export type GetNotificationsReq = { page: string, perPage: string }
  export type GetNotificationsRes = S9Notification[]
  export type GetAppsInstalledRes = ApiAppInstalledPreview[]

  export type PostAppBackupCreateReq = { appId: string, logicalname: string, password: string }
  export type PostAppBackupCreateRes = Unit
  export type PostAppBackupRestoreReq = { appId: string, logicalname: string, password: string }
  export type PostAppBackupRestoreRes = Unit
  export type PostAppBackupStopRes = Unit
  export type PatchAppConfigReq = { appId: string, config: object, dryRun: boolean }
  export type PostAddWifiReq = { ssid: string, password: string, country: string, skipConnect: boolean }
  export type PostConnectWifiReq = { country: string }
  export type PostAddSSHKeyReq = { sshKey: string }
  export type PostAddSSHKeyRes = SSHFingerprint
}

export interface Log {
  timestamp: string
  log: string
}

export interface ServerMetrics {
  [key: string]: {
    [key: string]: {
      value: string | number | null
      unit?: string
    }
  }
}
