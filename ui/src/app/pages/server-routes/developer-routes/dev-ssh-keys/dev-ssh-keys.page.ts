import { Component } from '@angular/core'
import { SSHFingerprint } from 'src/app/models/server-model'
import { ApiService } from 'src/app/services/api/api.service'
import { ServerConfigService } from 'src/app/services/server-config.service'
import { LoaderService } from 'src/app/services/loader.service'
import { ModelPreload } from 'src/app/models/model-preload'
import { AlertController } from '@ionic/angular'
import { BehaviorSubject, Observable, of } from 'rxjs'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'

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
    private readonly loader: LoaderService,
    private readonly preload: ModelPreload,
    private readonly serverConfigService: ServerConfigService,
    private readonly alertCtrl: AlertController,
    private readonly patch: PatchDbModel,
  ) { }

  ngOnInit () {
    this.patch.watch$('server', 'ssh').subscribe(ssh => {
      console.log('new ssh', ssh.length)
      this.fingerprints$.next(ssh || [])
    })

    // this.preload.server().subscribe(s => {
    //   console.log('new ssh', s.ssh.length)
    //   this.fingerprints$.next(s.ssh)
    // })
  }

  async presentModalAdd () {
    await this.serverConfigService.presentModalValueEdit('ssh', true)
  }

  async presentAlertDelete (fingerprint: SSHFingerprint) {
    const alert = await this.alertCtrl.create({
      backdropDismiss: false,
      header: 'Caution',
      message: `Are you sure you want to delete this SSH key?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          cssClass: 'alert-danger',
          handler: () => {
            this.delete(fingerprint)
          },
        },
      ],
    })
    await alert.present()
  }

  async delete (fingerprint: SSHFingerprint) {
    this.loader.of({
      message: 'Deleting...',
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      await this.apiService.deleteSSHKey(fingerprint)
      this.error$.next('')
    }).catch(e => {
      console.error(e)
      this.error$.next(e.message)
    })
  }
}
