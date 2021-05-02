import { Component } from '@angular/core'
import { SSHFingerprint } from 'src/app/models/server-model'
import { ApiService } from 'src/app/services/api/api.service'
import { ServerConfigService } from 'src/app/services/server-config.service'
import { AlertController } from '@ionic/angular'
import { BehaviorSubject } from 'rxjs'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'
import { PatchOp, Operation } from 'patch-db-client'
import { map, take, tap } from 'rxjs/operators'

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
    private readonly patch: PatchDbModel,
  ) { }

  ngOnInit () {
    this.patch.watch$('server', 'ssh').subscribe(ssh => {
      console.log('new ssh', ssh.length)
      this.fingerprints$.next(ssh || [])
    })
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
    let index: number
    this.fingerprints$.pipe(
      map(fps => fps.map(fp => fp.hash).indexOf(fingerprint.hash)),
      tap(i => index = i),
      take(1),
    ).subscribe()
    const temp: Operation = { op: PatchOp.REMOVE, path: `/server/ssh/${index}` }
    this.apiService.deleteSSHKey(fingerprint, temp)()
    this.error$.next('')
  }
}
