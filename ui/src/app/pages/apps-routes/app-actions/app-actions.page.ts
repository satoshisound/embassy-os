import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ApiService } from 'src/app/services/api/api.service'
import { AlertController } from '@ionic/angular'
import { LoaderService } from 'src/app/services/loader.service'
import { AppAction, AppInstalledFull } from 'src/app/models/app-types'
import { AppStatus } from 'src/app/models/app-model'
import { HttpErrorResponse } from '@angular/common/http'
import { PatchDbModel } from 'src/app/models/patch-db/patch-db-model'
import { Observable } from 'rxjs'

@Component({
  selector: 'app-actions',
  templateUrl: './app-actions.page.html',
  styleUrls: ['./app-actions.page.scss'],
})
export class AppActionsPage {
  app$: Observable<AppInstalledFull>

  constructor (
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    private readonly alertCtrl: AlertController,
    private readonly loaderService: LoaderService,
    public readonly patch: PatchDbModel,
  ) { }

  ngOnInit () {
    const appId = this.route.snapshot.paramMap.get('appId')
    this.app$ = this.patch.watch$('apps', appId)
  }

  async handleAction (app: AppInstalledFull, action: AppAction) {
    if (action.allowedStatuses.includes(app.status)) {
      const alert = await this.alertCtrl.create({
        header: 'Confirm',
        message: `Are you sure you want to execute action "${action.name}"? ${action.warning ? action.warning : ''}`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Execute',
            handler: () => {
              this.executeAction(app.id, action)
            },
          },
        ],
      })
      await alert.present()
    } else {
      const joinStatuses = (statuses: AppStatus[]) => {
        const last = statuses.pop()
        let s = statuses.join(', ')
        if (last) {
          if (statuses.length > 1) { // oxford comma
            s += ','
          }
          s += ` or ${last}`
        }
        return s
      }
      const alert = await this.alertCtrl.create({
        header: 'Forbidden',
        message: `Action "${action.name}" can only be executed when service is ${joinStatuses(action.allowedStatuses)}`,
        buttons: ['OK'],
        cssClass: 'alert-error-message',
      })
      await alert.present()
    }
  }

  private async executeAction (id: string, action: AppAction) {
    try {
      const res = await this.loaderService.displayDuringP(
        this.apiService.appAction(id, action),
      )

      const successAlert = await this.alertCtrl.create({
        header: 'Execution Complete',
        message: res.split('\n').join('</br ></br />'),
        buttons: ['OK'],
        cssClass: 'alert-success-message',
      })
      return await successAlert.present()
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        this.presentAlertActionFail(e.status, e.message)
      } else {
        this.presentAlertActionFail(-1, e.message || JSON.stringify(e))
      }
    }
  }

  private async presentAlertActionFail (code: number, message: string): Promise<void> {
    const failureAlert = await this.alertCtrl.create({
      header: 'Execution Failed',
      message: `Error code ${code}. ${message}`,
      buttons: ['OK'],
      cssClass: 'alert-error-message',
    })
    return await failureAlert.present()
  }
}
