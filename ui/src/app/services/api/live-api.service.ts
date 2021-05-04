import { Injectable } from '@angular/core'
import { HttpService, Method } from '../http.service'
import { AppAvailablePreview, AppAvailableFull, AppInstalledFull, AppInstalledPreview, DependentBreakage, AppAvailableVersionSpecificInfo, AppAction } from '../../models/app-types'
import { S9Notification, SSHFingerprint, DiskInfo } from '../../models/server-model'
import { ApiService, PatchPromise  } from './api.service'
import { ReqRes, Unit } from './api-types'
import { Replace } from 'src/app/util/types.util'
import { AppMetrics, parseMetricsPermissive } from 'src/app/util/metrics.util'
import { Revision, Dump } from 'patch-db-client'
import { DataModel } from 'src/app/models/patch-db/data-model'
import { ConfigService } from '../config.service'

@Injectable()
export class LiveApiService extends ApiService {
  constructor (
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) { super() }

  // **** REST ****

  // auth

  async login (password: string): Promise<Unit> {
    return this.http.restRequest<Unit>({ method: Method.POST, url: '/auth/login', data: { password } }, '', false)
  }

  async logout (): Promise<Unit> {
    // @TODO should this be versioned?
    await this.http.restRequest<Unit>({ method: Method.POST, url: '/auth/logout' }, '')
    this.http.authReqEnabled = false
    return { }
  }

  // server

  async getVersionLatest (): Promise<ReqRes.GetVersionLatestRes> {
    return this.http.restRequest({ method: Method.GET, url: '/versionLatest' }, '')
  }

  async getServerLogs (): Promise<string[]> {
    return this.http.restRequest<ReqRes.GetServerLogsRes>( { method: Method.GET, url: `/logs` })
  }

  async getServerMetrics (): Promise<ReqRes.GetServerMetricsRes> {
    return this.http.restRequest({ method: Method.GET, url: `/metrics` })
  }

  async refreshLanRaw (): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.POST, url: '/network/lan/reset' })
  }

  async updateAgentRaw (version: string): PatchPromise<Unit> {
    const data: ReqRes.PostUpdateAgentReq = {
      version: `=${version}`,
    }
    return this.http.restRequest({ method: Method.POST, url: '/update', data })
  }

  async patchServerConfigRaw (attr: string, value: any): PatchPromise<Unit> {
    const data: ReqRes.PatchServerConfigReq = {
      value,
    }
    return this.http.restRequest({ method: Method.PATCH, url: `/${attr}`, data })
  }

  async restartServerRaw (): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.POST, url: '/restart' })
  }

  async shutdownServerRaw (): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.POST, url: '/shutdown' })
  }

  // notifications

  async getNotifications (page: number, perPage: number): Promise<S9Notification[]> {
    const params: ReqRes.GetNotificationsReq = {
      page: String(page),
      perPage: String(perPage),
    }
    return this.http.restRequest({ method: Method.GET, url: `/notifications`, params })
  }

  async deleteNotificationRaw (id: string): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.DELETE, url: `/notifications/${id}` })
  }

  // ssh

  async addSSHKeyRaw (sshKey: string): PatchPromise<Unit> {
    const data: ReqRes.PostAddSSHKeyReq = {
      sshKey,
    }
    return this.http.restRequest({ method: Method.POST, url: '/sshKeys', data })
  }

  async deleteSSHKeyRaw (fingerprint: SSHFingerprint): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.DELETE, url: `/sshKeys/${fingerprint.hash}` })
  }

  // wifi

  async addWifiRaw (ssid: string, password: string, country: string, connect: boolean): PatchPromise<Unit> {
    const data: ReqRes.PostAddWifiReq = {
      ssid,
      password,
      country,
      skipConnect: !connect,
    }
    return this.http.restRequest({ method: Method.POST, url: `/wifi`, data })
  }

  async connectWifiRaw (ssid: string): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.POST, url: encodeURI(`/wifi/${ssid}`) })
  }

  async deleteWifiRaw (ssid: string): PatchPromise<Unit> {
    return this.http.restRequest({ method: Method.DELETE, url: encodeURI(`/wifi/${ssid}`) })
  }

  // **** RPC ****

  // patchDB

  async getRevisions (since: number): Promise<Revision[]> {
    return this.http.rpcRequest({ method: 'db.revisions', params: { since } })
  }

  async getDump (): Promise<Dump<DataModel>> {
    return this.http.rpcRequest({ method: 'db.dump' })
  }

  async acknowledgeOSWelcomeRaw (version: string): PatchPromise<Unit> {
    return this.http.rpcRequest({ method: 1, params: { version } })
  }

  // drives

  async getExternalDisks (): Promise<DiskInfo[]> {
    return this.http.rpcRequest<ReqRes.GetExternalDisksRes>({ method: 1 })
  }

  async ejectExternalDiskRaw (logicalName: string): PatchPromise<Unit> {
    return this.http.rpcRequest({ method: 1, params: { logicalName } })
  }

  // apps available

  async getAvailableApps (): Promise<AppAvailablePreview[]> {
    const res = await this.http.rpcRequest<ReqRes.GetAppsAvailableRes>({ method: 1 })
    return res.map(a => {
      const latestVersionTimestamp = new Date(a.latestVersionTimestamp)
      if (isNaN(latestVersionTimestamp as any)) throw new Error(`Invalid latestVersionTimestamp ${a.latestVersionTimestamp}`)
      return { ...a, latestVersionTimestamp }
    })
  }

  async getAvailableApp (appId: string): Promise<AppAvailableFull> {
    return this.http.rpcRequest<ReqRes.GetAppAvailableRes>({ method: 1, params: { appId } })
      .then(res => {
        return {
          ...res,
          versionViewing: res.versionLatest,
        }
      })
  }

  async getAvailableAppVersionSpecificInfo (appId: string, versionSpec: string): Promise<AppAvailableVersionSpecificInfo> {
    return this.http.rpcRequest<Replace<ReqRes.GetAppAvailableVersionInfoRes, 'versionViewing', 'version'>>( { method: 1, params: { appId, versionSpec } })
      .then(res => ({ ...res, versionViewing: res.version }))
      .then(res => {
        delete res['version']
        return res
       })
  }

  // apps installed

  async getInstalledApps (): Promise<AppInstalledPreview[]> {
    return this.http.rpcRequest<ReqRes.GetAppsInstalledRes>({ method: 1 })
      .then(apps => {
        return apps.map(app => {
          return {
            ...app,
            hasUI: this.config.hasUI(app),
            launchable: this.config.isLaunchable(app),
          }
        })
      })
  }

  async getInstalledApp (appId: string): Promise<AppInstalledFull> {
    return this.http.rpcRequest<ReqRes.GetAppInstalledRes>({ method: 1, params: { appId } })
      .then(app => {
        return {
          ...app,
          hasFetchedFull: true,
          hasUI: this.config.hasUI(app),
          launchable: this.config.isLaunchable(app),
        }
      })
  }

  async getAppMetrics (appId: string): Promise<AppMetrics> {
    // @TODO don't need backwards compat anymore
    return this.http.rpcRequest<ReqRes.GetAppMetricsRes>( { method: 1, params: { appId } })
      .then(parseMetricsPermissive)
  }

  async getAppLogs (appId: string, params: Omit<ReqRes.GetAppLogsReq, 'appId'> = { }): Promise<string[]> {
    return this.http.rpcRequest<ReqRes.GetAppLogsRes>( { method: 1, params: { ...params, appId } })
  }

  async installAppRaw (appId: string, version: string, dryRun: boolean = false): PatchPromise<AppInstalledFull & { breakages: DependentBreakage[] }> {
    const params: ReqRes.PostInstallAppReq = {
      appId,
      version,
      dryRun,
    }
    return this.http.rpcRequest({ method: 1, params })
      .then(({ patch, response }) => ({ patch, response: { ...response, hasFetchedFull: false }}))
  }

  async uninstallAppRaw (appId: string, dryRun: boolean = false): PatchPromise<{ breakages: DependentBreakage[] }> {
    return this.http.rpcRequest({ method: 1, params: { appId, dryRun } })
  }

  async startAppRaw (appId: string): PatchPromise<Unit> {
    return this.http.rpcRequest({ method: 1, params: { appId } })
  }

  async stopAppRaw (appId: string, dryRun: boolean = false): PatchPromise<{ breakages: DependentBreakage[] }> {
    return this.http.rpcRequest({ method: 1, params: { appId, dryRun } })
  }

  async restartAppRaw (appId: string): PatchPromise<Unit> {
    return this.http.rpcRequest({ method: 1, params: { appId } })
  }

  // backups

  async createAppBackupRaw (appId: string, logicalname: string, password?: string): PatchPromise<Unit> {
    const params: ReqRes.PostAppBackupCreateReq = {
      appId,
      password: password || undefined,
      logicalname,
    }
    return this.http.rpcRequest({ method: 1, params })
  }

  async stopAppBackupRaw (appId: string): PatchPromise<Unit> {
    return this.http.rpcRequest({ method: 1, params: { appId } })
  }

  async restoreAppBackupRaw (appId: string, logicalname: string, password?: string): PatchPromise<Unit> {
    const params: ReqRes.PostAppBackupRestoreReq = {
      appId,
      password: password || undefined,
      logicalname,
    }
    return this.http.rpcRequest({ method: 1, params })
  }

  // config

  async getAppConfig (appId: string): Promise<ReqRes.GetAppConfigRes> {
    return this.http.rpcRequest<ReqRes.GetAppConfigRes>({ method: 1, params: { appId } })
  }

  async patchAppConfigRaw (appId: string, config: object, dryRun = false): PatchPromise<{ breakages: DependentBreakage[] }> {
    const params: ReqRes.PatchAppConfigReq = {
      appId,
      config,
      dryRun,
    }
    return this.http.rpcRequest({ method: 1, params })
  }

  async postConfigureDependencyRaw (dependencyId: string, dependentId: string, dryRun = true): PatchPromise<{ config: object, breakages: DependentBreakage[] }> {
    const params = {
      dependencyId,
      dependentId,
      dryRun,
    }
    return this.http.rpcRequest({ method: 1, params })
  }

  async appActionRaw (appId: string, action: AppAction): PatchPromise<string> {
    return this.http.rpcRequest({ method: 1, params: { ...action, appId } })
  }
}
