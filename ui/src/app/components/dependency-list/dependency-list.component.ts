import { Component, Input } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
// import { isOptional } from 'src/app/models/app-types'
import { DependencyEntry, DependencyInfo, PackageDataEntry } from 'src/app/models/patch-db/data-model'

@Component({
  selector: 'dependency-list',
  templateUrl: './dependency-list.component.html',
  styleUrls: ['./dependency-list.component.scss'],
})
export class DependencyListComponent {
  @Input() depType: 'installed' | 'available' = 'available'
  @Input() hostApp: PackageDataEntry
  @Input() dependencies: DependencyInfo
  depsToDisplay: DependencyEntry[]
  @Input() $loading$: BehaviorSubject<boolean> = new BehaviorSubject(true)

  constructor () { }

  // ngOnInit () {
  //   this.filterDeps()
  // }

  // ngOnChanges () {
  //   this.filterDeps()
  // }

  // private filterDeps (): void {
  //   this.depsToDisplay = Object.values(this.dependencies).filter(dep =>
  //     this.depType === 'available' ? !isOptional(dep) : true,
  //   )
  // }
}
