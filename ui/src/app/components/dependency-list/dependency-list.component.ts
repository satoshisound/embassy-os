import { Component, Input } from '@angular/core'
// import { isOptional } from 'src/app/models/app-types'
import { DependencyEntry, DependencyInfo, PackageDataEntry } from 'src/app/models/patch-db/data-model'

@Component({
  selector: 'dependency-list',
  templateUrl: './dependency-list.component.html',
  styleUrls: ['./dependency-list.component.scss'],
})
export class DependencyListComponent {
  @Input() type: 'installed' | 'available'
  @Input() dependent: PackageDataEntry
  @Input() dependencies: DependencyInfo
  @Input() loading: boolean
  depsToDisplay: DependencyEntry[]

  constructor () { }

  // ngOnInit () {
  //   this.filterDeps()
  // }

  // ngOnChanges () {
  //   this.filterDeps()
  // }

  // private filterDeps (): void {
  //   this.depsToDisplay = Object.values(this.dependencies).filter(dep =>
  //     this.type === 'available' ? !isOptional(dep) : true,
  //   )
  // }
}
