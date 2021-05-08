import { ConfigSpec } from 'src/app/app-config/config-types'

export interface DataModel {
  server: S9Server
  'package-data': { [id: string]: PackageDataEntry }
  ui: {
    name: string
    'welcome-ack': string
    'auto-check-updates': boolean
  }
}

export interface S9Server {
  id: string
  version: string
  updating: boolean
  specs: ServerSpecs
  'alt-registry': URL
  wifi: WiFi
  ssh: SSHFingerprint[]
  disks: DiskInfo[]
  notifications: ServerNotification[]
}

export interface PackageDataEntry {
  state: PackageState
  installed?: InstalledPackageDataEntry, // installed, updating, removing
  'install-progress'?: InstallProgress, // installing, updating
}

export interface InstallProgress {
  size: number | null
  downloaded: number
  'download-complete': boolean
  validated: number
  'validation-complete': boolean
  read: number
  'read-complete': boolean
}

export interface InstalledPackageDataEntry {
  manifest: Manifest
  status: Status
  'interface-info': InterfaceInfo
}

export enum PackageState {
  Installing = 'installing',
  Updating = 'updating',
  Removing = 'removing',
  Installed = 'installed',
}

export interface Manifest {
  id: string
  title: string
  version: string
  description: {
    short: string
    long: string
  }
  'release-notes': string
  license: string
  'wrapper-repo': URL
  'upstream-repo': URL
  'support-site': URL
  'marketing-site': URL
  alerts: {
    install: string | null
    uninstall: string | null
    restore: string | null
    start: string | null
    stop: string | null
  }
  main: ActionImpl
  'health-check': ActionImpl
  config: ConfigActions | null
  volumes: { [id: string]: Volume }
  'min-os-version': string
  interfaces: InterfaceDef
  backup: BackupActions
  migrations: Migrations
  actions: { [id: string]: Action }
  permissions: any // @TODO
  dependencies: { [id: string]: Dependency}
}

export interface ActionImpl {
  type: 'docker'
  image: string
  system: boolean
  entrypoint: string
  args: string[]
  mounts: { [id: string]: string }
  'io-format': DockerIoFormat | null
  inject: boolean
  'shm-size': string
}

export enum DockerIoFormat {
  Json = 'json',
  Yaml = 'yaml',
  Cbor = 'cbor',
  Toml = 'toml',
}

export interface ConfigActions {
  get: ActionImpl
  set: ActionImpl
}

export type Volume = VolumeData

export interface VolumeData {
  type: VolumeType.Data
  readonly: boolean
}

export interface VolumePointer {
  type: VolumeType.Pointer
  'package-id': string
  'volume-id': string
  path: string
  readonly: boolean
}

export interface VolumeCertificate {
  type: VolumeType.Certificate
  'interface-id': string
}

export interface VolumeHiddenService {
  type: VolumeType.HiddenService
  'interface-id': string
}

export interface VolumeBackup {
  type: VolumeType.Backup
  readonly: boolean
}

export enum VolumeType {
  Data = 'data',
  Pointer = 'pointer',
  Certificate = 'certificate',
  HiddenService = 'hidden-service',
  Backup = 'backup',
}

export interface InterfaceDef {
  'tor-config': TorConfig | null
  'lan-config': LanConfig | null
  ui: boolean
  protocols: string[]
}

export interface TorConfig {
  'hidden-service-version': string
  'port-mapping': { [port: number]: number }
}

export type LanConfig = {
  [port: number]: { ssl: boolean, mapping: number }
}

export interface BackupActions {
  create: ActionImpl
  restore: ActionImpl
}

export interface Migrations {
  from: { [versionRange: string]: ActionImpl }
  to: { [versionRange: string]: ActionImpl }
}

export interface Action {
  name: string
  description: string
  warning: string | null
  implementation: ActionImpl
  'allowed-statuses': (PackageMainStatus.Stopped | PackageMainStatus.Running)[]
  'input-spec': ConfigSpec
}

export interface Status {
  configured: boolean
  main: MainStatus
  dependencies: { [id: string]: DependencyError }
}

export type MainStatus = MainStatusStopped | MainStatusRunning | MainStatusBackingUp | MainStatusRestoring

export interface MainStatusStopped {
  status: PackageMainStatus.Stopped
}

export interface MainStatusRunning {
  status: PackageMainStatus.Running
  main: HealthCheckResult
  interfaces: { [id: string]: HealthCheckResult }
}

export interface MainStatusBackingUp {
  status: PackageMainStatus.BackingUp
  running: boolean
}

export interface MainStatusRestoring {
  status: PackageMainStatus.Restoring
  running: boolean
}

export enum PackageMainStatus {
  Stopped = 'stopped',
  Running = 'running',
  BackingUp = 'backing-up',
  Restoring = 'restoring',
}

export type HealthCheckResult = HealthCheckResultDisabled | HealthCheckResultSuccess | HealthCheckResultFailure

export interface HealthCheckResultDisabled {
  time: string // UTC date string
  result: 'disabled'
}

export interface HealthCheckResultSuccess {
  time: string // UTC date string
  result: 'success'
}

export interface HealthCheckResultFailure {
  time: string // UTC date string
  result: 'failure'
  error: string
}

export type DependencyError = DependencyErrorNotInstalled | DependencyErrorNotRunning | DependencyErrorIncorrectVersion | DependencyErrorConfigUnsatisfied | DependencyErrorHealthCheckFailed | DependencyErrorInterfaceHealthChecksFailed

export interface DependencyErrorNotInstalled {
  type: 'not-installed'
}

export interface DependencyErrorNotRunning {
  type: 'not-running'
}

export interface DependencyErrorIncorrectVersion {
  type: 'incorrect-version'
  expected: string // version range
  received: string // version
}

export interface DependencyErrorConfigUnsatisfied {
  type: 'config-unsatisfied'
  errors: string[]
}

export interface DependencyErrorHealthCheckFailed {
  check: HealthCheckResult
}

export interface DependencyErrorInterfaceHealthChecksFailed {
  failures: { [id: string]: HealthCheckResult }
}

export interface Dependency {
  version: string
  optional: string | null
  description: string | null
  config: ConfigRuleEntryWithSuggestions[]
  interfaces: any[] // @TODO placeholder
}

export interface ConfigRuleEntryWithSuggestions {
  rule: string
  description: string
  suggestions: Suggestion[]
}

export interface Suggestion {
  condition: string | null
  set?: {
    var: string
    to?: string
    'to-value'?: any
    'to-entropy'?: { charset: string, len: number }
  }
  delete?: string
  push?: {
    to: string
    value: any
  }
}

export interface InterfaceInfo {
  ip: string
  addresses: {
    [id: string]: { 'tor-address': string, 'lan-address': string }
  }
}

export type URL = string

export interface ServerSpecs {
  [key: string]: string | number
}

export interface WiFi {
  ssids: string[]
  current: string | null
}

export interface SSHFingerprint {
  alg: string
  hash: string
  hostname: string
}

export interface DiskInfo {
  logicalname: string,
  size: string,
  description: string | null,
  partitions: PartitionInfo[]
}

export interface PartitionInfo {
  logicalname: string,
  'is-mounted': boolean, // We do not allow backups to mounted partitions
  size: string | null,
  label: string | null,
}

export interface ServerNotification {
  id: string
  appId: string
  createdAt: string
  code: string
  title: string
  message: string
}
