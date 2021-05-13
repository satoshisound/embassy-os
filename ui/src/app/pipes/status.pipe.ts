import { Pipe, PipeTransform } from '@angular/core'
import { PackageDataEntry } from '../models/patch-db/data-model'
import { FEStatus, renderPkgStatus } from '../services/pkg-status-rendering.service'

@Pipe({
  name: 'status',
})
export class StatusPipe implements PipeTransform {
  transform (pkg: PackageDataEntry, connected: boolean): FEStatus {
    return renderPkgStatus(pkg, connected).feStatus
  }
}