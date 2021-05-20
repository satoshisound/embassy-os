import { Component } from '@angular/core'
import { AuthService } from '../../services/auth.service'
import { LoaderService } from '../../services/loader.service'
import { Router } from '@angular/router'

@Component({
  selector: 'app-authenticate',
  templateUrl: './authenticate.page.html',
  styleUrls: ['./authenticate.page.scss'],
})
export class AuthenticatePage {
  password: string = ''
  unmasked = false
  error = ''

  constructor (
    private readonly authStore: AuthService,
    private readonly loader: LoaderService,
    private readonly router: Router,
  ) { }

  ionViewDidEnter () {
    this.error = ''
  }

  toggleMask () {
    this.unmasked = !this.unmasked
  }

  async submitPassword () {
    try {
      await this.loader.displayDuringP(
        this.authStore.login(this.password),
      )
      this.password = ''
      return this.router.navigate([''])
    } catch (e) {
      this.error = e.message
    }
  }
}
