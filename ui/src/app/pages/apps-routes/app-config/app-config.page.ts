import { Component } from '@angular/core'
import { NavController, AlertController, ModalController, PopoverController } from '@ionic/angular'
import { ActivatedRoute } from '@angular/router'
import { ApiService } from 'src/app/services/api/api.service'
import { pauseFor, isEmptyObject } from 'src/app/util/misc.util'
import { LoaderService } from 'src/app/services/loader.service'
import { TrackingModalController } from 'src/app/services/tracking-modal-controller.service'
import { BehaviorSubject, forkJoin, from, fromEvent, of } from 'rxjs'
import { catchError, concatMap, map, take, tap } from 'rxjs/operators'
import { Recommendation } from 'src/app/components/recommendation-button/recommendation-button.component'
import { wizardModal } from 'src/app/components/install-wizard/install-wizard.component'
import { WizardBaker } from 'src/app/components/install-wizard/prebaked-wizards'
import { Cleanup } from 'src/app/util/cleanup'
import { InformationPopoverComponent } from 'src/app/components/information-popover/information-popover.component'
import { ConfigSpec } from 'src/app/pkg-config/config-types'
import { ConfigCursor } from 'src/app/pkg-config/config-cursor'
import { InstalledPackageDataEntry } from 'src/app/models/patch-db/data-model'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'

@Component({
  selector: 'app-config',
  templateUrl: './app-config.page.html',
  styleUrls: ['./app-config.page.scss'],
})
export class AppConfigPage extends Cleanup {
  error: { text: string, moreInfo?:
    { title: string, description: string, buttonText: string }
  }

  loading$ = new BehaviorSubject(true)
  loadingText$ = new BehaviorSubject(undefined)

  pkgId: string
  pkg: InstalledPackageDataEntry
  hasConfig = false

  backButtonDefense = false

  recommendation: Recommendation | null = null
  showRecommendation = true
  openRecommendation = false

  invalid: string
  edited: boolean
  added: boolean
  rootCursor: ConfigCursor<'object'>
  spec: ConfigSpec
  config: object

  constructor (
    private readonly navCtrl: NavController,
    private readonly route: ActivatedRoute,
    private readonly wizardBaker: WizardBaker,
    private readonly apiService: ApiService,
    private readonly loader: LoaderService,
    private readonly alertCtrl: AlertController,
    private readonly modalController: ModalController,
    private readonly trackingModalCtrl: TrackingModalController,
    private readonly popoverController: PopoverController,
    private readonly patch: PatchDbModel,
  ) { super() }

  async ngOnInit () {
    this.pkgId = this.route.snapshot.paramMap.get('pkgId') as string

    this.cleanup(
      this.route.params.pipe(take(1)).subscribe(params => {
        if (params.edit) {
          window.history.back()
        }
      }),
      fromEvent(window, 'popstate').subscribe(() => {
        this.backButtonDefense = false
        this.trackingModalCtrl.dismissAll()
      }),
      this.trackingModalCtrl.onCreateAny$().subscribe(() => {
        if (!this.backButtonDefense) {
          window.history.pushState(null, null, window.location.href + '/edit')
          this.backButtonDefense = true
        }
      }),
      this.trackingModalCtrl.onDismissAny$().subscribe(() => {
        if (!this.trackingModalCtrl.anyModals && this.backButtonDefense === true) {
          this.navCtrl.back()
        }
      }),
    )

    this.patch.watch$('package-data', this.pkgId, 'installed')
    .pipe(
      tap(pkg => this.pkg = pkg),
      tap(() => this.loadingText$.next(`Fetching config spec...`)),
      concatMap(() => forkJoin([this.apiService.getPackageConfig({ id: this.pkg.manifest.id }), pauseFor(600)])),
      concatMap(([{ spec, config }]) => {
        const rec = history.state && history.state.configRecommendation as Recommendation
        if (rec) {
          this.loadingText$.next(`Setting properties to accommodate ${rec.title}...`)
          return from(this.apiService.dryConfigureDependency({ 'dependency-id': this.pkgId, 'dependent-id': rec.appId }))
          .pipe(
            map(res => ({
              spec,
              config,
              dependencyConfig: res,
            })),
            tap(() => this.recommendation = rec),
            catchError(e => {
              this.error = { text: `Could not set properties to accommodate ${rec.title}: ${e.message}`, moreInfo: {
                title: `${rec.title} requires the following:`,
                description: rec.description,
                buttonText: 'Configure Manually',
              } }
              return of({ spec, config, dependencyConfig: null })
            }),
          )
        } else {
          return of({ spec, config, dependencyConfig: null })
        }
      }),
      map(({ spec, config, dependencyConfig }) => this.setConfig(spec, config, dependencyConfig)),
      tap(() => this.loadingText$.next(undefined)),
    ).subscribe({
      error: e => {
        console.error(e.message)
        this.error = { text: e.message }
      },
    })
  }

  async presentPopover (title: string, description: string, ev: any) {
    const information = `
      <div style="font-size: medium; font-style: italic; margin: 5px 0px;">
        ${title}
      </div>
      <div>
        ${description}
      </div>
    `
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

  setConfig (spec: ConfigSpec, config: object, dependencyConfig?: object) {
    this.rootCursor = dependencyConfig ? new ConfigCursor(spec, config, null, dependencyConfig) : new ConfigCursor(spec, config)
    this.spec = this.rootCursor.spec().spec
    this.config = this.rootCursor.config()
    this.handleObjectEdit()
    this.hasConfig = !isEmptyObject(this.spec)
  }

  dismissRecommendation () {
    this.showRecommendation = false
  }

  dismissError () {
    this.error = undefined
  }

  async cancel () {
    if (this.edited) {
      await this.presentAlertUnsaved()
    } else {
      this.navCtrl.back()
    }
  }

  async save (pkg: InstalledPackageDataEntry) {
    return this.loader.of({
      message: `Saving config...`,
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringAsync(async () => {
      const { breakages } = await this.apiService.drySetPackageConfig({ id: this.pkgId, config: this.config })

      if (breakages.length) {
        const { cancelled } = await wizardModal(
          this.modalController,
          this.wizardBaker.configure({
            pkg,
            breakages,
          }),
        )
        if (cancelled) return { skip: true }
      }

      return this.apiService.setPackageConfig({ id: this.pkgId, config: this.config })
        .then(() => ({ skip: false }))
    })
    .then(({ skip }) => {
      if (skip) return
      this.navCtrl.back()
    })
    .catch(e => this.error = { text: e.message })
  }

  handleObjectEdit () {
    this.edited = this.rootCursor.isEdited()
    this.added = this.rootCursor.isNew()
    this.invalid = this.rootCursor.checkInvalid()
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
            this.navCtrl.back()
          },
        },
      ],
    })
    await alert.present()
  }
}

