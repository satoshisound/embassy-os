import { Component } from '@angular/core'
import { NavController } from '@ionic/angular'
import { ApiService } from 'src/app/services/api/api.service'
import { WifiService } from '../wifi.service'
import { LoaderService } from 'src/app/services/loader.service'

@Component({
  selector: 'wifi-add',
  templateUrl: 'wifi-add.page.html',
  styleUrls: ['wifi-add.page.scss'],
})
export class WifiAddPage {
  countries = require('../../../../util/countries.json')
  countryCode = 'US'
  ssid = ''
  password = ''
  error = ''

  constructor (
    private readonly navCtrl: NavController,
    private readonly apiService: ApiService,
    private readonly loader: LoaderService,
    private readonly wifiService: WifiService,
  ) { }

  async add (): Promise<void> {
    this.error = ''
    this.loader.of({
      message: 'Saving...',
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      await this.apiService.addWifi(this.ssid, this.password, this.countryCode, false)
      this.navCtrl.back()
    }).catch(e => {
      console.error(e)
      this.error = e.message
    })
  }

  async addAndConnect (): Promise<void> {
    this.error = ''
    this.loader.of({
      message: 'Connecting. This could take while...',
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      await this.apiService.addWifi(this.ssid, this.password, this.countryCode, true)
      const success = await this.wifiService.confirmWifi(this.ssid)
      if (success) {
        this.navCtrl.back()
        this.wifiService.presentAlertSuccess(this.ssid)
      } else {
        this.wifiService.presentToastFail()
      }
    }).catch (e => {
      console.error(e)
      this.error = e.message
    })
  }

  asIsOrder (a: any, b: any) {
    return 0
  }
}
