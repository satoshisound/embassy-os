import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Observable } from 'rxjs'
import { AppInstalledFull } from 'src/app/models/app-types'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'

@Component({
  selector: 'app-instructions',
  templateUrl: './app-instructions.page.html',
  styleUrls: ['./app-instructions.page.scss'],
})
export class AppInstructionsPage {
  app$: Observable<AppInstalledFull>

  constructor (
    private readonly route: ActivatedRoute,
    public readonly patch: PatchDbModel,
  ) { }

  async ngOnInit () {
    const appId = this.route.snapshot.paramMap.get('appId')
    this.app$ = this.patch.watch$('apps', appId)
  }
}
