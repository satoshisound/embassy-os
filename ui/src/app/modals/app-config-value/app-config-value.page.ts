import { Component, Input } from '@angular/core'
import { getDefaultConfigValue, getDefaultDescription, Range } from 'src/app/pkg-config/config-utilities'
import { AlertController, ToastController } from '@ionic/angular'
import { LoaderService } from 'src/app/services/loader.service'
import { TrackingModalController } from 'src/app/services/tracking-modal-controller.service'
import { ConfigCursor } from 'src/app/pkg-config/config-cursor'
import { ValueSpecOf } from 'src/app/pkg-config/config-types'
import { copyToClipboard } from 'src/app/util/web.util'

@Component({
  selector: 'app-config-value',
  templateUrl: 'app-config-value.page.html',
  styleUrls: ['app-config-value.page.scss'],
})
export class AppConfigValuePage {
  @Input() cursor: ConfigCursor<'string' | 'number' | 'boolean' | 'enum'>
  @Input() saveFn?: (value: string | number | boolean) => Promise<any>

  spec: ValueSpecOf<'string' | 'number' | 'boolean' | 'enum'>
  value: string | number | boolean | null

  edited: boolean
  error: string
  unmasked = false

  defaultDescription: string
  integralDescription = 'Value must be a whole number.'

  range: Range
  rangeDescription: string

  constructor (
    private readonly loader: LoaderService,
    private readonly trackingModalCtrl: TrackingModalController,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
  ) { }

  ngOnInit () {
    this.spec  = this.cursor.spec()
    this.value = this.cursor.config()
    this.error = this.cursor.checkInvalid()

    this.defaultDescription = getDefaultDescription(this.spec)
    if (this.spec.type === 'number') {
      this.range = Range.from(this.spec.range)
      this.rangeDescription = this.range.description()
    }
  }

  async dismiss () {
    if (this.edited) {
      await this.presentAlertUnsaved()
    } else {
      await this.trackingModalCtrl.dismiss()
    }
  }

  async done () {
    if (!this.validate()) { return }

    if (this.spec.type !== 'boolean') {
      this.value = this.value || null
    }
    if (this.spec.type === 'number' && this.value) {
      this.value = Number(this.value)
    }

    if (this.saveFn) {
      this.loader.displayDuringP(
        this.saveFn(this.value).catch(e => {
          console.error(e)
          this.error = e.message
        }),
      )
    }

    await this.trackingModalCtrl.dismiss(this.value)
  }

  refreshDefault () {
    this.value = getDefaultConfigValue(this.spec) as any
    this.handleInput()
  }

  handleInput () {
    this.error = ''
    this.edited = true
  }

  clear () {
    this.value = null
    this.edited = true
  }

  toggleMask () {
    this.unmasked = !this.unmasked
  }

  async copy (): Promise<void> {
    let message = ''
    await copyToClipboard(String(this.value)).then(success => { message = success ? 'copied to clipboard!' :  'failed to copy'})

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  private validate (): boolean {
    if (this.spec.type === 'boolean') return true

    // test blank
    if (!this.value && !(this.spec as any).nullable) {
      this.error = 'Value cannot be blank'
      return false
    }
    // test pattern if string
    if (this.spec.type === 'string' && this.value) {
      const { pattern, patternDescription } = this.spec
      if (pattern && !RegExp(pattern).test(this.value as string)) {
        this.error = patternDescription || `Must match ${pattern}`
        return false
      }
    }
    // test range if number
    if (this.spec.type === 'number' && this.value) {
      if (this.spec.integral && !RegExp(/^[-+]?[0-9]+$/).test(String(this.value))) {
        this.error = this.integralDescription
        return false
      } else if (!this.spec.integral && !RegExp(/^[0-9]*\.?[0-9]+$/).test(String(this.value))) {
        this.error = 'Value must be a number.'
        return false
      } else {
        try {
          this.range.checkIncludes(Number(this.value))
        } catch (e) {
          console.warn(e) //an invalid spec is not an error
          this.error = e.message
          return false
        }
      }
    }

    return true
  }

  private async presentAlertUnsaved () {
    const alert = await this.alertCtrl.create({
      backdropDismiss: false,
      header: 'Unsaved Changes',
      message: 'You have unsaved changes. Are you sure you want to leave?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: `Leave`,
          cssClass: 'alert-danger',
          handler: () => {
            this.trackingModalCtrl.dismiss()
          },
        },
      ],
    })
    await alert.present()
  }
}

