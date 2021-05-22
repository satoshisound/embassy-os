// import { Component, Input } from '@angular/core'
// import { NavigationExtras } from '@angular/router'
// import { NavController } from '@ionic/angular'
// import { DependencyViolationSeverity, getViolationSeverity, isOptional, isMissing, isInstalling, isRecommended, isVersionMismatch } from 'src/app/models/app-types'
// import { DependencyEntry, PackageDataEntry } from 'src/app/models/patch-db/data-model'
// import { Recommendation } from '../../recommendation-button/recommendation-button.component'

// @Component({
//   selector: 'marketplace-dependency-item',
//   templateUrl: './marketplace-dependency-item.component.html',
//   styleUrls: ['./marketplace-dependency-item.component.scss'],
// })
// export class MarketplaceDependencyItemComponent {
//   @Input() dependency: DependencyEntry
//   @Input() dependent: PackageDataEntry
//   @Input() loading: boolean

//   presentAlertDescription = false

//   color: string
//   installing = false
//   recommended = false
//   badgeStyle: string
//   violationSeverity: DependencyViolationSeverity
//   statusText: string
//   actionText: 'View' | 'Get'

//   descriptionText: string

//   constructor (
//     private readonly navCtrl: NavController,
//   ) { }

//   ngOnInit () {
//     this.violationSeverity = getViolationSeverity(this.dependency)
//     if (isOptional(this.dependency)) throw new Error('Do not display optional deps, satisfied or otherwise, on the AAL')

//     const { actionText, color, statusText, installing } = this.getValues()

//     this.color = color
//     this.statusText = statusText
//     this.installing = installing
//     this.recommended = isRecommended(this.dependency)
//     this.actionText = actionText
//     this.badgeStyle = `background: radial-gradient(var(--ion-color-${this.color}) 40%, transparent)`
//     this.descriptionText = `<p>${this.dependency.description}<\p>`
//     if (this.recommended) {
//       this.descriptionText = this.descriptionText + `<p>This service is not required: ${this.dependency.optional}<\p>`
//     }
//   }

//   isDanger (): boolean {
//     return [DependencyViolationSeverity.REQUIRED, DependencyViolationSeverity.RECOMMENDED].includes(this.violationSeverity)
//   }

//   getValues (): { color: string, statusText: string, installing: boolean, actionText: 'View' | 'Get' } {
//     if (isInstalling(this.dependency)) return { color: 'primary', statusText: 'Installing', installing: true, actionText: undefined }
//     if (!this.isDanger()) return { color: 'success', statusText: 'Satisfied', installing: false, actionText: 'View' }
//     if (isMissing(this.dependency)) return { color: 'warning', statusText: 'Not Installed', installing: false, actionText: 'Get' }
//     if (isVersionMismatch(this.dependency)) return { color: 'warning', statusText: 'Incompatible Version Installed', installing: false, actionText: 'Get' }
//     return { color: 'success', statusText: 'Satisfied', installing: false, actionText: 'View' }
//   }

//   async toInstall () {
//     if (this.actionText === 'View') return this.navCtrl.navigateForward(`/services/marketplace/${this.dependency.id}`)

//     const verb = this.violationSeverity === DependencyViolationSeverity.REQUIRED ? 'requires' : 'recommends'
//     const description = `${this.dependent['unverified-manifest'].title} ${verb} an install of ${this.dependency.title} satisfying ${this.dependency.version}.`

//     const whyDependency = this.dependency.description

//     const installationRecommendation: Recommendation = {
//       iconURL: this.dependent.iconURL,
//       appId: this.dependent.id,
//       description,
//       title: this.dependent.title,
//       versionSpec: this.dependency.version,
//       whyDependency,
//     }
//     const navigationExtras: NavigationExtras = {
//       state: { installationRecommendation },
//     }

//     return this.navCtrl.navigateForward(`/services/marketplace/${this.dependency.id}`, navigationExtras)
//   }

// }
