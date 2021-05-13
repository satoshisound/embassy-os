import { Component } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { ApiService } from 'src/app/services/api/api.service'
import { pauseFor } from 'src/app/util/misc.util'
import { BackupConfirmationComponent } from 'src/app/modals/backup-confirmation/backup-confirmation.component'
import { DiskInfo, PartitionInfoEntry } from 'src/app/services/api/api-types'

@Component({
  selector: 'backup',
  templateUrl: './backup.page.html',
  styleUrls: ['./backup.page.scss'],
})
export class BackupPage {
  disks: DiskInfo
  loading = true
  error: string
  allPartitionsMounted: boolean

  constructor (
    private readonly modalCtrl: ModalController,
    private readonly apiService: ApiService,
  ) { }

  ngOnInit () {
    this.getExternalDisks().then(() => this.loading = false)
  }

  async doRefresh (event: any) {
    await Promise.all([
      this.getExternalDisks(),
      pauseFor(600),
    ])
    event.target.complete()
  }

  async getExternalDisks (): Promise<void> {
    try {
      this.disks = await this.apiService.getDisks({ })
      this.allPartitionsMounted = Object.values(this.disks).every(d => Object.values(d.partitions).every(p => p['is-mounted']))
    } catch (e) {
      console.error(e)
      this.error = e.message
    }
  }

  async dismiss () {
    await this.modalCtrl.dismiss()
  }

  async presentModal (logicalname: string, partition: PartitionInfoEntry): Promise<void> {
    const m = await this.modalCtrl.create({
      componentProps: {
        name: partition.label || logicalname,
      },
      cssClass: 'alertlike-modal',
      component: BackupConfirmationComponent,
      backdropDismiss: false,
    })

    m.onWillDismiss().then(res => {
      const data = res.data
      if (data.cancel) return
      return this.create(logicalname, data.password)
    })

    return await m.present()
  }

  private async create (logicalname: string, password: string): Promise<void> {
    this.error = ''
    try {
      await this.apiService.createBackup({ logicalname, password })
      this.dismiss()
    } catch (e) {
      console.error(e)
      this.error = e.message
    }
  }
}
