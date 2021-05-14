// import { Component, Input, OnInit } from '@angular/core'
// import { PopoverController } from '@ionic/angular'
// import { BehaviorSubject, Subject } from 'rxjs'
// import { DependencyViolationSeverity, getViolationSeverity } from 'src/app/models/app-types'
// import { DependencyEntry, DependencyInfo, PackageState } from 'src/app/models/patch-db/data-model'
// import { displayEmver } from 'src/app/pipes/emver.pipe'
// import { InformationPopoverComponent } from '../../information-popover/information-popover.component'
// import { Loadable } from '../loadable'
// import { WizardAction } from '../wizard-types'

// @Component({
//   selector: 'dependencies',
//   templateUrl: './dependencies.component.html',
//   styleUrls: ['../install-wizard.component.scss'],
// })
// export class DependenciesComponent implements OnInit, Loadable {
//   @Input() params: {
//     action: WizardAction,
//     title: string,
//     version: string,
//     serviceRequirements: DependencyInfo
//   }

//   filteredServiceRequirements: DependencyInfo

//   $loading$ = new BehaviorSubject(false)
//   $cancel$ = new Subject<void>()

//   longMessage: string
//   dependencyViolations: {
//     iconURL: string
//     title: string,
//     versionSpec: string,
//     violation: string,
//     color: string,
//     badgeStyle: string
//   }[]
//   label: string
//   $color$ = new BehaviorSubject('medium')

//   constructor (private readonly popoverController: PopoverController) { }

//   load () {
//     this.$color$.next(this.$color$.getValue())
//   }

//   ngOnInit () {
//     this.filteredServiceRequirements = this.params.serviceRequirements.filter(dep => {
//       return [DependencyViolationSeverity.REQUIRED, DependencyViolationSeverity.RECOMMENDED].includes(getViolationSeverity(dep))
//     })
//     .filter(dep => ['incompatible-version', 'missing'].includes(dep.violation.name))

//     this.dependencyViolations = this.filteredServiceRequirements
//     .map(dep => ({
//       iconURL: dep.iconURL,
//       title: dep.title,
//       versionSpec: (dep.violation && dep.violation.name === 'incompatible-config' && 'reconfigure') || dep.versionSpec,
//       isInstalling: dep.violation && dep.violation.name === 'incompatible-status' && [PackageState.Installing, PackageState.Updating].includes(dep.violation.status),
//       violation: renderViolation(dep),
//       color: 'medium',
//       badgeStyle: `background: radial-gradient(var(--ion-color-warning) 40%, transparent)`,
//     }))

//     this.setSeverityAttributes()
//   }

//   setSeverityAttributes () {
//     switch (getWorstViolationSeverity(this.filteredServiceRequirements)){
//       case DependencyViolationSeverity.REQUIRED:
//         this.longMessage = `${this.params.title} requires the installation of other services. Don't worry, you'll be able to install these requirements later.`
//         this.label = 'Notice'
//         this.$color$.next('dark')
//         break
//       case DependencyViolationSeverity.RECOMMENDED:
//         this.longMessage = `${this.params.title} recommends the installation of other services. Don't worry, you'll be able to install these requirements later.`
//         this.label = 'Notice'
//         this.$color$.next('dark')
//         break
//       default:
//         this.longMessage = `All installation requirements for ${this.params.title} version ${displayEmver(this.params.version)} are met.`
//         this.$color$.next('success')
//         this.label = `Ready`
//     }
//   }

//   async presentPopover (ev: any, information: string) {
//     const popover = await this.popoverController.create({
//       component: InformationPopoverComponent,
//       event: ev,
//       translucent: false,
//       showBackdrop: true,
//       backdropDismiss: true,
//       componentProps: {
//         information,
//       },
//     })
//     return popover.present()
//   }
// }

// function renderViolation1 (dep: DependencyEntry): string {
//   const severity = getViolationSeverity(dep)
//   switch (severity){
//     case DependencyViolationSeverity.REQUIRED: return 'mandatory'
//     case DependencyViolationSeverity.RECOMMENDED: return 'recommended'
//     case DependencyViolationSeverity.OPTIONAL: return 'optional'
//     case DependencyViolationSeverity.NONE: return 'none'
//   }
// }

// function renderViolation (dep: DependencyEntry): string {
//   const severity = renderViolation1(dep)
//   if (severity === 'none') return ''

//   switch (dep.violation.name){
//     case 'missing': return `${severity}`
//     case 'incompatible-version': return `${severity}`
//     case 'incompatible-config': return ``
//     case 'incompatible-status': return ''
//     default: return ''
//   }
// }

// function getWorstViolationSeverity (rs: DependencyInfo) : DependencyViolationSeverity {
//   if (!rs) return DependencyViolationSeverity.NONE
//   return rs.map(getViolationSeverity).sort( (a, b) => b - a )[0] || DependencyViolationSeverity.NONE
// }
