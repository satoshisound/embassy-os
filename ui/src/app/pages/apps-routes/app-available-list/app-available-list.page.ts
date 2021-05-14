import { Component, NgZone } from '@angular/core'
import { ApiService } from 'src/app/services/api/api.service'
// import { AppModel } from 'src/app/models/app-model'
import { pauseFor } from 'src/app/util/misc.util'
import { Subscription, BehaviorSubject, combineLatest } from 'rxjs'
import { take } from 'rxjs/operators'
import { markAsLoadingDuringP } from 'src/app/services/loader.service'

@Component({
  selector: 'app-available-list',
  templateUrl: './app-available-list.page.html',
  styleUrls: ['./app-available-list.page.scss'],
})
export class AppAvailableListPage {
  $loading$ = new BehaviorSubject(true)
  error = ''
  installedAppDeltaSubscription: Subscription
  // apps: PropertySubjectId<AppAvailablePreview>[] = []
  // appsInstalled: PropertySubjectId<AppInstalledPreview>[] = []

  constructor (
    private readonly apiService: ApiService,
    // private readonly appModel: AppModel,
    private readonly zone: NgZone,
  ) { }

  // async ngOnInit () {
  //   this.installedAppDeltaSubscription = this.appModel
  //     .watchDelta('update')
  //     .subscribe(({ id }) => this.mergeInstalledProps(id))

  //   markAsLoadingDuringP(this.$loading$, Promise.all([
  //     this.getApps(),
  //     this.getEos(),
  //   ]))
  // }

  // ionViewDidEnter () {
  //   this.appModel.getContents().forEach(appInstalled => this.mergeInstalledProps(appInstalled.id))
  // }

  // mergeInstalledProps (appInstalledId: string) {
  //   const appAvailable  = this.apps.find(app => app.id === appInstalledId)
  //   if (!appAvailable) return

  //   const app = this.appModel.watch(appInstalledId)
  //   combineLatest([app.status, app.versionInstalled])
  //     .pipe(take(1))
  //     .subscribe(([status, versionInstalled]) => {
  //       this.zone.run(() => {
  //         appAvailable.subject.status.next(status)
  //         appAvailable.subject.versionInstalled.next(versionInstalled)
  //       })
  //     })
  // }

  // ngOnDestroy () {
  //   this.installedAppDeltaSubscription.unsubscribe()
  // }

  // async doRefresh (e: any) {
  //   await Promise.all([
  //     this.getApps(),
  //     pauseFor(600),
  //   ])
  //   e.target.complete()
  // }

  // async getApps (): Promise<void> {
  //   try {
  //     this.apps = await this.apiService.getAvailableApps().then(apps =>
  //       apps
  //         .sort( (a1, a2) => a2.latestVersionTimestamp.getTime() - a1.latestVersionTimestamp.getTime())
  //         .map(a => ({ id: a.id, subject: initPropertySubject(a) })),
  //     )
  //     this.appModel.getContents().forEach(appInstalled => this.mergeInstalledProps(appInstalled.id))
  //   } catch (e) {
  //     console.error(e)
  //     this.error = e.message
  //   }
  // }
}
