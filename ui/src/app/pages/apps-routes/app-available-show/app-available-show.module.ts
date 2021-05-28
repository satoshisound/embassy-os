import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Routes, RouterModule } from '@angular/router'
import { IonicModule } from '@ionic/angular'
import { AppAvailableShowPage } from './app-available-show.page'
import { SharingModule } from 'src/app/modules/sharing.module'
import { PwaBackComponentModule } from 'src/app/components/pwa-back-button/pwa-back.component.module'
import { BadgeMenuComponentModule } from 'src/app/components/badge-menu-button/badge-menu.component.module'
import { StatusComponentModule } from 'src/app/components/status/status.component.module'
import { RecommendationButtonComponentModule } from 'src/app/components/recommendation-button/recommendation-button.component.module'
import { InstallWizardComponentModule } from 'src/app/components/install-wizard/install-wizard.component.module'
import { InformationPopoverComponentModule } from 'src/app/components/information-popover/information-popover.component.module'

const routes: Routes = [
  {
    path: '',
    component: AppAvailableShowPage,
  },
]

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    StatusComponentModule,
    RouterModule.forChild(routes),
    SharingModule,
    PwaBackComponentModule,
    RecommendationButtonComponentModule,
    BadgeMenuComponentModule,
    InstallWizardComponentModule,
    InformationPopoverComponentModule,
  ],
  declarations: [AppAvailableShowPage],
})
export class AppAvailableShowPageModule { }
