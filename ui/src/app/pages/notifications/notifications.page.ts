import { Component } from '@angular/core'
import { ApiService } from 'src/app/services/api/api.service'
import { pauseFor } from 'src/app/util/misc.util'
import { LoaderService } from 'src/app/services/loader.service'
import { ServerNotification } from 'src/app/services/api/api-types'

@Component({
  selector: 'notifications',
  templateUrl: 'notifications.page.html',
  styleUrls: ['notifications.page.scss'],
})
export class NotificationsPage {
  error = ''
  loading = true
  notifications: ServerNotification[] = []
  page = 1
  needInfinite = false
  readonly perPage = 20

  constructor (
    private readonly apiService: ApiService,
    private readonly loader: LoaderService,
  ) { }

  async ngOnInit () {
    this.notifications = await this.getNotifications()
    this.loading = false
  }

  async doRefresh (e: any) {
    this.page = 1
    this.notifications = await this.getNotifications(),
    e.target.complete()
  }

  async doInfinite (e: any) {
    const notifications = await this.getNotifications()
    this.notifications = this.notifications.concat(notifications)
    e.target.complete()
  }

  async getNotifications (): Promise<ServerNotification[]> {
    let notifications: ServerNotification[] = []
    try {
      [notifications] = await Promise.all([
        this.apiService.getNotifications({ page: this.page, 'per-page': this.perPage}),
        pauseFor(600),
      ])
      this.needInfinite = notifications.length >= this.perPage
      this.page++
      this.error = ''
    } catch (e) {
      console.error(e)
      this.error = e.message
    } finally {
      return notifications
    }
  }

  getColor (notification: ServerNotification): string {
    const char = notification.code.charAt(0)
    switch (char) {
      case '0':
        return 'primary'
      case '1':
        return 'success'
      case '2':
        return 'warning'
      case '3':
        return 'danger'
      default:
        return ''
    }
  }

  async remove (id: string, index: number): Promise<void> {
    this.loader.of({
      message: 'Deleting...',
      spinner: 'lines',
      cssClass: 'loader',
    }).displayDuringP(
      this.apiService.deleteNotification({ id }).then(() => {
        this.notifications.splice(index, 1)
        this.error = ''
      }),
    ).catch(e => {
      console.error(e)
      this.error = e.message
    })
  }
}

