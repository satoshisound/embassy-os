import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { concatMap, take, tap } from 'rxjs/operators'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'
import { HttpService, Method } from 'src/app/services/http.service'

@Component({
  selector: 'app-instructions',
  templateUrl: './app-instructions.page.html',
  styleUrls: ['./app-instructions.page.scss'],
})
export class AppInstructionsPage {
  instructions: string
  loading = true

  constructor (
    private readonly route: ActivatedRoute,
    private readonly http: HttpService,
    private readonly patch: PatchDbModel,
  ) { }

  async ngOnInit () {
    const pkgId = this.route.snapshot.paramMap.get('pkgId')
    this.patch.watch$('package-data', pkgId)
    .pipe(
      concatMap(pkg => {
        const opts = {
          method: Method.GET,
          url: pkg['static-files'].instructions,
        }
        return this.http.httpRequest<string>(opts)
      }),
      tap(instructions => {
        this.instructions = instructions
        this.loading = false
      }),
      take(1),
    )
    .subscribe(url => url)
  }
}
