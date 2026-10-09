import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { readManifest } = vi.hoisted(() => ({ readManifest: vi.fn() }))
vi.mock("node:fs/promises", async (original) => ({
  ...await original<typeof import("node:fs/promises")>(), readFile: readManifest,
}))

// Reset module state between tests so versionLocked starts fresh
beforeEach(() => {
  vi.resetModules()
  readManifest.mockReset().mockRejectedValue(new Error("Not installed"))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ANTIGRAVITY_VERSION_FALLBACK", () => {
  it("defaults to the exported fallback constant", async () => {
    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)
  })

  it("is at least 1.18.0 to support Gemini 3.1 Pro", async () => {
    const { getAntigravityVersion } = await import("../constants.ts")
    const [major, minor] = getAntigravityVersion().split(".").map(Number)
    expect(major).toBeGreaterThanOrEqual(1)
    if (major === 1) expect(minor).toBeGreaterThanOrEqual(18)
  })
})

describe("setAntigravityVersion", () => {
  it("updates the version on first call", async () => {
    const { getAntigravityVersion, setAntigravityVersion } = await import("../constants.ts")
    setAntigravityVersion("2.0.0")
    expect(getAntigravityVersion()).toBe("2.0.0")
  })

  it("locks after first call — subsequent calls are ignored", async () => {
    const { getAntigravityVersion, setAntigravityVersion } = await import("../constants.ts")
    setAntigravityVersion("2.0.0")
    setAntigravityVersion("3.0.0")
    expect(getAntigravityVersion()).toBe("2.0.0")
  })
})

describe("initAntigravityVersion", () => {
  it("uses the offline baseline on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unreachable")))

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)
  })

  it("uses the offline baseline on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" }),
    )

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)
  })

  it("resolves the official App build once, ignoring unrelated CLI and IDE versions", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(`
      <a href="https://example.org/cli/9.9.9/">CLI</a>
      <a href="https://storage.googleapis.com/antigravity-public/antigravity-ide/3.4.5-123/">IDE</a>
      <a href="https://storage.googleapis.com/antigravity-public/antigravity-hub/2.33.0-456/darwin-arm/Antigravity.dmg">App</a>`))
    vi.stubGlobal("fetch", fetch)

    const { getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await Promise.all([initAntigravityVersion(), initAntigravityVersion()])
    expect(fetch).toHaveBeenCalledOnce()
    expect(getAntigravityVersion()).toBe("2.33.0")
  })

  it("prefers the installed macOS App without making a network request", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin")
    readManifest.mockResolvedValue("<key>CFBundleShortVersionString</key>\n<string>2.12.2</string>")
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const { initAntigravityVersion } = await import("./version.ts")
    const { getAntigravityVersion } = await import("../constants.ts")
    await initAntigravityVersion()
    expect(getAntigravityVersion()).toBe("2.12.2")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fallback version appears in User-Agent header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")))

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityHeaders } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    const headers = getAntigravityHeaders()
    expect(headers["User-Agent"]).toContain(`Antigravity/${ANTIGRAVITY_VERSION_FALLBACK}`)
  })

  it("fallback version appears in randomized antigravity headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")))

    const { ANTIGRAVITY_VERSION_FALLBACK, getRandomizedHeaders } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    const headers = getRandomizedHeaders("antigravity")
    expect(headers["User-Agent"]).toContain(ANTIGRAVITY_VERSION_FALLBACK)
  })
})
