import { Component } from '@angular/core'
import { ServerConfigService } from 'src/app/services/server-config.service'
// import { ModelPreload } from 'src/app/models/model-preload'
// import { BehaviorSubject } from 'rxjs'

@Component({
  selector: 'dev-options',
  templateUrl: './dev-options.page.html',
  styleUrls: ['./dev-options.page.scss'],
})
export class DevOptionsPage {
  // altRegistryUrl: BehaviorSubject<string>

  constructor (
    private readonly serverConfigService: ServerConfigService,
    // private readonly preload: ModelPreload,
  ) { }

  ngOnInit () {
    // this.preload.server().subscribe(s => this.altRegistryUrl = s.alternativeRegistryUrl)
  }

  async presentModalValueEdit (key: string): Promise<void> {
    await this.serverConfigService.presentModalValueEdit(key)
  }
}
