import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { getAntigravityVersion, setAntigravityVersion } from "../constants"
import { createLogger } from "./logger"

const DOWNLOAD_PAGE = "https://antigravity.google/download/"
const log = createLogger("version")
let initialization: Promise<void> | undefined

async function installedAppVersion(): Promise<string | undefined> {
  if (process.platform !== "darwin") return undefined
  for (const directory of ["/Applications", join(homedir(), "Applications")]) {
    const plist = await readFile(join(directory, "Antigravity.app/Contents/Info.plist"), "utf8")
      .catch(() => undefined)
    const version = plist?.match(/<key>CFBundleShortVersionString<\/key>\s*<string>(\d+\.\d+\.\d+)<\/string>/)?.[1]
    if (version) return version
  }
  return undefined
}

async function resolveVersion(): Promise<void> {
  let version = await installedAppVersion()
  let source = "installed-app"
  if (!version) {
    source = "app-download"
    try {
      // Google's download page lists App, IDE, and CLI builds with independent versions.
      const response = await fetch(DOWNLOAD_PAGE, { signal: AbortSignal.timeout(5000) })
      if (response.ok) {
        const page = await response.text()
        version = page.match(/href=["']https:\/\/storage\.googleapis\.com\/antigravity-public\/antigravity-hub\/(\d+\.\d+\.\d+)-\d+\//)?.[1]
      }
    } catch {
      log.debug("app-download-unavailable")
    }
  }
  setAntigravityVersion(version ?? getAntigravityVersion())
  log.debug("version-resolved", { version: getAntigravityVersion(), source: version ? source : "fallback" })
}

/** Share one lookup across startup discovery and concurrent transport pipelines. */
export function initAntigravityVersion(): Promise<void> {
  return initialization ??= resolveVersion()
}
