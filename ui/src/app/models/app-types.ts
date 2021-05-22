// import { DependencyEntry, PackageState } from './patch-db/data-model'

// export enum DependencyViolationSeverity {
//   NONE = 0,
//   OPTIONAL = 1,
//   RECOMMENDED = 2,
//   REQUIRED = 3,
// }

// export function getViolationSeverity (r: DependencyEntry): DependencyViolationSeverity {
//   if (!r.optional && r.violation) return DependencyViolationSeverity.REQUIRED
//   if (r.optional && r.default && r.violation) return DependencyViolationSeverity.RECOMMENDED
//   if (isOptional(r) && r.violation) return DependencyViolationSeverity.OPTIONAL
//   return DependencyViolationSeverity.NONE
// }

// // // optional not recommended
// export function isOptional (r: DependencyEntry): boolean {
//   return r.optional && !r.default
// }

// export function isRecommended (r: DependencyEntry): boolean {
//   return r.optional && r.default
// }

// export function isMissing (r: DependencyEntry) {
//   return r.violation && r.violation.name === 'missing'
// }

// export function isMisconfigured (r: DependencyEntry) {
//   return r.violation && r.violation.name === 'incompatible-config'
// }

// export function isNotRunning (r: DependencyEntry) {
//   return r.violation && r.violation.name === 'incompatible-status'
// }

// export function isVersionMismatch (r: DependencyEntry) {
//   return r.violation && r.violation.name === 'incompatible-version'
// }

// export function isInstalling (r: DependencyEntry) {
//   return r.violation && r.violation.name === 'incompatible-status' && [PackageState.Installing, PackageState.Updating].includes(r.violation.status)
// }

// // both or none
// export function getInstalledViolationSeverity (r: DependencyEntry): DependencyViolationSeverity {
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
