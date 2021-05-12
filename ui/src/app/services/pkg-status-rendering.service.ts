import { PackageDataEntry, PackageMainStatus, PackageState, Status } from '../models/patch-db/data-model'

export function renderPkgStatus (pkg: PackageDataEntry, connected: boolean): PkgStatusRendering {
  if (!connected) {
    return { display: 'Connecting', color: 'warning', showDots: true }
  }

  switch (pkg.state) {
    case PackageState.Installing: return { display: 'Installing', color: 'primary', showDots: true }
    case PackageState.Updating: return { display: 'Updating', color: 'primary', showDots: true }
    case PackageState.Removing: return { display: 'Removing', color: 'warning', showDots: true }
    case PackageState.Installed: return handleInstalledState(pkg.installed.status)
  }
}

function handleInstalledState (status: Status): PkgStatusRendering {
  if (!status.configured) {
    return { display: 'Needs Config', color: 'warning', showDots: false }
  }

  Object.values(status.dependencies).find(d => d)

  switch (status.main.status) {
    case PackageMainStatus.Running: return { display: 'Running', color: 'success', showDots: false }
    case PackageMainStatus.Stopping: return { display: 'Stopping', color: 'dark', showDots: true }
    case PackageMainStatus.Stopped: return { display: 'Stopped', color: 'medium', showDots: false }
    case PackageMainStatus.BackingUp: return { display: 'Backing Up', color: 'warning', showDots: true }
    case PackageMainStatus.Restoring: return { display: 'Restoring', color: 'primary', showDots: true }
  }
}

export interface PkgStatusRendering {
  display: string
  color: string
  showDots: boolean
}
