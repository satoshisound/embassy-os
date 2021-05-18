import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { IonicModule } from '@ionic/angular'
import { AuthenticatePageRoutingModule } from './authenticate-routing.module'
import { AuthenticatePage } from './authenticate.page'
import { SharingModule } from 'src/app/modules/sharing.module'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AuthenticatePageRoutingModule,
    SharingModule,
  ],
  declarations: [AuthenticatePage],
})
export class AuthenticatePageModule { }
