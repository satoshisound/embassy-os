import { AppAvailablePreview, AppAvailableFull, DependentBreakage, AppAvailableVersionSpecificInfo, AppAction } from '../../models/app-types'
import { Subject, Observable } from 'rxjs'
import { ReqRes, ServerMetrics, Unit } from './api-types'
import { AppProperties } from 'src/app/util/properties.util'
import { ConfigSpec } from 'src/app/app-config/config-types'
import { Http, Source, Dump, Update, Operation, Revision } from 'patch-db-client'
import { Action, DataModel, ServerNotification, SSHFingerprint } from 'src/app/models/patch-db/data-model'
import { filter } from 'rxjs/operators'
import * as uuid from 'uuid'

export type PatchPromise<T> = Promise<{ response: T, revision?: Revision }>

export abstract class ApiService implements Source<DataModel>, Http<DataModel> {
  constructor () { }

  protected readonly sync = new Subject<Update<DataModel>>()
  private syncing = true

  /** PatchDb Source interface. Post/Patch requests provide a source of patches to the db. */
  // sequenceStream '_' is not used by the live api, but is overridden by the mock
  watch$ (_?: Observable<number>): Observable<Update<DataModel>> {
    return this.sync.asObservable().pipe(filter(() => this.syncing))
  }

  // ** REST **

  // auth
  abstract login (password: string): Promise<Unit>
  abstract logout (): Promise<Unit>

  // server
  abstract getVersionLatest (): Promise<{ versionLatest: string, releaseNotes: string }>
  abstract getServerLogs (): Promise<string[]>
  abstract getServerMetrics (): Promise<ServerMetrics>
  abstract getNotifications (page: number, perPage: number): Promise<ServerNotification[]>
  abstract deleteNotification (id: string): Promise<Unit>

  // ** RPC **

  abstract getRevisions (since: number): Promise<Revision[] | Dump<DataModel>>
  abstract getDump (): Promise<Dump<DataModel>>
  abstract getExternalDisks (): Promise<DiskInfo[]>
  abstract getAvailableApps (): Promise<AppAvailablePreview[]>
  abstract getAvailableApp (appId: string): Promise<AppAvailableFull>
  abstract getAvailableAppVersionSpecificInfo (appId: string, versionSpec: string): Promise<AppAvailableVersionSpecificInfo>
  abstract getAppProperties (appId: string): Promise<AppProperties>
  abstract getAppLogs (id: string, before?: string): Promise<ReqRes.GetAppLogsRes>
  abstract getAppConfig (appId: string): Promise<{ spec: ConfigSpec, config: object, rules: Rules[]}>

  protected abstract updateAgentRaw (version: string): PatchPromise<Unit>
  updateAgent = (version: string) => this.syncResponse(
    () => this.updateAgentRaw(version),
  )()

  protected abstract acknowledgeOSWelcomeRaw (version: string): PatchPromise<Unit>
  acknowledgeOSWelcome = (version: string) => this.syncResponse(
    () => this.acknowledgeOSWelcomeRaw(version),
  )()

  protected abstract installAppRaw (id: string, version: string): PatchPromise<Unit>
  installApp = (id: string, version: string) => this.syncResponse(
    () => this.installAppRaw(id, version),
  )()

  protected abstract dryrunUpdateAppRaw (id: string, version: string): PatchPromise<ReqRes.DryrunUpdateAppRes>
  dryrunUpdateApp = (id: string, version: string) => this.syncResponse(
    () => this.installAppRaw(id, version),
  )()

  protected abstract updateAppRaw (id: string, version: string): PatchPromise<Unit>
  updateApp = (id: string, version: string) => this.syncResponse(
    () => this.installAppRaw(id, version),
  )()

  protected abstract uninstallAppRaw (appId: string, dryRun?: boolean): PatchPromise<{ breakages: DependentBreakage[] }>
  uninstallApp = (appId: string, dryRun?: boolean) => this.syncResponse(
    () => this.uninstallAppRaw(appId, dryRun),
  )()

  protected abstract startAppRaw (appId: string): PatchPromise<Unit>
  startApp = (appId: string) => this.syncResponse(
    () => this.startAppRaw(appId),
  )()

  protected abstract stopAppRaw (appId: string, dryRun?: boolean): PatchPromise<{ breakages: DependentBreakage[] }>
  stopApp = (appId: string, dryRun?: boolean) => this.syncResponse(
    () => this.stopAppRaw(appId, dryRun),
  )()

  protected abstract restartAppRaw (appId: string): PatchPromise<Unit>
  restartApp = (appId: string) => this.syncResponse(
    () => this.restartAppRaw(appId),
  )()

  protected abstract executeActionRaw (appId: string, action: Action): PatchPromise<string>
  executeAction = (appId: string, action: Action) => this.syncResponse(
    () => this.executeActionRaw(appId, action),
  )()

  protected abstract createAppBackupRaw (appId: string, logicalname: string, password?: string): PatchPromise<Unit>
  createAppBackup = (appId: string, logicalname: string, password?: string) => this.syncResponse(
    () => this.createAppBackupRaw(appId, logicalname, password),
  )()

  protected abstract restoreAppBackupRaw (appId: string, logicalname: string, password?: string): PatchPromise<Unit>
  restoreAppBackup = (appId: string, logicalname: string, password?: string) => this.syncResponse(
    () => this.restoreAppBackupRaw(appId, logicalname, password),
  )()

  protected abstract stopAppBackupRaw (appId: string): PatchPromise<Unit>
  stopAppBackup = (appId: string) => this.syncResponse(
    () => this.stopAppBackupRaw(appId),
  )()

  protected abstract patchAppConfigRaw (appId: string, config: object, dryRun?: boolean): PatchPromise<{ breakages: DependentBreakage[] }>
  patchAppConfig = (appId: string, config: object, dryRun?: boolean) => this.syncResponse(
    () => this.patchAppConfigRaw(appId, config, dryRun),
  )()

  protected abstract postConfigureDependencyRaw (dependencyId: string, dependentId: string, dryRun?: boolean): PatchPromise< { config: object, breakages: DependentBreakage[] }>
  postConfigureDependency = (dependencyId: string, dependentId: string, dryRun?: boolean) => this.syncResponse(
    () => this.postConfigureDependencyRaw(dependencyId, dependentId, dryRun),
  )()

  protected abstract patchServerConfigRaw (attr: string, value: any): PatchPromise<Unit>
  patchServerConfig = (attr: string, value: any) => this.syncResponse(
    () => this.patchServerConfigRaw(attr, value),
  )()

  protected abstract ejectExternalDiskRaw (logicalname: string): PatchPromise<Unit>
  ejectExternalDisk = (logicalname: string) => this.syncResponse(
    () => this.ejectExternalDiskRaw(logicalname),
  )()

  protected abstract refreshLanRaw (): PatchPromise<Unit>
  refreshLan = () => this.syncResponse(
    () => this.refreshLanRaw(),
  )

  protected abstract addSSHKeyRaw (sshKey: string): PatchPromise<Unit>
  addSSHKey = (sshKey: string) => this.syncResponse(
    () => this.addSSHKeyRaw(sshKey),
  )()

  protected abstract deleteSSHKeyRaw (fingerprint: SSHFingerprint): PatchPromise<Unit>
  deleteSSHKey = (fingerprint: SSHFingerprint, temp: Operation) => this.syncResponse(
    () => this.deleteSSHKeyRaw(fingerprint),
    temp,
  )()

  protected abstract addWifiRaw (ssid: string, password: string, country: string, connect: boolean): PatchPromise<Unit>
  addWifi = (ssid: string, password: string, country: string, connect: boolean) => this.syncResponse(
    () => this.addWifiRaw(ssid, password, country, connect),
  )()

  protected abstract connectWifiRaw (ssid: string): PatchPromise<Unit>
  connectWifi = (ssid: string) => this.syncResponse(
    () => this.connectWifiRaw(ssid),
  )()

  protected abstract deleteWifiRaw (ssid: string): PatchPromise<Unit>
  deleteWifi = (ssid: string) => this.syncResponse(
    () => this.deleteWifiRaw(ssid),
  )()

  protected abstract restartServerRaw (): PatchPromise<Unit>
  restartServer = () => this.syncResponse(
    () => this.restartServerRaw(),
  )()

  protected abstract shutdownServerRaw (): PatchPromise<Unit>
  shutdownServer = () => this.syncResponse(
    () => this.shutdownServerRaw(),
  )()

  // Helper allowing quick decoration to sync the response patch and return the response contents.
  // Pass in a tempUpdate function which returns a UpdateTemp corresponding to a temporary
  // state change you'd like to enact prior to request and expired when request terminates.
  private syncResponse<T extends (...args: any[]) => PatchPromise<any>> (f: T, temp?: Operation): (...args: Parameters<T>) => ExtractResultPromise<ReturnType<T>> {
    return (...a) => {
      let expireId = undefined
      if (temp) {
        expireId = uuid.v4()
        this.sync.next({ patch: [temp], expiredBy: expireId })
      }

      return f(a).then(({ response, revision }) => {
        if (revision) this.sync.next(revision)
        return response
      }) as any
    }
  }
}
// used for type inference in syncResponse
type ExtractResultPromise<T extends PatchPromise<any>> = T extends PatchPromise<infer R> ? Promise<R> : any
