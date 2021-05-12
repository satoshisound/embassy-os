import { Pipe, PipeTransform } from '@angular/core'
import { PackageDataEntry, PackageState, Manifest } from '../models/patch-db/data-model'
import { ConfigService } from '../services/config.service'

@Pipe({
  name: 'hasUi',
})
export class HasUiPipe implements PipeTransform {

  constructor (private configService: ConfigService) { }

  transform (pkg: PackageDataEntry): boolean {
    const interfaces = getManifest(pkg).interfaces
    return this.configService.hasUi(interfaces)
  }
}

@Pipe({
  name: 'isLaunchable',
})
export class LaunchablePipe implements PipeTransform {

  constructor (private configService: ConfigService) { }

  transform (pkg: PackageDataEntry): boolean {
    return this.configService.isLaunchable(pkg)
  }
}

@Pipe({
  name: 'manifest',
})
export class ManifestPipe implements PipeTransform {

  transform (pkg: PackageDataEntry): Manifest {
    return getManifest(pkg)
  }
}

function getManifest (pkg: PackageDataEntry): Manifest {
  if ([PackageState.Installing, PackageState.Updating].includes(pkg.state)) {
    return pkg['unverified-manifest']
  }
  return pkg.installed.manifest
}
