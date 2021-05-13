import { Injectable } from '@angular/core'
import { pauseFor } from '../../util/misc.util'
import { ApiService } from './api.service'
import { Observable } from 'rxjs'
import { PatchOp, Update } from 'patch-db-client'
import { DataModel, PackageMainStatus, PackageState, ServerStatus } from 'src/app/models/patch-db/data-model'
import { ConfigService } from '../config.service'
import { RR } from './api-types'
import { parsePropertiesPermissive } from 'src/app/util/properties.util'
import { Mock } from './mock-app-fixures'

@Injectable()
export class MockApiService extends ApiService {
  sequence = 0
  welcomeAck = false

  constructor (
    private readonly config: ConfigService,
  ) { super() }

  // every time a patch is returned from the mock, we override its sequence to be 1 more than the last sequence in the patch-db as provided by `o`.
  watch$ (sequenceStream: Observable<number>): Observable<Update<DataModel>> {
    sequenceStream.subscribe(i => this.sequence < i ? (this.sequence = i) : { })
    return super.watch$()
  }

  // db

  async getRevisions (since: number): Promise<RR.GetRevisionsRes> {
    await pauseFor(2000)
    return {
      id: this.nextSequence(),
      ...Mock.DbDump,
    }
  }

  async getDump (): Promise<RR.GetDumpRes> {
    await pauseFor(2000)
    return {
      id: this.nextSequence(),
      ...Mock.DbDump,
    }
  }

  async setDbValueRaw (params: RR.SetDBValueReq): Promise<RR.SetDBValueRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: params.pointer, value: params.value },
        ],
        expireId: null,
      },
    }
  }

  // auth

  async login (params: RR.LoginReq): Promise<RR.LoginRes> {
    await pauseFor(2000)
    return null
  }

  async logout (params: RR.LogoutReq): Promise<RR.LogoutRes> {
    await pauseFor(2000)
    return null
  }

  // server

  async getServerLogs (params: RR.GetServerLogsReq): Promise<RR.GetServerLogsRes> {
    await pauseFor(2000)
    return Mock.ServerLogs
  }

  async getServerMetrics (params: RR.GetServerMetricsReq): Promise<RR.GetServerMetricsRes> {
    await pauseFor(2000)
    return Mock.ServerMetrics
  }

  async updateServerRaw (params: RR.UpdateServerReq): Promise<RR.UpdateServerRes> {
    await pauseFor(2000)
    return null
  }

  async restartServer (params: RR.RestartServerReq): Promise<RR.RestartServerRes> {
    await pauseFor(2000)
    return null
  }

  async shutdownServer (params: RR.ShutdownServerReq): Promise<RR.ShutdownServerRes> {
    await pauseFor(2000)
    return null
  }

  // network

  async refreshLan (params: RR.RefreshLanReq): Promise<RR.RefreshLanRes> {
    await pauseFor(2000)
    return null
  }

  // notification

  async getNotificationsRaw (params: RR.GetNotificationsReq): Promise<RR.GetNotificationsRes> {
    await pauseFor(2000)
    return {
      response: Mock.Notifications,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: 'server-info/unread-notification-count', value: 0 },
        ],
        expireId: null,
      },
    }
  }

  async deleteNotification (params: RR.DeleteNotificationReq): Promise<RR.DeleteNotificationRes> {
    await pauseFor(2000)
    return null
  }

  // wifi

  async getWifi (params: RR.GetWifiReq): Promise<RR.GetWifiRes> {
    await pauseFor(2000)
    return Mock.WiFi
  }

  async addWifi (params: RR.AddWifiReq): Promise<RR.AddWifiRes> {
    await pauseFor(2000)
    return null
  }

  async connectWifiRaw (params: RR.ConnectWifiReq): Promise<RR.ConnectWifiRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: 'server-info/wifi/selected', value: params.ssid },
        ],
        expireId: null,
      },
    }
  }

  async deleteWifiRaw (params: RR.DeleteWifiReq): Promise<RR.DeleteWifiRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: 'server-info/wifi/selected', value: null },
          { op: PatchOp.REPLACE, path: 'server-info/wifi/connected', value: null },
        ],
        expireId: null,
      },
    }
  }

  // ssh

  async getSshKeys (params: RR.GetSSHKeysReq): Promise<RR.GetSSHKeysRes> {
    await pauseFor(2000)
    return Mock.SshKeys
  }

  async addSshKey (params: RR.AddSSHKeyReq): Promise<RR.AddSSHKeyRes> {
    await pauseFor(2000)
    return null
  }

  async deleteSshKey (params: RR.DeleteSSHKeyReq): Promise<RR.DeleteSSHKeyRes> {
    await pauseFor(2000)
    return null
  }

  // backup

  async createBackupRaw (params: RR.CreateBackupReq): Promise<RR.CreateBackupRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: 'server-info/status', value: ServerStatus.BackingUp },
        ],
        expireId: null,
      },
    }
  }

  async restoreBackupRaw (params: RR.RestoreBackupReq): Promise<RR.RestoreBackupRes> {
    await pauseFor(2000)
    return null
  }

  // disk

  async getDisks (params: RR.GetDisksReq): Promise<RR.GetDisksRes> {
    await pauseFor(2000)
    return Mock.Disks
  }

  async ejectDisk (params: RR.EjectDisksReq): Promise<RR.EjectDisksRes> {
    await pauseFor(2000)
    return null
  }

  // package

  async getPackageInstructions (params: RR.GetPackageInstructionsReq): Promise<RR.GetPackageInstructionsRes> {
    return require('./md-sample.md')
  }

  async getPackageProperties (params: RR.GetPackagePropertiesReq): Promise<RR.GetPackagePropertiesRes> {
    await pauseFor(2000)
    return parsePropertiesPermissive(Mock.PackageProperties)
  }

  async getPackageLogs (params: RR.GetPackageLogsReq): Promise<RR.GetPackageLogsRes> {
    await pauseFor(2000)
    return Mock.PackageLogs
  }

  async installPackageRaw (params: RR.InstallPackageReq): Promise<RR.InstallPackageRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/state`, value: PackageState.Installing },
          {
            op: PatchOp.ADD,
            path: `package-data/${params.id}/install-progress`,
            value: {
              size: 100,
              downloaded: 10,
              'download-complete': false,
              validated: 1,
              'validation-complete': true,
              read: 50,
              'read-complete': false,
            },
          },
        ],
        expireId: null,
      },
    }
  }

  async dryUpdatePackage (params: RR.DryUpdatePackageReq): Promise<RR.DryUpdatePackageRes> {
    await pauseFor(2000)
    return {
      patch: [],
      breakages: { },
    }
  }

  async updatePackageRaw (params: RR.UpdatePackageReq): Promise<RR.UpdatePackageRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/state`, value: PackageState.Updating },
        ],
        expireId: null,
      },
    }
  }

  async getPackageConfig (params: RR.GetPackageConfigReq): Promise<RR.GetPackageConfigRes> {
    await pauseFor(2000)
    return Mock.PackageConfig
  }

  async drySetPackageConfig (params: RR.DrySetPackageConfigReq): Promise<RR.DrySetPackageConfigRes> {
    await pauseFor(2000)
    return {
      patch: [],
      breakages: { },
    }
  }

  async setPackageConfigRaw (params: RR.SetPackageConfigReq): Promise<RR.SetPackageConfigRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/installed/status/configured`, value: true },
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/installed/status/main`, value: PackageMainStatus.Running },
        ],
        expireId: null,
      },
    }
  }

  async restorePackageRaw (params: RR.RestorePackageReq): Promise<RR.RestorePackageRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/installed/status/main`, value: PackageMainStatus.Restoring },
        ],
        expireId: null,
      },
    }
  }

  async executePackageAction (params: RR.ExecutePackageActionReq): Promise<RR.ExecutePackageActionRes> {
    await pauseFor(2000)
    return {
      ok: {
        message: 'Action success!',
        value: 'new password',
        copyable: true,
        qr: false,
      },
      // err: '',
    }
  }

  async startPackageRaw (params: RR.StartPackageReq): Promise<RR.StartPackageRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/installed/status/main`, value: PackageMainStatus.Running },
        ],
        expireId: null,
      },
    }
  }

  async dryStopPackage (params: RR.DryStopPackageReq): Promise<RR.DryStopPackageRes> {
    await pauseFor(2000)
    return {
      patch: [],
      breakages: { },
    }
  }

  async stopPackageRaw (params: RR.StopPackageReq): Promise<RR.StopPackageRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/installed/status/main`, value: PackageMainStatus.Stopping },
        ],
        expireId: null,
      },
    }
  }

  async dryRemovePackage (params: RR.DryRemovePackageReq): Promise<RR.DryRemovePackageRes> {
    await pauseFor(2000)
    return {
      patch: [],
      breakages: { },
    }
  }

  async removePackageRaw (params: RR.RemovePackageReq): Promise<RR.RemovePackageRes> {
    await pauseFor(2000)
    return {
      response: null,
      revision: {
        id: this.nextSequence(),
        patch: [
          { op: PatchOp.REPLACE, path: `package-data/${params.id}/state`, value: PackageState.Removing },
        ],
        expireId: null,
      },
    }
  }

  async dryConfigureDependency (params: RR.DryConfigureDependencyReq): Promise<RR.DryConfigureDependencyRes> {
    await pauseFor(2000)
    return { }
  }

  // store

  // async getAvailableApps (): Promise<AppAvailablePreview[]> {
  //   const res = await this.http.rpcRequest<RR.GetAppsAvailableRes>({ method: 1 })
  //   return res.map(a => {
  //     const latestVersionTimestamp = new Date(a.latestVersionTimestamp)
  //     if (isNaN(latestVersionTimestamp as any)) throw new Error(`Invalid latestVersionTimestamp ${a.latestVersionTimestamp}`)
  //     return { ...a, latestVersionTimestamp }
  //   })
  // }

  // async getAvailableApp (appId: string): Promise<AppAvailableFull> {
  //   return this.http.rpcRequest<RR.GetAppAvailableRes>({ method: 1, params: { appId } })
  //     .then(res => {
  //       return {
  //         ...res,
  //         versionViewing: res.versionLatest,
  //       }
  //     })
  // }

  // async getAvailableAppVersionSpecificInfo (appId: string, versionSpec: string): Promise<AppAvailableVersionSpecificInfo> {
  //   return this.http.rpcRequest<Replace<RR.GetAppAvailableVersionInfoRes, 'versionViewing', 'version'>>( { method: 1, params: { appId, versionSpec } })
  //     .then(res => ({ ...res, versionViewing: res.version }))
  //     .then(res => {
  //       delete res['version']
  //       return res
  //     })
  // }

  // async getVersionLatest (): Promise<RR.GetVersionLatestRes> {
  //   return this.http.rpcRequest({ method: Method.GET, url: '/versionLatest' }, '')
  // }

  private nextSequence () {
    console.log('next')
    this.sequence++
    return this.sequence
  }
}
