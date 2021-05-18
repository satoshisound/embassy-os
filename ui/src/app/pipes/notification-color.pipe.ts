import { Pipe, PipeTransform } from '@angular/core'
import { ServerNotification } from '../services/api/api-types'
import { isEmptyObject } from '../util/misc.util'

@Pipe({
  name: 'notificationColor',
})
export class NotificationColorPipe implements PipeTransform {
  transform (notification: ServerNotification): string {
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
}
