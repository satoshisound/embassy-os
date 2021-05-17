import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { IonicModule } from '@ionic/angular'
import { ServerConfigPage } from './server-config.page'
import { Routes, RouterModule } from '@angular/router'
import { SharingModule } from 'src/app/modules/sharing.module'
import { PwaBackComponentModule } from 'src/app/components/pwa-back-button/pwa-back.component.module'
import { ReactiveComponentModule } from '@ngrx/component'

const routes: Routes = [
  {
    path: '',
    component: ServerConfigPage,
  },
]

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SharingModule,
    RouterModule.forChild(routes),
    PwaBackComponentModule,
    ReactiveComponentModule,
  ],
  declarations: [
    ServerConfigPage,
  ],
})
export class ServerConfigPageModule { }
