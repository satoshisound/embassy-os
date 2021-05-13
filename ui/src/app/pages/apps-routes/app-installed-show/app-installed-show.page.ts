import { Component, ViewChild } from '@angular/core'
import { AlertController, NavController, ToastController, ModalController, IonContent, PopoverController } from '@ionic/angular'
import { ApiService } from 'src/app/services/api/api.service'
import { ActivatedRoute } from '@angular/router'
import { copyToClipboard } from 'src/app/util/web.util'
import { chill } from 'src/app/util/misc.util'
import { LoaderService } from 'src/app/services/loader.service'
import { BackupPage } from 'src/app/modals/backup/backup.page'
import { Observable, of, Subscription } from 'rxjs'
import { wizardModal } from 'src/app/components/install-wizard/install-wizard.component'
import { WizardBaker } from 'src/app/components/install-wizard/prebaked-wizards'
import { InformationPopoverComponent } from 'src/app/components/information-popover/information-popover.component'
import { ConfigService } from 'src/app/services/config.service'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'
import { PackageDataEntry } from 'src/app/models/patch-db/data-model'
import { FEStatus } from 'src/app/services/pkg-status-rendering.service'

@Component({
  selector: 'app-installed-show',
  templateUrl: './app-installed-show.page.html',
  styleUrls: ['./app-installed-show.page.scss'],
})
export class AppInstalledShowPage {
  error: string
  pkgId: string
  pkg: PackageDataEntry
  pkgSub: Subscription
  hideLAN: boolean

  FeStatus = FEStatus

  dependencyDefintion = () => `<span style="font-style: italic">Dependencies</span> are other services which must be installed, configured appropriately, and started in order to start ${this.pkg.installed.manifest.title}`

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
    this.pkgId = this.route.snapshot.paramMap.get('pkgId')
    this.pkgSub = this.patch$.watch$('package-data', this.pkgId).subscribe(pkg => this.pkg = pkg)
  }

  async ngOnDestroy () {
    this.pkgSub.unsubscribe()
  }

  launchUiTab (): void {
    window.open(this.config.launchableURL(this.pkg.installed), '_blank')
  }

  async copyTor (): Promise<void> {
    let message = ''
    await copyToClipboard(this.config.torUiAddress(this.pkg.installed) || '').then(success => { message = success ? 'copied to clipboard!' :  'failed to copy' })

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  async copyLAN (): Promise<void> {
    let message = ''
    await copyToClipboard(this.config.lanUiAddress(this.pkg.installed) || '').then(success => { message = success ? 'copied to clipboard!' :  'failed to copy' })

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  async stop (): Promise<void> {
    const { id, title, version } = this.pkg.installed.manifest
    await this.loader.of({
      message: `Stopping...`,
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      const { breakages } = await this.apiService.dryStopPackage({ id })

      if (breakages.length) {
        const { cancelled } = await wizardModal(
          this.modalCtrl,
          this.wizardBaker.stop({
            id,
            title,
            version,
            breakages,
          }),
        )

        if (cancelled) return { }
      }

      return this.apiService.stopPackage({ id }).then(chill)
    }).catch(e => this.setError(e))
  }

  async tryStart (): Promise<void> {
    const message = this.pkg.installed.manifest.alerts.start
    if (message) {
      this.presentAlertStart(message)
    } else {
      this.start()
    }
  }

  async presentModalBackup () {
    const modal = await this.modalCtrl.create({
      backdropDismiss: false,
      component: BackupPage,
      presentingElement: await this.modalCtrl.getTop(),
      componentProps: {
        pkg: this.pkg,
      },
    })

    await modal.present()
  }

  async uninstall () {
    const { id, title, version, alerts } = this.pkg.installed.manifest
    const data = await wizardModal(
      this.modalCtrl,
      this.wizardBaker.uninstall({
        id,
        title,
        version,
        uninstallAlert: alerts.uninstall,
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
    const el = document.getElementById('dependencies')
    if (!el) return
    let y = el.offsetTop
    return this.content.scrollToPoint(0, y, 1000)
  }

  private async presentAlertStart (message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Warning',
      message,
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
      message: `Starting...`,
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringP(
      this.apiService.startPackage({ id: this.pkgId }),
    ).catch(e => this.setError(e))
  }

  private setError (e: Error): Observable<void> {
    this.error = e.message
    return of()
  }
}
