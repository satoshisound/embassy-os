import { Component, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ApiService } from 'src/app/services/api/api.service'
import { IonContent } from '@ionic/angular'
import { pauseFor } from 'src/app/util/misc.util'
import { markAsLoadingDuringP } from 'src/app/services/loader.service'
import { BehaviorSubject } from 'rxjs'

@Component({
  selector: 'app-logs',
  templateUrl: './app-logs.page.html',
  styleUrls: ['./app-logs.page.scss'],
})
export class AppLogsPage {
  @ViewChild(IonContent, { static: false }) private content: IonContent
  appId: string
  logs = ''
  error = ''

  constructor (
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
  ) { }

  ngOnInit () {
    this.appId = this.route.snapshot.paramMap.get('appId')
    this.getLogs()
  }

  async getLogs () {
    this.logs = ''

    try {
      const logs = await Promise.all([
        this.apiService.getAppLogs(this.appId),
        pauseFor(600),
      ])
      this.logs = logs.join('\n\n')
      setTimeout(async () => await this.content.scrollToBottom(100), 200)
    } catch (e) {
      this.error = e.message
    }
  }
}
