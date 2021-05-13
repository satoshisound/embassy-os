import { Component, Input } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { PackageDataEntry } from 'src/app/models/patch-db/data-model'
import { renderPkgStatus } from 'src/app/services/pkg-status-rendering.service'

@Component({
  selector: 'status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
})
export class StatusComponent {
  @Input() pkg: PackageDataEntry
  @Input() connected: boolean
  @Input() size: 'small' | 'medium' | 'large' | 'italics-small' | 'bold-large' = 'large'
  display = new BehaviorSubject<string>(undefined)

  ngOnChanges () {
    this.display.next(renderPkgStatus(this.pkg, this.connected).display)
  }
}

