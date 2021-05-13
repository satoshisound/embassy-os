import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { IonicModule } from '@ionic/angular'
import { BackupPage } from './backup.page'
import { BackupConfirmationComponentModule } from 'src/app/modals/backup-confirmation/backup-confirmation.component.module'

@NgModule({
  declarations: [BackupPage],
  imports: [
    CommonModule,
    IonicModule,
    BackupConfirmationComponentModule,
  ],
  entryComponents: [BackupPage],
  exports: [BackupPage],
})
export class BackupPageModule { }