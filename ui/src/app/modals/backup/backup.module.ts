import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { IonicModule } from '@ionic/angular'
import { AppBackupPage } from './backup.page'
import { AppBackupConfirmationComponentModule } from 'src/app/components/backup-confirmation/app-backup-confirmation.component.module'

@NgModule({
  declarations: [AppBackupPage],
  imports: [
    CommonModule,
    IonicModule,
    AppBackupConfirmationComponentModule,
  ],
  entryComponents: [AppBackupPage],
  exports: [AppBackupPage],
})
export class AppBackupPageModule { }