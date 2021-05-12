import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { distinctUntilChanged } from 'rxjs/operators'
import { ApiService } from './api/api.service'
import { Storage } from '@ionic/storage'
import { StorageKeys } from '../models/storage-keys'
import { isUnauthorized } from './http.service'

export enum AuthState {
  UNVERIFIED,
  VERIFIED,
  INITIALIZING,
}
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authState$: BehaviorSubject<AuthState> = new BehaviorSubject(AuthState.INITIALIZING)

  constructor (
    private readonly api: ApiService,
    private readonly storage: Storage,
  ) {
    this.storage.create()
  }

  async init (): Promise<AuthState> {
    const loggedIn = await this.storage.get(StorageKeys.LOGGED_IN_KEY)
    if (loggedIn) {
      this.authState$.next(AuthState.VERIFIED)
      return AuthState.VERIFIED
    } else {
      this.authState$.next(AuthState.UNVERIFIED)
      return AuthState.UNVERIFIED
    }
  }

  peek (): AuthState { return this.authState$.getValue() }

  watch$ (): Observable<AuthState> {
    return this.authState$.pipe(distinctUntilChanged())
  }

  async login (password: string): Promise<void> {
    try {
      await this.api.login({ password })
      await this.storage.set(StorageKeys.LOGGED_IN_KEY, true)
      this.authState$.next(AuthState.VERIFIED)
    } catch (e) {
      if (isUnauthorized(e)) {
        this.authState$.next(AuthState.UNVERIFIED)
        throw { name: 'invalid', message: 'invalid credentials' }
      }
      console.error(`Failed login attempt`, e)
      throw e
    }
  }

  async setAuthStateUnverified (): Promise<void> {
    this.authState$.next(AuthState.UNVERIFIED)
  }
}
