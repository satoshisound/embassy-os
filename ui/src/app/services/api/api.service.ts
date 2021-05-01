import { AppStatus, Rules } from '../../models/app-model'
import { AppAvailablePreview, AppAvailableFull, AppInstalledPreview, AppInstalledFull, DependentBreakage, AppAvailableVersionSpecificInfo, ServiceAction } from '../../models/app-types'
import { S9Notification, SSHFingerprint, DiskInfo } from '../../models/server-model'
import { Subject, Observable } from 'rxjs'
import { Unit, ApiServer, ReqRes } from './api-types'
import { AppMetrics } from 'src/app/util/metrics.util'
import { ConfigSpec } from 'src/app/app-config/config-types'
import { Http, PatchOp, SeqReplace, SeqUpdate, SeqUpdateReal, Source, SeqUpdateTemp } from 'patch-db-client'
import { DataModel } from 'src/app/models/patch-db/data-model'
import { filter } from 'rxjs/operators'
import * as uuid from 'uuid'

export type PatchPromise<T> = Promise<{ response: T, patch?: SeqUpdate<DataModel> }>

export abstract class ApiService implements Source<DataModel>, Http<DataModel> {
  protected readonly sync = new Subject<SeqUpdate<DataModel>>()
  private syncing = true

  /** PatchDb Source interface. Post/Patch requests provide a source of patches to the db. */
  // sequenceStream '_' is not used by the live api, but is overridden by the mock
  watch$ (_?: Observable<number>): Observable<SeqUpdate<DataModel>> {
    return this.sync.asObservable().pipe(filter(() => this.syncing))
  }

  /** PatchDb Http interface. We can use the apiService to poll for patches or fetch db dumps */
  abstract getUpdates (startSequence: number, finishSequence?: number): Promise<SeqUpdateReal<DataModel>[]>
  abstract getDump (): Promise<SeqReplace<DataModel>>

  private unauthorizedApiResponse$: Subject<{ }> = new Subject()
  constructor () { }

  watch401$ (): Observable<{ }> {
    return this.unauthorizedApiResponse$.asObservable()
  }

  authenticatedRequestsEnabled: boolean = false

  protected received401 () {
    this.authenticatedRequestsEnabled = false
    this.unauthorizedApiResponse$.next()
  }

  abstract postLogin (password: string): Promise<Unit> // Throws an error on failed auth.
  abstract postLogout (): Promise<Unit> // Throws an error on failed auth.
  abstract getServer (): Promise<ApiServer>
  abstract getVersionLatest (): Promise<ReqRes.GetVersionLatestRes>
  abstract getServerMetrics (): Promise<ReqRes.GetServerMetricsRes>
  abstract getNotifications (page: number, perPage: number): Promise<S9Notification[]>
  abstract getAvailableApps (): Promise<AppAvailablePreview[]>
  abstract getAvailableApp (appId: string): Promise<AppAvailableFull>
  abstract getAvailableAppVersionSpecificInfo (appId: string, versionSpec: string): Promise<AppAvailableVersionSpecificInfo>
  abstract getInstalledApp (appId: string): Promise<AppInstalledFull>
  abstract getAppMetrics (appId: string): Promise<AppMetrics>
  abstract getInstalledApps (): Promise<AppInstalledPreview[]>
  abstract getExternalDisks (): Promise<DiskInfo[]>
  abstract getAppConfig (appId: string): Promise<{ spec: ConfigSpec, config: object, rules: Rules[]}>
  abstract getAppLogs (appId: string, params?: ReqRes.GetAppLogsReq): Promise<string[]>
  abstract getServerLogs (): Promise<string[]>

  /** Any request which mutates state will return a PatchPromise: a patch to state along with the standard response. The syncResponse helper function syncs the patch and returns the response*/
  protected abstract deleteNotificationRaw (id: string): PatchPromise<Unit>
  deleteNotification = this.syncResponse((id: string) => this.deleteNotificationRaw(id))

  protected abstract toggleAppLANRaw (appId: string, toggle: 'enable' | 'disable'): PatchPromise<Unit>
  toggleAppLAN = this.syncResponse((appId: string, toggle: 'enable' | 'disable') => this.toggleAppLANRaw(appId, toggle))

  protected abstract updateAgentRaw (version: string): PatchPromise<Unit>
  updateAgent = this.syncResponse((version: string) => this.updateAgentRaw(version))

  protected abstract acknowledgeOSWelcomeRaw (version: string): PatchPromise<Unit>
  acknowledgeOSWelcome = this.syncResponse((version: string) => this.acknowledgeOSWelcomeRaw(version))

  protected abstract installAppRaw (appId: string, version: string, dryRun?: boolean): PatchPromise<AppInstalledFull & { breakages: DependentBreakage[] }>
  // An example of making a temp patch to the store when the request is made. syncResponse handles the expiration logic.
  installApp = this.syncResponse(
    (appId: string, version: string, dryRun?: boolean) => this.installAppRaw(appId, version, dryRun),
    (appId, _, dryRun) => {
      if (dryRun) return undefined
      //Unfortunately, this 'path' is not type safe.
      //We could consider a helper function with type safe path parameters like 'watch'?
      return { expiredBy: uuid.v4(), patch: [{ op: PatchOp.REPLACE, path: `apps/${appId}/status`, value: AppStatus.INSTALLING }] } as SeqUpdateTemp
    })

  protected abstract uninstallAppRaw (appId: string, dryRun?: boolean): PatchPromise<{ breakages: DependentBreakage[] }>
  uninstallApp = this.syncResponse((appId: string, dryRun?: boolean) => this.uninstallAppRaw(appId, dryRun))

  protected abstract startAppRaw (appId: string): PatchPromise<Unit>
  startApp = this.syncResponse((appId: string) => this.startAppRaw(appId))

  protected abstract stopAppRaw (appId: string, dryRun?: boolean): PatchPromise<{ breakages: DependentBreakage[] }>
  stopApp = this.syncResponse((appId: string, dryRun?: boolean) => this.stopAppRaw(appId, dryRun))

  protected abstract restartAppRaw (appId: string): PatchPromise<Unit>
  restartApp = this.syncResponse((appId: string) => this.restartAppRaw(appId))

  protected abstract createAppBackupRaw (appId: string, logicalname: string, password?: string): PatchPromise<Unit>
  createAppBackup = this.syncResponse((appId: string, logicalname: string, password?: string) => this.createAppBackupRaw(appId, logicalname, password))

  protected abstract restoreAppBackupRaw (appId: string, logicalname: string, password?: string): PatchPromise<Unit>
  restoreAppBackup = this.syncResponse((appId: string, logicalname: string, password?: string) => this.restoreAppBackupRaw(appId, logicalname, password))

  protected abstract stopAppBackupRaw (appId: string): PatchPromise<Unit>
  stopAppBackup = this.syncResponse((appId: string) => this.stopAppBackupRaw(appId))

  protected abstract patchAppConfigRaw (app: AppInstalledPreview, config: object, dryRun?: boolean): PatchPromise<{ breakages: DependentBreakage[] }>
  patchAppConfig = this.syncResponse((app: AppInstalledPreview, config: object, dryRun?: boolean) => this.patchAppConfigRaw(app, config, dryRun))

  protected abstract postConfigureDependencyRaw (dependencyId: string, dependentId: string, dryRun?: boolean): PatchPromise< { config: object, breakages: DependentBreakage[] }>
  postConfigureDependency = this.syncResponse((dependencyId: string, dependentId: string, dryRun?: boolean) => this.postConfigureDependencyRaw(dependencyId, dependentId, dryRun))

  protected abstract patchServerConfigRaw (attr: string, value: any): PatchPromise<Unit>
  patchServerConfig = this.syncResponse((attr: string, value: any) => this.patchServerConfigRaw(attr, value))

  protected abstract wipeAppDataRaw (app: AppInstalledPreview): PatchPromise<Unit>
  wipeAppData = this.syncResponse((app: AppInstalledPreview) => this.wipeAppDataRaw(app))

  protected abstract addSSHKeyRaw (sshKey: string): PatchPromise<Unit>
  addSSHKey = this.syncResponse(this.addSSHKeyRaw)

  protected abstract deleteSSHKeyRaw (sshKey: SSHFingerprint): PatchPromise<Unit>
  deleteSSHKey = this.syncResponse((sshKey: SSHFingerprint) => this.deleteSSHKeyRaw(sshKey))

  protected abstract addWifiRaw (ssid: string, password: string, country: string, connect: boolean): PatchPromise<Unit>
  addWifi = this.syncResponse((ssid: string, password: string, country: string, connect: boolean) => this.addWifiRaw(ssid, password, country, connect))

  protected abstract connectWifiRaw (ssid: string): PatchPromise<Unit>
  connectWifi = this.syncResponse((ssid: string) => this.connectWifiRaw(ssid))

  protected abstract deleteWifiRaw (ssid: string): PatchPromise<Unit>
  deleteWifi = this.syncResponse((ssid: string) => this.deleteWifiRaw(ssid))

  protected abstract restartServerRaw (): PatchPromise<Unit>
  restartServer = this.syncResponse(() => this.restartServerRaw())

  protected abstract shutdownServerRaw (): PatchPromise<Unit>
  shutdownServer = this.syncResponse(() => this.shutdownServerRaw())

  protected abstract ejectExternalDiskRaw (logicalname: string): PatchPromise<Unit>
  ejectExternalDisk = this.syncResponse((logicalname: string) => this.ejectExternalDiskRaw(logicalname))

  protected abstract serviceActionRaw (appId: string, serviceAction: ServiceAction): PatchPromise<ReqRes.ServiceActionResponse>
  serviceAction = this.syncResponse((appId: string, serviceAction: ServiceAction) => this.serviceActionRaw(appId, serviceAction))

  protected abstract refreshLanRaw (): PatchPromise<Unit>
  refreshLan = this.syncResponse(() => this.refreshLanRaw())

  // Helper allowing quick decoration to sync the response patch and return the response contents.
  // Pass in a tempUpdate function which returns a SeqUpdateTemp corresponding to a temporary
  // state change you'd like to enact prior to request and expired when request terminates.
  private syncResponse<T extends (...args: any[]) => PatchPromise<any>> (f: T, tempUpdate?: (...args: Parameters<T>) => SeqUpdateTemp | undefined): (...args: Parameters<T>) => ExtractResultPromise<ReturnType<T>> {
    console.log('function', f)
    console.log('temp', tempUpdate)

    return (...a) => {
      console.log('aaa', a)
      let expireId = undefined
      if (tempUpdate) {
        const tempPatch = tempUpdate(...a)
        if (tempPatch) {
          expireId = tempPatch.expiredBy
          this.sync.next(tempPatch)
        }
      }

      return f(a).then(({ response, patch }) => {
        console.log('response', response)
        console.log('patch', patch)
        if (expireId) patch = { ...patch, expireId }
        if (patch) this.sync.next(patch)
        return response
      }) as any
   }
  }
}
// used for type inference in syncResponse
type ExtractResultPromise<T extends PatchPromise<any>> = T extends PatchPromise<infer R> ? Promise<R> : any


export function isRpcFailure<Error, Result> (arg: { error: Error } | { result: Result}): arg is { error: Error } {
  return !!(arg as any).error
}

export function isRpcSuccess<Error, Result> (arg: { error: Error } | { result: Result}): arg is { result: Result } {
  return !!(arg as any).result
}
