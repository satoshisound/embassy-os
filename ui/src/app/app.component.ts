import { Component } from '@angular/core'
import { ServerStatus } from './models/server-model'
import { Storage } from '@ionic/storage'
import { AuthService, AuthState } from './services/auth.service'
import { ApiService } from './services/api/api.service'
import { Router } from '@angular/router'
import { BehaviorSubject } from 'rxjs'
import { filter, takeWhile, tap } from 'rxjs/operators'
import { AlertController } from '@ionic/angular'
import { LoaderService } from './services/loader.service'
import { Emver } from './services/emver.service'
import { SplitPaneTracker } from './services/split-pane.service'
import { LoadingOptions } from '@ionic/core'
import { pauseFor } from './util/misc.util'
import { PatchDbModel } from './models/patch-db/patch-db-model'
import { HttpService } from './services/http.service'

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  fullPageMenu = true
  showMenuContent$ = new BehaviorSubject(false)
  selectedIndex = 0
  isUpdating = false
  untilLoaded = true
  appPages = [
    {
      title: 'Services',
      url: '/services/installed',
      icon: 'grid-outline',
    },
    {
      title: 'Embassy',
      url: '/embassy',
      icon: 'cube-outline',
    },
    {
      title: 'Marketplace',
      url: '/services/marketplace',
      icon: 'storefront-outline',
    },
    {
      title: 'Notifications',
      url: '/notifications',
      icon: 'notifications-outline',
    },
  ]

  constructor (
    private readonly storage: Storage,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly api: ApiService,
    private readonly http: HttpService,
    private readonly alertCtrl: AlertController,
    private readonly loader: LoaderService,
    private readonly emver: Emver,
    private readonly patch: PatchDbModel,
    readonly splitPane: SplitPaneTracker,
  ) {
    // set dark theme
    document.body.classList.toggle('dark', true)
    this.init()
  }

  ionViewDidEnter () {
    // weird bug where a browser grabbed the value 'getdots' from the app.component.html preload input field.
    // this removes that field after prleloading occurs.
    pauseFor(500).then(() => this.untilLoaded = false)
  }

  async init () {
    await this.storage.create()
    await this.patch.init()
    await this.authService.init()
    await this.emver.init()

    let fromFresh = true
    let authed = false

    const serverStatus$ = this.patch.watch$('server', 'status')
    .pipe(
      tap(status => this.isUpdating = status === ServerStatus.UPDATING),
      takeWhile(_ => !!authed),
    )

    const routerEvents$ = this.router.events
    .pipe(
      filter(e => !!(e as any).urlAfterRedirects),
      tap((e: any) => {
        const appPageIndex = this.appPages.findIndex(
          appPage => (e.urlAfterRedirects || e.url || '').startsWith(appPage.url),
        )
        if (appPageIndex > -1) this.selectedIndex = appPageIndex

        // TODO: while this works, it is dangerous and impractical.
        if (e.urlAfterRedirects !== '/embassy' && e.urlAfterRedirects !== '/authenticate' && this.isUpdating) {
          this.router.navigateByUrl('/embassy')
        }
      }),
      takeWhile(_ => !!authed),
    )

    this.authService.watch$()
    .subscribe(auth => {
      // VERIFIED
      if (auth === AuthState.VERIFIED) {
        this.http.authReqEnabled = true
        this.showMenuContent$.next(true)
        this.patch.start()
        serverStatus$.subscribe()
        routerEvents$.subscribe()
      // UNVERIFIED
      } else if (auth === AuthState.UNVERIFIED) {
        authed = false
        this.http.authReqEnabled = false
        this.patch.stop()
        this.storage.clear()
        this.router.navigate(['/authenticate'], { replaceUrl: true })
        this.showMenuContent$.next(false)
      }

      if (fromFresh) {
        this.router.initialNavigation()
        fromFresh = false
      }
    })

    this.http.watch401$().subscribe(() => {
      this.authService.setAuthStateUnverified()
    })
  }

  async presentAlertLogout () {
    const alert = await this.alertCtrl.create({
      backdropDismiss: false,
      header: 'Caution',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Logout',
          cssClass: 'alert-danger',
          handler: () => {
            this.logout()
          },
        },
      ],
    })
    await alert.present()
  }

  private async logout () {
    this.loader.of(LoadingSpinner('Logging out...'))
    .displayDuringP(this.api.logout())
    .then(() => this.authService.setAuthStateUnverified())
    .catch(e => this.setError(e))
  }

  async setError (e: Error) {
    console.error(e)
    await this.presentError(e.message)
  }

  async presentError (e: string) {
    const alert = await this.alertCtrl.create({
      backdropDismiss: true,
      message: `Exception on logout: ${e}`,
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel',
        },
      ],
    })
    await alert.present()
  }

  splitPaneVisible (e: any) {
    this.splitPane.$menuFixedOpenOnLeft$.next(e.detail.visible)
  }
}

const LoadingSpinner: (m?: string) => LoadingOptions = (m) => {
  const toMergeIn = m ? { message: m } : { }
  return {
    spinner: 'lines',
    cssClass: 'loader',
    ...toMergeIn,
  } as LoadingOptions
}
