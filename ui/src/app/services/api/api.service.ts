import { Subject, Observable } from 'rxjs'
import { Http, Source, Update, Operation, Revision } from 'patch-db-client'
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

  // used for determining internet connectivity
  abstract ping (): Promise<void>

  // for getting static files: ex icons, instructions, licenses
  abstract getStatic (url: string): Promise<string>

  // db

  abstract getRevisions (since: number): Promise<RR.GetRevisionsRes>

  abstract getDump (): Promise<RR.GetDumpRes>

  protected abstract setDbValueRaw (params: RR.SetDBValueReq): Promise<RR.SetDBValueRes>
  setDbValue = (params: RR.SetDBValueReq) => this.syncResponse(
    () => this.setDbValueRaw(params),
  )()

  // auth

  abstract submitPin (params: RR.SubmitPinReq): Promise<RR.SubmitPinRes>

  abstract submitPassword (params: RR.SubmitPasswordReq): Promise<RR.SubmitPasswordReq>

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

  // registry

  protected abstract setRegistryRaw (params: RR.SetRegistryReq): Promise<RR.SetRegistryRes>
  setRegistry = (params: RR.SetRegistryReq) => this.syncResponse(
    () => this.setRegistryRaw(params),
  )()

  // notification

  abstract getNotificationsRaw (params: RR.GetNotificationsReq): Promise<RR.GetNotificationsRes>
  getNotifications = (params: RR.GetNotificationsReq) => this.syncResponse<RR.GetNotificationsRes['response'], any>(
    () => this.getNotificationsRaw(params),
  )()

  abstract deleteNotification (params: RR.DeleteNotificationReq): Promise<RR.DeleteNotificationRes>

  // wifi

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

  abstract getSshKeys (params: RR.GetSSHKeysReq): Promise<RR.GetSSHKeysRes>

  abstract addSshKey (params: RR.AddSSHKeyReq): Promise<RR.AddSSHKeyRes>

  abstract deleteSshKey (params: RR.DeleteSSHKeyReq): Promise<RR.DeleteSSHKeyRes>

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

  abstract getPackageProperties (params: RR.GetPackagePropertiesReq): Promise<RR.GetPackagePropertiesRes<any>['data']>

  abstract getPackageLogs (params: RR.GetPackageLogsReq): Promise<RR.GetPackageLogsRes>

  protected abstract installPackageRaw (params: RR.InstallPackageReq): Promise<RR.InstallPackageRes>
  installPackage = (params: RR.InstallPackageReq) => this.syncResponse(
    () => this.installPackageRaw(params),
  )()

  abstract dryUpdatePackage (params: RR.DryUpdatePackageReq): Promise<RR.DryUpdatePackageRes>

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

  // marketplace

  abstract getMarketplaceData (params: RR.GetMarketplaceDataReq): Promise<RR.GetMarketplaceDataRes>

  abstract getEos (params: RR.GetMarketplaceEOSReq): Promise<RR.GetMarketplaceEOSRes>

  abstract getAvailableList (params: RR.GetAvailableListReq): Promise<RR.GetAvailableListRes>

  abstract getAvailableShow (params: RR.GetAvailableShowReq): Promise<RR.GetAvailableShowRes>

  // Helper allowing quick decoration to sync the response patch and return the response contents.
  // Pass in a tempUpdate function which returns a UpdateTemp corresponding to a temporary
  // state change you'd like to enact prior to request and expired when request terminates.
  private syncResponse<T, F extends (...args: any[]) => Promise<{ response: T, revision?: Revision }>> (f: F, temp?: Operation): (...args: Parameters<F>) => Promise<T> {
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

  // @TODO better types?
  // private async process<T, F extends (args: object) => Promise<{ response: T, revision?: Revision }>> (f: F, temps: Operation[] = []): Promise<T> {
  //   let expireId = undefined
  //   if (temps.length) {
  //     expireId = uuid.v4()
  //     this.sync.next({ patch: temps, expiredBy: expireId })
  //   }
  //   const { response, revision } = await f({ ...f.arguments, expireId })
  //   if (revision) this.sync.next(revision)
  //   return response
  // }
}
// used for type inference in syncResponse
type ExtractResultPromise<T extends Promise<any>> = T extends Promise<infer R> ? Promise<R> : any
