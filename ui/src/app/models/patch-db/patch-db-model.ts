import { Injectable } from '@angular/core'
import { PatchDB, PatchDbConfig, Store } from 'patch-db-client'
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import { exists } from '../../util/misc.util'
import { DataModel } from './data-model'

@Injectable({
  providedIn: 'root',
})
export class PatchDbModel {
  private patchDb: PatchDB<DataModel>
  private syncSub: Subscription

  constructor (
    private readonly conf: PatchDbConfig<DataModel>,
  ) { }

  async init (): Promise<void> {
    if (this.patchDb) return console.warn('Cannot re-init patchDbModel')
    this.patchDb = await PatchDB.init<DataModel>(this.conf)
  }

  start (): void {
    if (this.syncSub) this.stop()
    this.syncSub = this.patchDb.sync$().subscribe({
      error: e => console.error('Critical, patch-db-sync sub error', e),
      complete: () => console.error('Critical, patch-db-sync sub complete'),
    })
  }

  stop (): void {
    if (this.syncSub) {
      this.syncSub.unsubscribe()
      this.syncSub = undefined
    }
  }

  watch$: Store<DataModel>['watch$'] = (...args: (string | number)[]): Observable<DataModel> => {
    const overlay$ = this.getOverlay(...args).pipe(filter(a => exists(a)))
    const base$ = this.patchDb.store.watch$(...(args as []))
    return combineLatest([overlay$, base$]).pipe(
      map(([o, b]) => {
        if (!o) return b
        if (o.expired(b)) {
          this.clearOverlay(...args)
          return b
        } else {
          return o.value
        }
      }),
    )
  }

  /* overlays allow the FE to override the patch-db values for FE behavior not represented in the BE. For example, the server status of 'Unreachable' is set with
    `setOverlay({ expired: () => true, value: 'UNREACHABLE' }, 'server', 'status')`
    And will expire as soon as a genuine server status emits from the BE.
  */
  private readonly overlays: { [path: string]: BehaviorSubject<{ value: any, expired: (newValue: any) => boolean } | null>} = { }

  setOverlay (args: { value: any, expired: (newValue: any) => boolean }, ...path: (string | number)[]): void {
    this.getOverlay(...path).next(args)
  }

  private getOverlay (...path: (string | number)[]): BehaviorSubject<{ value: any, expired: (newValue: any) => boolean } | undefined> {
    const singlePath = '/' + path.join('/')
    this.overlays[singlePath] = this.overlays[singlePath] || new BehaviorSubject(null)
    return this.overlays[singlePath]
  }

  private clearOverlay (...path: (string | number)[]): void {
    this.getOverlay(...path).next(null)
  }
}
