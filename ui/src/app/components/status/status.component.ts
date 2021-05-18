import { Component, Input } from '@angular/core'
import { PackageDataEntry } from 'src/app/models/patch-db/data-model'
import { ConnectionState } from 'src/app/services/connection.service'
import { renderPkgStatus } from 'src/app/services/pkg-status-rendering.service'

@Component({
  selector: 'status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss'],
})
export class StatusComponent {
  @Input() pkg: PackageDataEntry
  @Input() connection: ConnectionState
  @Input() size: 'small' | 'medium' | 'large' | 'italics-small' | 'bold-large' = 'large'
  display = ''
  color = ''
  showDots = false

  ngOnChanges () {
    const { display, color, showDots } = renderPkgStatus(this.pkg, this.connection)
    this.display = display
    this.color = color
    this.showDots = showDots
  }
}

