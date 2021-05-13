import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ApiService } from 'src/app/services/api/api.service'
import { pauseFor } from 'src/app/util/misc.util'
import { BehaviorSubject } from 'rxjs'
import { copyToClipboard } from 'src/app/util/web.util'
import { AlertController, NavController, PopoverController, ToastController } from '@ionic/angular'
import { PackageProperties } from 'src/app/util/properties.util'
import { QRComponent } from 'src/app/components/qr/qr.component'
import { PropertyStore } from './property-store'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'
import * as JSONpointer from 'json-pointer'

@Component({
  selector: 'app-properties',
  templateUrl: './app-properties.page.html',
  styleUrls: ['./app-properties.page.scss'],
})
export class AppPropertiesPage {
  error = ''
  loading$ = new BehaviorSubject(true)
  pkgId: string
  pointer: string
  qrCode: string
  properties$ = new BehaviorSubject<PackageProperties>({ })
  hasProperties$ = new BehaviorSubject<boolean>(null)
  unmasked: { [key: string]: boolean } = { }

  constructor (
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
    private readonly popoverCtrl: PopoverController,
    private readonly propertyStore: PropertyStore,
    private readonly navCtrl: NavController,
    public patch: PatchDbModel,
  ) { }

  ngOnInit () {
    this.pkgId = this.route.snapshot.paramMap.get('pkgId')
    this.pointer = this.route.queryParams['pointer']

    this.getProperties().then(() => this.loading$.next(false))

    this.propertyStore.watch().subscribe(m => {
      const properties = JSONpointer.get(m, this.pointer || '')
      this.properties$.next(properties)
    })
    this.properties$.subscribe(m => {
      this.hasProperties$.next(!!Object.keys(m || { }).length)
    })
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['pointer'] === this.pointer) return
      this.pointer = queryParams['pointer']
      const properties = JSONpointer.get(this.propertyStore.properties$.getValue(), this.pointer || '')
      this.properties$.next(properties)
    })
  }

  async doRefresh (event: any) {
    await this.getProperties(),
    event.target.complete()
  }

  async presentDescription (property: { key: string, value: PackageProperties[''] }, e: Event) {
    e.stopPropagation()

    const alert = await this.alertCtrl.create({
      header: property.key,
      message: property.value.description,
    })
    await alert.present()
  }

  async goToNested (key: string): Promise<any> {
    this.navCtrl.navigateForward(`/services/installed/${this.pkgId}/properties`, {
      queryParams: {
        pointer: `${this.pointer || ''}/${key}/value`,
      },
    })
  }

  async copy (text: string): Promise<void> {
    let message = ''
    await copyToClipboard(text).then(success => { message = success ? 'copied to clipboard!' :  'failed to copy'})

    const toast = await this.toastCtrl.create({
      header: message,
      position: 'bottom',
      duration: 1000,
      cssClass: 'notification-toast',
    })
    await toast.present()
  }

  async showQR (text: string, ev: any): Promise<void> {
    const popover = await this.popoverCtrl.create({
      component: QRComponent,
      cssClass: 'qr-popover',
      event: ev,
      componentProps: {
        text,
      },
    })
    return await popover.present()
  }

  toggleMask (key: string) {
    this.unmasked[key] = !this.unmasked[key]
  }

  asIsOrder (a: any, b: any) {
    return 0
  }

  private async getProperties (): Promise<void> {
    try {
      const [properties] = await Promise.all([
        this.apiService.getPackageProperties({ id: this.pkgId }),
        pauseFor(600),
      ])
      this.propertyStore.update(properties.data)
    } catch (e) {
      console.error(e)
      this.error = e.message
    }
  }
}
