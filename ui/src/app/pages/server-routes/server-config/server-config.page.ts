import { Component } from '@angular/core'
import { ServerConfigService } from 'src/app/services/server-config.service'
import { PropertySubject } from 'src/app/util/property-subject.util'
import { S9Server } from 'src/app/models/server-model'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'

@Component({
  selector: 'server-config',
  templateUrl: './server-config.page.html',
  styleUrls: ['./server-config.page.scss'],
})
export class ServerConfigPage {
  server: PropertySubject<S9Server>

  constructor (
    private readonly serverConfigService: ServerConfigService,
    public readonly patch: PatchDbModel,
  ) { }

  async presentModalValueEdit (key: string, current?: string): Promise<void> {
    await this.serverConfigService.presentModalValueEdit(key, current)
  }
}
