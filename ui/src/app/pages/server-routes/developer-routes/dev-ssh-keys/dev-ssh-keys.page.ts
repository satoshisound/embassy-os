import { Component } from '@angular/core'
import { ApiService } from 'src/app/services/api/api.service'
import { ServerConfigService } from 'src/app/services/server-config.service'
import { AlertController } from '@ionic/angular'
import { BehaviorSubject } from 'rxjs'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'
import { PatchOp, Operation } from 'patch-db-client'
import { SSHFingerprint } from 'src/app/models/patch-db/data-model'

@Component({
  selector: 'dev-ssh-keys',
  templateUrl: 'dev-ssh-keys.page.html',
  styleUrls: ['dev-ssh-keys.page.scss'],
})
export class DevSSHKeysPage {
  fingerprints$: BehaviorSubject<SSHFingerprint[]> = new BehaviorSubject([])
  error$ = new BehaviorSubject('')

  constructor (
    private readonly apiService: ApiService,
    private readonly serverConfigService: ServerConfigService,
    private readonly alertCtrl: AlertController,
    public readonly patch: PatchDbModel,
  ) { }

  async presentModalAdd () {
    await this.serverConfigService.presentModalValueEdit('ssh')
  }

  async presentAlertDelete (fingerprint: SSHFingerprint, index: number) {
    console.log(index)
    const alert = await this.alertCtrl.create({
      backdropDismiss: false,
      header: 'Caution',
      message: `Are you sure you want to delete this key?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          cssClass: 'alert-danger',
          handler: () => {
            this.delete(fingerprint, index)
          },
        },
      ],
    })
    await alert.present()
  }

  async delete (fingerprint: SSHFingerprint, index: number) {
    const temp: Operation = { op: PatchOp.REMOVE, path: `/server/ssh/${index}` }
    this.apiService.deleteSSHKey(fingerprint, temp)
    this.error$.next('')
  }
}
