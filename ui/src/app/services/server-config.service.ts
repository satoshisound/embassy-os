import { Injectable } from '@angular/core'
import { ModalController } from '@ionic/angular'
import { AppConfigValuePage } from '../modals/app-config-value/app-config-value.page'
import { ApiService } from './api/api.service'
import { PropertySubject } from '../util/property-subject.util'
import { S9Server, ServerModel } from '../models/server-types'
import { ConfigSpec } from '../app-config/config-types'
import { ConfigCursor } from '../app-config/config-cursor'

@Injectable({
  providedIn: 'root',
})
export class ServerConfigService {
  server: PropertySubject<S9Server>

  constructor (
    private readonly modalCtrl: ModalController,
    private readonly apiService: ApiService,
    private readonly serverModel: ServerModel,
  ) {
    this.server = this.serverModel.watch()
  }

  async presentModalValueEdit (key: string, current?: string) {
    const cursor = new ConfigCursor(serverConfig, { [key]: current }).seekNext(key)

    const modal = await this.modalCtrl.create({
      backdropDismiss: false,
      component: AppConfigValuePage,
      presentingElement: await this.modalCtrl.getTop(),
      componentProps: {
        cursor,
        saveFn: this.saveFns[key],
      },
    })

    await modal.present()
  }

  saveFns: { [key: string]: (val: any) => Promise<any> } = {
    name: async (val: string) => {
      return this.apiService.patchServerConfig('name', val)
    },
    autoCheckUpdates: async (val: boolean) => {
      return this.apiService.patchServerConfig('autoCheckUpdates', val)
    },
    // password: async (val: string) => {
    //   return this.apiService.patchServerConfig('password', val)
    // },
    altRegistryUrl: async (val: string) => {
      return this.apiService.patchServerConfig('altRegistryUrl', val)
    },
    ssh: async (val: string) => {
      return this.apiService.addSSHKey(val)
    },
  }
}

const serverConfig: ConfigSpec = {
  name: {
    type: 'string',
    name: 'Device Name',
    description: 'A unique label for this device.',
    nullable: false,
    // @TODO determine regex
    // pattern: '',
    patternDescription: 'Must be less than 40 characters',
    masked: false,
    copyable: true,
  },
  autoCheckUpdates: {
    type: 'boolean',
    name: 'Auto Check for Updates',
    description: 'On launch, EmabssyOS will automatically check for updates of itself and your installed services. Updating still requires user approval and action. No updates will ever be performed automatically.',
    default: true,
  },
  // password: {
  //   type: 'string',
  //   name: 'Change Password',
  //   description: 'The master password for your Embassy. Must contain at least 128 bits of entropy.',
  //   nullable: false,
  //   // @TODO figure out how to confirm min entropy
  //   // pattern: '^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[*.!@#$%^&*\]).{12,32}$',
  //   patternDescription: 'Password too simple. Password must contain at least 128 bits of entroy.',
  //   changeWarning: 'Changing your password will have no affect on old backups. In order to restore old backups, you must provide the password that was used to create them.',
  //   masked: true,
  //   copyable: true,
  // },
  altRegistryUrl: {
    type: 'string',
    name: 'Marketplace URL',
    description: 'Used for connecting to an alternative service marketplace.',
    nullable: true,
    // @TODO regex for URL
    // pattern: '',
    patternDescription: 'Must be a valid URL',
    changeWarning: 'Downloading services from an alternative marketplace could result in malicious or harmful code being installed on your device.',
    masked: false,
    copyable: true,
  },
  ssh: {
    type: 'string',
    name: 'SSH Key',
    description: 'Add SSH keys to your Embassy to gain root access from the command line.',
    nullable: false,
    // @TODO regex for SSH Key
    // pattern: '',
    patternDescription: 'Must be a valid SSH key',
    masked: true,
    copyable: true,
  },
}
