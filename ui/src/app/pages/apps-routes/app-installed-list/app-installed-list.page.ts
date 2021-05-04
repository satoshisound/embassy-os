import { Component } from '@angular/core'
import { AppStatus } from 'src/app/models/app-model'
import { ConfigService } from 'src/app/services/config.service'
import { AppInstalledPreview } from 'src/app/models/app-types'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'

@Component({
  selector: 'app-installed-list',
  templateUrl: './app-installed-list.page.html',
  styleUrls: ['./app-installed-list.page.scss'],
})
export class AppInstalledListPage {
  AppStatus = AppStatus

  constructor (
    private readonly config: ConfigService,
    public patch: PatchDbModel,
  ) { }

  async launchUi (app: AppInstalledPreview, event: Event) {
    event.preventDefault()
    event.stopPropagation()
    const url = this.config.isTor() ? `http://${app.torAddress}` : `https://${app.lanAddress}`
    return window.open(url, '_blank')
  }
}
