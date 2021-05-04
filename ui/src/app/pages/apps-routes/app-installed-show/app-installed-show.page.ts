import { Component, ViewChild } from '@angular/core'
import { AlertController, NavController, ToastController, ModalController, IonContent, PopoverController } from '@ionic/angular'
import { ApiService } from 'src/app/services/api/api.service'
import { ActivatedRoute } from '@angular/router'
import { copyToClipboard } from 'src/app/util/web.util'
import { AppStatus } from 'src/app/models/app-model'
import { AppInstalledFull } from 'src/app/models/app-types'
import { chill } from 'src/app/util/misc.util'
import { AppBackupPage } from 'src/app/modals/app-backup/app-backup.page'
import { LoaderService } from 'src/app/services/loader.service'
import { Observable, of, Subscription } from 'rxjs'
import { wizardModal } from 'src/app/components/install-wizard/install-wizard.component'
import { WizardBaker } from 'src/app/components/install-wizard/prebaked-wizards'
import { InformationPopoverComponent } from 'src/app/components/information-popover/information-popover.component'
import { ConfigService } from 'src/app/services/config.service'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'

@Component({
  selector: 'app-installed-show',
  templateUrl: './app-installed-show.page.html',
  styleUrls: ['./app-installed-show.page.scss'],
})
export class AppInstalledShowPage {
  error: string
  appSub: Subscription
  app: AppInstalledFull = { } as AppInstalledFull
  AppStatus = AppStatus
  hideLAN: boolean

  dependencyDefintion = () => `<span style="font-style: italic">Dependencies</span> are other services which must be installed, configured appropriately, and started in order to start ${this.app.title}`

  @ViewChild(IonContent) content: IonContent

  constructor (
    private readonly alertCtrl: AlertController,
    private readonly route: ActivatedRoute,
    private readonly navCtrl: NavController,
    private readonly loader: LoaderService,
    private readonly toastCtrl: ToastController,
    private readonly modalCtrl: ModalController,
    private readonly apiService: ApiService,
    private readonly wizardBaker: WizardBaker,
    private readonly popoverController: PopoverController,
    private readonly config: ConfigService,
    private readonly patch$: PatchDbModel,
  ) { }

  async ngOnInit () {
    const appId = this.route.snapshot.paramMap.get('appId')
    this.appSub = this.patch$.watch$('apps', appId).subscribe(app => this.app = app)
  }

  async ngOnDestroy () {
    this.appSub.unsubscribe()
  }

  async launchUiTab () {
    const url = this.config.isTor() ? `http://${this.app.torAddress}` : `https://${this.app.lanAddress}`
    return window.open(url, '_blank')
  }

  async copyTor () {
    let message = ''
    await copyToClipboard(this.app.torAddress || '').then(success => { message = success ? 'copied to clipboard!' :  'failed to copy' })

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  async copyLAN () {
    let message = ''
    await copyToClipboard(this.app.lanAddress).then(success => { message = success ? 'copied to clipboard!' :  'failed to copy' })

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  async stop (): Promise<void> {
    await this.loader.of({
      message: `Stopping ${this.app.title}...`,
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      const { breakages } = await this.apiService.stopApp(this.app.id, true)

      if (breakages.length) {
        const { cancelled } = await wizardModal(
          this.modalCtrl,
          this.wizardBaker.stop({
            id: this.app.id,
            title: this.app.title,
            version: this.app.versionInstalled,
            breakages,
          }),
        )

        if (cancelled) return { }
      }

      return this.apiService.stopApp(this.app.id).then(chill)
    }).catch(e => this.setError(e))
  }

  async tryStart (): Promise<void> {
    if (this.app.startAlert) {
      this.presentAlertStart()
    } else {
      this.start()
    }
  }

  async presentModalBackup (type: 'create' | 'restore') {
    const modal = await this.modalCtrl.create({
      backdropDismiss: false,
      component: AppBackupPage,
      presentingElement: await this.modalCtrl.getTop(),
      componentProps: {
        app: this.app,
        type,
      },
    })

    await modal.present()
  }

  async presentAlertStopBackup (): Promise<void> {
    const alert = await this.alertCtrl.create({
      backdropDismiss: false,
      header: 'Warning',
      message: `${this.app.title} is not finished backing up. Are you sure you want stop the process?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Stop',
          cssClass: 'alert-danger',
          handler: () => {
            this.stopBackup()
          },
        },
      ],
    })
    await alert.present()
  }

  async uninstall () {
    const data = await wizardModal(
      this.modalCtrl,
      this.wizardBaker.uninstall({
        id: this.app.id,
        title: this.app.title,
        version: this.app.versionInstalled,
        uninstallAlert: this.app.uninstallAlert,
      }),
    )

    if (data.cancelled) return
    return this.navCtrl.navigateRoot('/services/installed')
  }

  async presentPopover (information: string, ev: any) {
    const popover = await this.popoverController.create({
      component: InformationPopoverComponent,
      event: ev,
      translucent: false,
      showBackdrop: true,
      backdropDismiss: true,
      componentProps: {
        information,
      },
    })
    return await popover.present()
  }

  scrollToRequirements () {
    const el = document.getElementById('service-requirements-' + this.app.id)
    if (!el) return
    let y = el.offsetTop
    return this.content.scrollToPoint(0, y, 1000)
  }

  private async stopBackup (): Promise<void> {
    await this.loader.of({
      message: `Stopping backup...`,
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringP(this.apiService.stopAppBackup(this.app.id))
    .catch (e => this.setError(e))
  }

  private async presentAlertStart (): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Warning',
      message: this.app.startAlert,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Start',
          handler: () => {
            this.start()
          },
        },
      ],
    })
    await alert.present()
  }

  private async start (): Promise<void> {
    this.loader.of({
      message: `Starting ${this.app.title}...`,
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringP(
      this.apiService.startApp(this.app.id),
    ).catch(e => this.setError(e))
  }

  private setError (e: Error): Observable<void> {
    this.error = e.message
    return of()
  }
}
