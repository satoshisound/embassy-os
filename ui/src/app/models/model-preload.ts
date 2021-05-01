import { Injectable } from '@angular/core'
import { AppModel } from './app-model'
import { AppInstalledFull, AppInstalledPreview } from './app-types'
import { PropertySubject, PropertySubjectId } from '../util/property-subject.util'
import { S9Server } from './server-model'
import { Observable, of, from } from 'rxjs'
import { map, concatMap, take, tap } from 'rxjs/operators'
import { fromSync$ } from '../util/rxjs.util'
import { PatchDbModel } from './patch-db/patch-db-model'
import { ApiService } from '../services/api/api.service'

@Injectable({
  providedIn: 'root',
})
export class ModelPreload {
  constructor (
    private readonly appModel: AppModel,
    private readonly api: ApiService,
    private readonly patchDb: PatchDbModel,
  ) { }

  apps (): Observable<PropertySubjectId<AppInstalledFull | AppInstalledPreview>[]> {
    return fromSync$(() => this.appModel.getContents()).pipe(concatMap(apps => {
      const now = new Date()
      if (this.appModel.hasLoaded) {
        return of(apps)
      } else {
        return from(this.api.getInstalledApps()).pipe(
          map(appsRes => {
            this.appModel.upsertApps(appsRes, now)
            return this.appModel.getContents()
          }),
        )
      }}),
    )
  }

  appFull (appId: string): Observable<PropertySubject<AppInstalledFull> > {
    return fromSync$(() => this.appModel.watch(appId)).pipe(
      concatMap(app => {
        // if we haven't fetched full, don't return till we do
        // if we have fetched full, go ahead and return now, but fetch full again in the background
        if (!app.hasFetchedFull.getValue()) {
          return from(this.loadInstalledApp(appId))
        } else {
          this.loadInstalledApp(appId)
          return of(app)
        }
      }),
    )
  }

  async loadInstalledApp (appId: string): Promise<PropertySubject<AppInstalledFull>> {
    const now = new Date()
    return this.api.getInstalledApp(appId).then(res => {
      this.appModel.update({ id: appId, ...res, hasFetchedFull: true }, now)
      return this.appModel.watch(appId)
    })
  }

  server (): Observable<S9Server> {
    return this.patchDb.watch$('server')
      .pipe(
        concatMap(server => of(server || { } as S9Server)),
        take(1),
      )

  }
}
