import { Injectable } from '@angular/core'
import { AlertController, ToastController } from '@ionic/angular'
import { ApiService } from 'src/app/services/api/api.service'
import { pauseFor } from 'src/app/util/misc.util'

@Injectable({
  providedIn: 'root',
})
export class WifiService {

  constructor (
    private readonly apiService: ApiService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) { }

  async confirmWifi (ssid: string): Promise<boolean> {
    const timeout = 4000
    const maxAttempts = 5
    let attempts = 0

    let success = false
    while (attempts < maxAttempts) {
      try {
        const start = new Date().valueOf()
        const { current } = (await this.apiService.getServer()).wifi
        const end = new Date().valueOf()
        if (current === ssid) {
          success = true
          break
        } else {
          attempts++
          const diff = end - start
          await pauseFor(Math.max(2000, timeout - diff))
        }
      } catch (e) {
        attempts++
        console.error(e)
      }
    }

    return success
  }

  async presentToastFail (): Promise<void> {
    const toast = await this.toastCtrl.create({
      header: 'Failed to connect:',
      message: `Check credentials and try again`,
      position: 'bottom',
      duration: 4000,
      buttons: [
        {
          side: 'start',
          icon: 'close',
          handler: () => {
            return true
          },
        },
      ],
      cssClass: 'notification-toast-error',
    })

    await toast.present()
  }

  async presentAlertSuccess (current: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: `Connected to "${current}"`,
      message: 'Note. It may take several minutes to an hour for your Embassy to reconnect over Tor.',
      buttons: ['OK'],
    })

    await alert.present()
  }
}
