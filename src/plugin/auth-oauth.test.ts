import type { Plugin } from "@opencode/plugin"
import type { IntegrationMethodRegistration } from "@opencode/plugin/promise/integration"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  exchange: vi.fn(),
  manualCallback: vi.fn(),
  persist: vi.fn(),
  refresh: vi.fn(),
  startListener: vi.fn(),
}))

vi.mock("../antigravity/oauth", () => ({
  authorizeAntigravity: mocks.authorize,
  exchangeAntigravity: mocks.exchange,
}))

vi.mock("./persist-account-pool", () => ({
  persistAccountPool: mocks.persist,
}))

vi.mock("./token", () => ({
  refreshAccessToken: mocks.refresh,
}))

vi.mock("./server", () => ({
  shouldUseManualOAuthCallback: mocks.manualCallback,
  startOAuthListener: mocks.startListener,
}))

import {
  ANTIGRAVITY_METHOD_ID,
  parseOAuthCallbackInput,
  registerOAuthIntegration,
} from "./auth"

interface CapturedRegistration {
  cleanup: () => Promise<void>
  dispose: ReturnType<typeof vi.fn>
  registration: IntegrationMethodRegistration
}

interface Deferred<T> {
  promise: Promise<T>
  reject: (reason: Error) => void
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

async function captureRegistration(
  onCredentialChanged?: () => Promise<void>,
): Promise<CapturedRegistration> {
  let registration: IntegrationMethodRegistration | undefined
  const dispose = vi.fn(async () => {})
  const context = {
    integration: {
      transform: vi.fn(async (transform) => {
        transform({
          method: {
            update: (input: IntegrationMethodRegistration) => {
              registration = input
            },
          },
        })
        return { dispose }
      }),
    },
  }

  const cleanup = await registerOAuthIntegration(
    context as unknown as Pick<Plugin.Context, "integration">,
    onCredentialChanged,
  )
  if (!registration) throw new Error("OAuth registration was not captured")
  return { cleanup, dispose, registration }
}

describe("v2 OAuth integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.manualCallback.mockReturnValue(true)
    mocks.persist.mockResolvedValue(undefined)
    mocks.startListener.mockRejectedValue(new Error("listener unavailable"))
  })

  it("parses redirect URLs and code-only callbacks", () => {
    expect(parseOAuthCallbackInput("http://localhost/callback?code=abc&state=fallback", "fallback"))
      .toEqual({ code: "abc", state: "fallback" })
    expect(parseOAuthCallbackInput("abc", "fallback"))
      .toEqual({ code: "abc", state: "fallback" })
    expect(() => parseOAuthCallbackInput("abc", ""))
      .toThrow("Missing OAuth state")
  })

  it("rejects callback URLs whose state does not match the authorization attempt", () => {
    expect(() => parseOAuthCallbackInput(
      "http://localhost/callback?code=abc&state=attacker-state",
      "fallback",
    )).toThrow("OAuth state mismatch")
    expect(() => parseOAuthCallbackInput("http://localhost/callback?code=abc", "fallback"))
      .toThrow("Missing state")
  })

  it("reports OAuth errors returned by Google", () => {
    expect(() => parseOAuthCallbackInput(
      "http://localhost/callback?error=access_denied&error_description=User+cancelled&state=fallback",
      "fallback",
    )).toThrow("Google OAuth failed: User cancelled")
  })

  it("registers code OAuth and persists a successful exchange", async () => {
    const onCredentialChanged = vi.fn(async () => {})
    mocks.authorize.mockResolvedValue({
      url: "https://accounts.google.test/auth?state=fallback-state",
      verifier: "verifier",
      projectId: "",
    })
    mocks.exchange.mockResolvedValue({
      type: "success",
      refresh: "refresh-token|project-1",
      access: "access-token",
      expires: 12345,
      email: "user@example.com",
      projectId: "project-1",
    })
    const { registration } = await captureRegistration(onCredentialChanged)
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")

    expect(registration.integrationID).toBe("google")
    expect(registration.method).toEqual({
      id: "antigravity",
      type: "oauth",
      label: "Google Antigravity",
    })
    const authorization = await registration.authorize({})
    expect(authorization.mode).toBe("code")
    if (authorization.mode !== "code") throw new Error("Expected code authorization")

    const credential = await authorization.callback(
      "http://localhost/callback?code=code-1&state=fallback-state",
    )
    expect(mocks.exchange).toHaveBeenCalledWith("code-1", "fallback-state")
    expect(mocks.persist).toHaveBeenCalledOnce()
    expect(onCredentialChanged).toHaveBeenCalledOnce()
    expect(credential).toEqual({
      type: "oauth",
      methodID: ANTIGRAVITY_METHOD_ID,
      refresh: "refresh-token|project-1",
      access: "access-token",
      expires: 12345,
      metadata: { email: "user@example.com", projectId: "project-1" },
    })
  })

  it("rejects failed exchanges without persisting", async () => {
    mocks.authorize.mockResolvedValue({
      url: "https://accounts.google.test/auth?state=fallback-state",
      verifier: "verifier",
      projectId: "",
    })
    mocks.exchange.mockResolvedValue({ type: "failed", error: "exchange failed" })
    const { registration } = await captureRegistration()
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")
    const authorization = await registration.authorize({})
    if (authorization.mode !== "code") throw new Error("Expected code authorization")

    await expect(authorization.callback("code-1")).rejects.toThrow("exchange failed")
    expect(mocks.persist).not.toHaveBeenCalled()
  })

  it("leaves token refresh with the transport account pool without discovery re-entry", async () => {
    const onCredentialChanged = vi.fn(async () => {})
    const { registration } = await captureRegistration(onCredentialChanged)
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")
    expect(registration.refresh).toBeUndefined()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(onCredentialChanged).not.toHaveBeenCalled()
  })

  it("completes OAuth automatically through the localhost listener", async () => {
    mocks.manualCallback.mockReturnValue(false)
    mocks.authorize.mockResolvedValue({
      url: "https://accounts.google.test/auth?state=fallback-state",
      verifier: "verifier",
      projectId: "",
    })
    mocks.exchange.mockResolvedValue({
      type: "success",
      refresh: "refresh-token|project-1",
      access: "access-token",
      expires: 12345,
      email: "user@example.com",
      projectId: "project-1",
    })
    const close = vi.fn(async () => {})
    const waitForCallback = vi.fn(async () => new URL(
      "http://localhost:51121/oauth-callback?code=code-1&state=fallback-state",
    ))
    mocks.startListener.mockResolvedValue({
      callbackUrl: new URL("http://localhost:51121/oauth-callback"),
      close,
      waitForCallback,
    })
    const { cleanup, registration } = await captureRegistration()
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")

    const authorization = await registration.authorize({})

    expect(authorization.mode).toBe("auto")
    if (authorization.mode !== "auto") throw new Error("Expected automatic authorization")
    expect(mocks.startListener).toHaveBeenCalledWith(expect.objectContaining({
      bindAddress: "127.0.0.1",
      expectedState: "fallback-state",
    }))
    await expect(authorization.callback).resolves.toMatchObject({
      type: "oauth",
      methodID: ANTIGRAVITY_METHOD_ID,
      access: "access-token",
    })
    expect(mocks.exchange).toHaveBeenCalledWith("code-1", "fallback-state")
    expect(close).toHaveBeenCalledOnce()
    await cleanup()
  })

  it("falls back to code mode when the localhost listener cannot start", async () => {
    mocks.manualCallback.mockReturnValue(false)
    mocks.authorize.mockResolvedValue({
      url: "https://accounts.google.test/auth?state=fallback-state",
      verifier: "verifier",
      projectId: "",
    })
    mocks.startListener.mockRejectedValue(new Error("Port 51121 is already in use"))
    const { registration } = await captureRegistration()
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")

    const authorization = await registration.authorize({})

    expect(authorization.mode).toBe("code")
    expect(authorization.instructions).toContain("Automatic localhost callback is unavailable")
  })

  it("shares one pending automatic login across concurrent authorize calls", async () => {
    mocks.manualCallback.mockReturnValue(false)
    mocks.authorize.mockResolvedValue({
      url: "https://accounts.google.test/auth?state=fallback-state",
      verifier: "verifier",
      projectId: "",
    })
    const callback = deferred<URL>()
    const close = vi.fn(async () => {
      callback.reject(new Error("listener closed"))
    })
    mocks.startListener.mockResolvedValue({
      callbackUrl: new URL("http://localhost:51121/oauth-callback"),
      close,
      waitForCallback: () => callback.promise,
    })
    const { cleanup, registration } = await captureRegistration()
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")

    const [first, second] = await Promise.all([
      registration.authorize({}),
      registration.authorize({}),
    ])

    expect(first.mode).toBe("auto")
    expect(second.mode).toBe("auto")
    expect(first.url).toBe(second.url)
    expect(mocks.authorize).toHaveBeenCalledOnce()
    expect(mocks.startListener).toHaveBeenCalledOnce()
    await cleanup()
    expect(close).toHaveBeenCalledOnce()
  })

  it("closes a pending listener and disposes the registration on cleanup", async () => {
    mocks.manualCallback.mockReturnValue(false)
    mocks.authorize.mockResolvedValue({
      url: "https://accounts.google.test/auth?state=fallback-state",
      verifier: "verifier",
      projectId: "",
    })
    const callback = deferred<URL>()
    const close = vi.fn(async () => {
      callback.reject(new Error("listener closed"))
    })
    mocks.startListener.mockResolvedValue({
      callbackUrl: new URL("http://localhost:51121/oauth-callback"),
      close,
      waitForCallback: () => callback.promise,
    })
    const { cleanup, dispose, registration } = await captureRegistration()
    if (!("authorize" in registration)) throw new Error("Expected OAuth registration")
    await registration.authorize({})

    await cleanup()

    expect(close).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
