// import { Dependency, PackageState } from './patch-db/data-model'

// export enum DependencyViolationSeverity {
//   NONE = 0,
//   OPTIONAL = 1,
//   RECOMMENDED = 2,
//   REQUIRED = 3,
// }

// export function getViolationSeverity (r: Dependency): DependencyViolationSeverity {
//   if (!r.optional && r.violation) return DependencyViolationSeverity.REQUIRED
//   if (r.optional && r.default && r.violation) return DependencyViolationSeverity.RECOMMENDED
//   if (isOptional(r) && r.violation) return DependencyViolationSeverity.OPTIONAL
//   return DependencyViolationSeverity.NONE
// }

// // optional not recommended
// export function isOptional (r: Dependency): boolean {
//   return r.optional && !r.default
// }

// export function isRecommended (r: AppDependency): boolean {
//   return r.optional && r.default
// }

// export function isMissing (r: AppDependency) {
//   return r.violation && r.violation.name === 'missing'
// }

// export function isMisconfigured (r: AppDependency) {
//   return r.violation && r.violation.name === 'incompatible-config'
// }

// export function isNotRunning (r: AppDependency) {
//   return r.violation && r.violation.name === 'incompatible-status'
// }

// export function isVersionMismatch (r: AppDependency) {
//   return r.violation && r.violation.name === 'incompatible-version'
// }

// export function isInstalling (r: AppDependency) {
//   return r.violation && r.violation.name === 'incompatible-status' && [PackageState.Installing, PackageState.Updating].includes(r.violation.status)
// }


// // both or none
// export function getInstalledViolationSeverity (r: InstalledAppDependency): DependencyViolationSeverity {
//   if (r.violation) return DependencyViolationSeverity.REQUIRED
//   return DependencyViolationSeverity.NONE
// }
// // e.g. of I try to uninstall a thing, and some installed apps break, those apps will be returned as instances of this type.
// export type DependentBreakage = Omit<BaseApp, 'versionInstalled' | 'status'>

// export type DependencyViolation =
//   { name: 'missing' } |
//   { name: 'incompatible-version' } |
//   { name: 'incompatible-config'; ruleViolations: string[]; } |
//   { name: 'incompatible-status'; status: PackageState; }
