import { invalidatePackage } from "./cache"
import {
  findPluginEntry,
  getCachedVersion,
  getLatestVersion,
  getLocalDevVersion,
  updatePinnedVersion,
} from "./checker"
import { PACKAGE_NAME } from "./constants"
import { logAutoUpdate } from "./logging"
import type { AutoUpdateCheckerOptions } from "./types"

interface SessionCreatedData {
  parentID?: string
}

export function createAutoUpdateChecker(
  directory: string,
  options: AutoUpdateCheckerOptions = {},
) {
  const { autoUpdate = true } = options
  let hasChecked = false

  return {
    onSessionCreated(data: SessionCreatedData = {}) {
      if (data.parentID || hasChecked) return
      hasChecked = true
      setTimeout(() => {
        runBackgroundUpdateCheck(directory, autoUpdate).catch((error) => {
          logAutoUpdate(`Background update check failed: ${error}`)
        })
      }, 0)
    },
  }
}

async function runBackgroundUpdateCheck(
  directory: string,
  autoUpdate: boolean,
): Promise<void> {
  const localDevVersion = getLocalDevVersion(directory)
  if (localDevVersion) {
    logAutoUpdate(`Local development mode (${localDevVersion})`)
    return
  }

  const pluginInfo = findPluginEntry(directory)
  if (!pluginInfo) {
    logAutoUpdate("Plugin not found in config")
    return
  }

  const currentVersion = getCachedVersion() ?? pluginInfo.pinnedVersion
  if (!currentVersion) {
    logAutoUpdate("No version found (cached or pinned)")
    return
  }
  if (currentVersion.includes("-")) {
    logAutoUpdate(`Prerelease version (${currentVersion}), skipping auto-update`)
    return
  }

  const latestVersion = await getLatestVersion()
  if (!latestVersion || currentVersion === latestVersion) return

  logAutoUpdate(`Update available: ${currentVersion} → ${latestVersion}`)
  if (!autoUpdate) return

  if (pluginInfo.isPinned) {
    if (updatePinnedVersion(pluginInfo.configPath, pluginInfo.entry, latestVersion)) {
      invalidatePackage(PACKAGE_NAME)
    }
    return
  }

  invalidatePackage(PACKAGE_NAME)
}

export type { UpdateCheckResult, AutoUpdateCheckerOptions } from "./types"
export { checkForUpdate, getCachedVersion, getLatestVersion } from "./checker"
export { invalidatePackage, invalidateCache } from "./cache"
