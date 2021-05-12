import { Pipe, PipeTransform } from '@angular/core'
import { PackageDataEntry } from '../models/patch-db/data-model'
import { renderPkgStatus } from '../services/pkg-status-rendering.service'

@Pipe({
  name: 'displayBulb',
})
export class DisplayBulbPipe implements PipeTransform {

  transform (pkg: PackageDataEntry, connected: boolean, d: DisplayBulb): boolean {
    const rendering = renderPkgStatus(pkg, connected)
    switch (rendering.color) {
      case 'danger': return d === 'red'
      case 'success': return d === 'green'
      case 'warning': return d === 'yellow'
      default: return d === 'off'
    }
  }
}

type DisplayBulb = 'off' | 'red' | 'green' | 'yellow'
