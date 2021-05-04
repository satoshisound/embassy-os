import { ConfigSpec } from 'src/app/app-config/config-types'
import { AppAvailableFull, AppAvailablePreview, AppAvailableVersionSpecificInfo, AppInstalledFull, AppInstalledPreview, DependentBreakage } from 'src/app/models/app-types'
import { AppMetricsVersioned } from 'src/app/util/metrics.util'
import { Rules } from '../../models/app-model'
import { SSHFingerprint, ServerStatus, ServerSpecs, DiskInfo, ServerMetrics, S9Notification } from '../../models/server-model'
import { RPCRequest, RPCSuccess } from '../http.service'

/** SERVER **/

export interface ApiServer {
  serverId: string
  name: string
  versionInstalled: string
  status: ServerStatus
  altRegistryUrl: string | null
  specs: ServerSpecs
  wifi: WiFi
  ssh: SSHFingerprint[]
  notifications: S9Notification[]
  welcomeAck: boolean
  autoCheckUpdates: boolean
}

export interface WiFi {
  ssids: string[]
  current: string | null
}

/** APPS **/
export type ApiAppAvailableFull = Omit<AppAvailableFull, 'versionViewing'>

export type ApiAppInstalledPreview = Omit<AppInstalledPreview, 'hasUI' | 'launchable'>
export type ApiAppInstalledFull = Omit<AppInstalledFull, 'hasFetchedFull' | 'hasUI' | 'launchable'>

export interface ApiAppConfig {
  spec: ConfigSpec
  config: object | null
  rules: Rules[]
}

/** MISC **/

export type Unit = { never?: never; } // hack for the unit typ

// Can add types here if inlining them is too fat.
export module ReqRes {
  export type GetVersionRes = { version: string }
  export type PostLoginReq = { password: string }
  export type PostLoginRes = Unit
  export type AppActionRequest = { }
  export type AppActionResponse = string
  export type GetServerRes = ApiServer
  export type GetVersionLatestRes = { versionLatest: string, releaseNotes: string }
  export type GetServerMetricsRes = ServerMetrics
  export type GetAppAvailableRes = ApiAppAvailableFull
  export type GetAppAvailableVersionInfoRes = AppAvailableVersionSpecificInfo
  export type GetAppsAvailableRes = AppAvailablePreview[]
  export type GetExternalDisksRes = DiskInfo[]
  export type GetAppInstalledRes = ApiAppInstalledFull
  export type GetAppConfigRes = ApiAppConfig
  export type GetAppLogsReq = { appId: string, after?: string, before?: string, page?: string, perPage?: string }
  export type GetServerLogsReq = { }
  export type GetAppLogsRes = string[]
  export type GetServerLogsRes = string[]
  export type GetNotificationsReq = { page: string, perPage: string }
  export type GetNotificationsRes = S9Notification[]
  export type GetAppMetricsRes = AppMetricsVersioned<number>
  export type GetAppsInstalledRes = ApiAppInstalledPreview[]
  export type PostInstallAppReq = { appId: string, version: string, dryRun: boolean }
  export type PostInstallAppRes = ApiAppInstalledFull & { breakages: DependentBreakage[] }
  export type PostUpdateAgentReq = { version: string }
  export type PostAppBackupCreateReq = { appId: string, logicalname: string, password: string }
  export type PostAppBackupCreateRes = Unit
  export type PostAppBackupRestoreReq = { appId: string, logicalname: string, password: string }
  export type PostAppBackupRestoreRes = Unit
  export type PostAppBackupStopRes = Unit
  export type PatchAppConfigReq = { appId: string, config: object, dryRun: boolean }
  export type PatchServerConfigReq = { value: string }
  export type PostAddWifiReq = { ssid: string, password: string, country: string, skipConnect: boolean }
  export type PostConnectWifiReq = { country: string }
  export type PostAddSSHKeyReq = { sshKey: string }
  export type PostAddSSHKeyRes = SSHFingerprint
}
