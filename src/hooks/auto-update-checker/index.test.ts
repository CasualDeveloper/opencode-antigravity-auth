import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./checker", () => ({
  getCachedVersion: vi.fn(),
  getLocalDevVersion: vi.fn(),
  findPluginEntry: vi.fn(),
  getLatestVersion: vi.fn(),
  updatePinnedVersion: vi.fn(),
}))

vi.mock("./cache", () => ({
  invalidatePackage: vi.fn(),
}))

vi.mock("../../plugin/debug", () => ({
  debugLogToFile: vi.fn(),
}))

import { createAutoUpdateChecker } from "./index"
import {
  findPluginEntry,
  getCachedVersion,
  getLatestVersion,
  getLocalDevVersion,
  updatePinnedVersion,
} from "./checker"
import { invalidatePackage } from "./cache"

function pluginInfo() {
  return {
    configPath: "/test/.config/opencode/opencode.json",
    entry: "@chrisgeo/opencode-antigravity-auth@1.7.0",
    pinnedVersion: "1.7.0",
    isPinned: true,
  }
}

describe("v2 auto-update checker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(getLocalDevVersion).mockReturnValue(null)
    vi.mocked(findPluginEntry).mockReturnValue(pluginInfo())
    vi.mocked(getCachedVersion).mockReturnValue(null)
    vi.mocked(getLatestVersion).mockResolvedValue("2.0.0")
    vi.mocked(updatePinnedVersion).mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("updates a stable pinned V2 plugin entry", async () => {
    createAutoUpdateChecker("/test").onSessionCreated()
    await vi.runAllTimersAsync()

    expect(updatePinnedVersion).toHaveBeenCalledWith(
      "/test/.config/opencode/opencode.json",
      "@chrisgeo/opencode-antigravity-auth@1.7.0",
      "2.0.0",
    )
    expect(invalidatePackage).toHaveBeenCalledOnce()
  })

  it("does not mutate config when auto-update is disabled", async () => {
    createAutoUpdateChecker("/test", { autoUpdate: false }).onSessionCreated()
    await vi.runAllTimersAsync()

    expect(getLatestVersion).toHaveBeenCalledOnce()
    expect(updatePinnedVersion).not.toHaveBeenCalled()
    expect(invalidatePackage).not.toHaveBeenCalled()
  })

  it("checks only the first root session", async () => {
    const checker = createAutoUpdateChecker("/test")
    checker.onSessionCreated({ parentID: "parent" })
    checker.onSessionCreated()
    checker.onSessionCreated()
    await vi.runAllTimersAsync()

    expect(findPluginEntry).toHaveBeenCalledOnce()
  })

  it("skips prerelease versions", async () => {
    vi.mocked(findPluginEntry).mockReturnValue({
      ...pluginInfo(),
      entry: "@chrisgeo/opencode-antigravity-auth@2.0.0-beta.1",
      pinnedVersion: "2.0.0-beta.1",
    })
    createAutoUpdateChecker("/test").onSessionCreated()
    await vi.runAllTimersAsync()

    expect(getLatestVersion).not.toHaveBeenCalled()
  })

  it("skips update checks for local development entries", async () => {
    vi.mocked(getLocalDevVersion).mockReturnValue("2.0.0-dev")
    createAutoUpdateChecker("/test").onSessionCreated()
    await vi.runAllTimersAsync()

    expect(findPluginEntry).not.toHaveBeenCalled()
  })
})
