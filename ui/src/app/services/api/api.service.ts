import { Subject, Observable } from 'rxjs'
import { Http, Source, Update, Operation } from 'patch-db-client'
import { RR } from './api-types'
import { DataModel } from 'src/app/models/patch-db/data-model'
import { filter } from 'rxjs/operators'
import * as uuid from 'uuid'

export abstract class ApiService implements Source<DataModel>, Http<DataModel> {
  protected readonly sync = new Subject<Update<DataModel>>()
  private syncing = true

  /** PatchDb Source interface. Post/Patch requests provide a source of patches to the db. */
  // sequenceStream '_' is not used by the live api, but is overridden by the mock
  watch$ (_?: Observable<number>): Observable<Update<DataModel>> {
    return this.sync.asObservable().pipe(filter(() => this.syncing))
  }

  // db

  abstract getRevisions (since: number): Promise<RR.GetRevisionsRes>

  abstract getDump (): Promise<RR.GetDumpRes>

  protected abstract setDbValueRaw (params: RR.SetDBValueReq): Promise<RR.SetDBValueRes>
  setDbValue = (params: RR.SetDBValueReq) => this.syncResponse(
    () => this.setDbValueRaw(params),
  )()

  // auth

  abstract login (params: RR.LoginReq): Promise<RR.LoginRes>

  abstract logout (params: RR.LogoutReq): Promise<RR.LogoutRes>

  // server

  abstract getServerLogs (params: RR.GetServerLogsReq): Promise<RR.GetServerLogsRes>

  abstract getServerMetrics (params: RR.GetServerMetricsReq): Promise<RR.GetServerMetricsRes>

  protected abstract updateServerRaw (params: RR.UpdateServerReq): Promise<RR.UpdateServerRes>
  updateServer = (params: RR.UpdateServerReq) => this.syncResponse(
    () => this.updateServerRaw(params),
  )()

  abstract restartServer (params: RR.UpdateServerReq): Promise<RR.RestartServerRes>

  abstract shutdownServer (params: RR.ShutdownServerReq): Promise<RR.ShutdownServerRes>

  // network

  abstract refreshLan (params: RR.RefreshLanReq): Promise<RR.RefreshLanRes>

  // notification

  abstract getNotifications (params: RR.GetNotificationsReq): Promise<RR.GetNotificationsRes>

  abstract deleteNotification (params: RR.DeleteNotificationReq): Promise<RR.DeleteNotificationRes>

  // wifi

  abstract getWifi (params: RR.GetWifiReq): Promise<RR.GetWifiRes>

  abstract addWifi (params: RR.AddWifiReq): Promise<RR.AddWifiRes>

  protected abstract connectWifiRaw (params: RR.ConnectWifiReq): Promise<RR.ConnectWifiRes>
  connectWifi = (params: RR.ConnectWifiReq) => this.syncResponse(
    () => this.connectWifiRaw(params),
  )()

  protected abstract deleteWifiRaw (params: RR.DeleteWifiReq): Promise<RR.ConnectWifiRes>
  deleteWifi = (params: RR.DeleteWifiReq) => this.syncResponse(
    () => this.deleteWifiRaw(params),
  )()

  // ssh

  abstract getSshKeysRaw (params: RR.GetSSHKeysReq): Promise<RR.GetSSHKeysRes>

  abstract addSshKeyRaw (params: RR.AddSSHKeyReq): Promise<RR.AddSSHKeyRes>

  abstract deleteSshKeyRaw (params: RR.DeleteSSHKeyReq): Promise<RR.DeleteSSHKeyRes>

  // backup

  protected abstract createBackupRaw (params: RR.CreateBackupReq): Promise<RR.CreateBackupRes>
  createBackup = (params: RR.CreateBackupReq) => this.syncResponse(
    () => this.createBackupRaw(params),
  )()

  protected abstract restoreBackupRaw (params: RR.RestoreBackupReq): Promise<RR.RestoreBackupRes>
  restoreBackup = (params: RR.RestoreBackupReq) => this.syncResponse(
    () => this.restoreBackupRaw(params),
  )()

  // disk

  abstract getDisks (params: RR.GetDisksReq): Promise<RR.GetDisksRes>

  abstract ejectDisk (params: RR.EjectDisksReq): Promise<RR.EjectDisksRes>

  // package

  abstract getPackageInstructions (params: RR.GetPackageInstructionsReq): Promise<RR.GetPackageInstructionsRes>

  abstract getPackageProperties (params: RR.GetPackagePropertiesReq): Promise<RR.GetPackagePropertiesRes>

  abstract getPackageLogs (params: RR.GetPackageLogsReq): Promise<RR.GetPackageLogsRes>

  protected abstract installPackageRaw (params: RR.InstallPackageReq): Promise<RR.InstallPackageRes>
  installPackage = (params: RR.InstallPackageReq) => this.syncResponse(
    () => this.installPackageRaw(params),
  )()

  abstract dryUpdatePackage (params: RR.DryUpdatePackageReq): Promise<RR.DryUpdatePackageRes>

  protected abstract updatePackageRaw (params: RR.UpdatePackageReq): Promise<RR.UpdatePackageRes>
  updatePackage = (params: RR.UpdatePackageReq) => this.syncResponse(
    () => this.installPackageRaw(params),
  )()

  abstract getPackageConfig (params: RR.GetPackageConfigReq): Promise<RR.GetPackageConfigRes>

  abstract drySetPackageConfig (params: RR.DrySetPackageConfigReq): Promise<RR.DrySetPackageConfigRes>

  protected abstract setPackageConfigRaw (params: RR.SetPackageConfigReq): Promise<RR.SetPackageConfigRes>
  setPackageConfig = (params: RR.SetPackageConfigReq) => this.syncResponse(
    () => this.setPackageConfigRaw(params),
  )()

  protected abstract restorePackageRaw (params: RR.RestorePackageReq): Promise<RR.RestorePackageRes>
  restorePackage = (params: RR.RestorePackageReq) => this.syncResponse(
    () => this.restorePackageRaw(params),
  )()

  abstract executePackageAction (params: RR.ExecutePackageActionReq): Promise<RR.ExecutePackageActionRes>

  protected abstract startPackageRaw (params: RR.StartPackageReq): Promise<RR.StartPackageRes>
  startPackage = (params: RR.StartPackageReq) => this.syncResponse(
    () => this.startPackageRaw(params),
  )()

  abstract dryStopPackage (params: RR.DryStopPackageReq): Promise<RR.DryStopPackageRes>

  protected abstract stopPackageRaw (params: RR.StopPackageReq): Promise<RR.StopPackageRes>
  stopPackage = (params: RR.StopPackageReq) => this.syncResponse(
    () => this.stopPackageRaw(params),
  )()

  abstract dryRemovePackage (params: RR.DryRemovePackageReq): Promise<RR.DryRemovePackageRes>

  protected abstract removePackageRaw (params: RR.RemovePackageReq): Promise<RR.RemovePackageRes>
  removePackage = (params: RR.RemovePackageReq) => this.syncResponse(
    () => this.removePackageRaw(params),
  )()

  abstract dryConfigureDependency (params: RR.DryConfigureDependencyReq): Promise<RR.DryConfigureDependencyRes>


  // abstract getVersionLatest (params: RR.GetVersionLatestReq): Promise<RR.GetVersionLatestRes>
  // abstract getAvailableApps (): Promise<AppAvailablePreview[]>
  // abstract getAvailableApp (appId: string): Promise<AppAvailableFull>
  // abstract getAvailableAppVersionSpecificInfo (appId: string, versionSpec: string): Promise<AppAvailableVersionSpecificInfo>

  // Helper allowing quick decoration to sync the response patch and return the response contents.
  // Pass in a tempUpdate function which returns a UpdateTemp corresponding to a temporary
  // state change you'd like to enact prior to request and expired when request terminates.
  private syncResponse<T extends (...args: any[]) => Promise<any>> (f: T, temp?: Operation): (...args: Parameters<T>) => ExtractResultPromise<ReturnType<T>> {
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
type ExtractResultPromise<T extends Promise<any>> = T extends Promise<infer R> ? Promise<R> : any
