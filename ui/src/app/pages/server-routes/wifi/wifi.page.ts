import { Component } from '@angular/core'
import { ActionSheetController } from '@ionic/angular'
import { ApiService } from 'src/app/services/api/api.service'
import { ActionSheetButton } from '@ionic/core'
import { WifiService } from './wifi.service'
import { LoaderService } from 'src/app/services/loader.service'
import { ModelPreload } from 'src/app/models/model-preload'
import { BehaviorSubject, Observable, of } from 'rxjs'
import { WiFi } from 'src/app/services/api/api-types'

@Component({
  selector: 'wifi',
  templateUrl: 'wifi.page.html',
  styleUrls: ['wifi.page.scss'],
})
export class WifiListPage {
  wifi$: Observable<WiFi>
  error$ = new BehaviorSubject('')

  constructor (
    private readonly apiService: ApiService,
    private readonly loader: LoaderService,
    private readonly actionCtrl: ActionSheetController,
    private readonly wifiService: WifiService,
    private readonly preload: ModelPreload,
  ) { }

  async ngOnInit () {
    this.preload.server().subscribe(s => this.wifi$ = of(s.wifi))
  }

  async presentAction (ssid: string, wifi: WiFi) {
    const buttons: ActionSheetButton[] = [
      {
        text: 'Forget',
        cssClass: 'alert-danger',
        handler: () => {
          this.delete(ssid, wifi)
        },
      },
    ]

    if (ssid !== wifi.current) {
      buttons.unshift(
        {
          text: 'Connect',
          handler: () => {
            this.connect(ssid, wifi.current)
          },
        },
      )
    }

    const action = await this.actionCtrl.create({
      buttons,
    })

    await action.present()
  }

  // Let's add country code here
  async connect (ssid: string, current: string): Promise<void> {
    this.error$.next('')
    this.loader.of({
      message: 'Connecting. This could take while...',
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      await this.apiService.connectWifi(ssid)
      const success = await this.wifiService.confirmWifi(ssid)
      if (success) {
        this.wifiService.presentAlertSuccess(ssid)
      } else {
        this.wifiService.presentToastFail()
      }
    }).catch(e => {
      console.error(e)
      this.error$.next(e.message)
    })
  }

  async delete (ssid: string, wifi: WiFi): Promise<void> {
    this.error$.next('')
    this.loader.of({
      message: 'Deleting...',
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      await this.apiService.deleteWifi(ssid)
      this.error$.next('')
    }).catch(e => {
      console.error(e)
      this.error$.next(e.message)
    })
  }
}
