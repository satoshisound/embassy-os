import { Component } from '@angular/core'
import { ServerSpecs } from 'src/app/models/server-model'
import { ToastController } from '@ionic/angular'
import { copyToClipboard } from 'src/app/util/web.util'
import { ModelPreload } from 'src/app/models/model-preload'
import { markAsLoadingDuring$ } from 'src/app/services/loader.service'
import { BehaviorSubject, Observable, of } from 'rxjs'

@Component({
  selector: 'server-specs',
  templateUrl: './server-specs.page.html',
  styleUrls: ['./server-specs.page.scss'],
})
export class ServerSpecsPage {
  loading$ = new BehaviorSubject(true)
  error$ = new BehaviorSubject('')
  specs: Observable<ServerSpecs>

  constructor (
    private readonly toastCtrl: ToastController,
    private readonly preload: ModelPreload,
  ) { }

  async ngOnInit () {
    markAsLoadingDuring$(this.loading$, this.preload.server()).subscribe({
      next: s => this.specs = of(s.specs),
      error: e => {
        console.error(e)
        this.error$.next(e.message)
      },
    })
  }

  async copyTor (address: string) {
    let message = ''
    await copyToClipboard(address.trim() || '')
      .then(success => { message = success ? 'copied to clipboard!' : 'failed to copy'})

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  asIsOrder (a: any, b: any) {
    return 0
  }
}
