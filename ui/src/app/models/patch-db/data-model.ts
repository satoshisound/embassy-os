import { ConfigSpec } from 'src/app/pkg-config/config-types'
import { Breakages } from 'src/app/services/api/api-types'

export interface DataModel {
  'server-info': ServerInfo
  'package-data': { [id: string]: PackageDataEntry }
  ui: {
    'server-name': string
    'welcome-ack': string
    'auto-check-updates': boolean
  }
}

export interface ServerInfo {
  id: string
  version: string
  'lan-address': URL
  'tor-address': URL
  status: ServerStatus
  registry: URL
  wifi: WiFiInfo
  'unread-notification-count': number
  specs: {
    CPU: string
    Disk: string
    Memory: string
  }
}

export enum ServerStatus {
  Running = 'running',
  Updating = 'updating',
  BackingUp = 'backing-up',
}

export interface WiFiInfo {
  ssids: string[]
  selected: string | null
  connected: string | null
}

export interface PackageDataEntry {
  state: PackageState
  'static-files': {
    license: URL
    instructions: URL
    icon: URL
  }
  'unverified-manifest'?: Manifest // exists when: installing, updating
  installed?: InstalledPackageDataEntry, // exists when: installed, updating, removing
  'install-progress'?: InstallProgress, // exists when: installing, updating
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
  Installed = 'installed',
  Updating = 'updating',
  Removing = 'removing',
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
  license: string // name
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
  interfaces: { [id: string]: InterfaceDef }
  backup: BackupActions
  migrations: Migrations
  actions: { [id: string]: Action }
  permissions: any // @TODO
  dependencies: DependencyInfo
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
  name: string
  description: string
  ui: boolean
  'tor-config': TorConfig | null
  'lan-config': LanConfig | null
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
  dependencies: Breakages
}

export type MainStatus = MainStatusStopped | MainStatusStopping | MainStatusRunning | MainStatusBackingUp | MainStatusRestoring

export interface MainStatusStopped {
  status: PackageMainStatus.Stopped
}

export interface MainStatusStopping {
  status: PackageMainStatus.Stopping
}

export interface MainStatusRunning {
  status: PackageMainStatus.Running
  started: string // UTC date string
  health: { [id: string]: HealthCheckResult }
}

export interface MainStatusBackingUp {
  status: PackageMainStatus.BackingUp
  started: string | null // UTC date string
}

export interface MainStatusRestoring {
  status: PackageMainStatus.Restoring
  running: boolean
}

export enum PackageMainStatus {
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  BackingUp = 'backing-up',
  Restoring = 'restoring',
}

export type HealthCheckResult = HealthCheckResultWarmingUp | HealthCheckResultDisabled | HealthCheckResultSuccess | HealthCheckResultFailure

export interface HealthCheckResultWarmingUp {
  time: string // UTC date string
  result: 'warming-up'
}

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
  type: 'health-check-failed'
  check: HealthCheckResult
}

export interface DependencyErrorInterfaceHealthChecksFailed {
  type: 'interface-health-checks-failed'
  failures: { [id: string]: HealthCheckResult }
}

export interface DependencyInfo {
  [id: string]: DependencyEntry
}

export interface DependencyEntry {
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
