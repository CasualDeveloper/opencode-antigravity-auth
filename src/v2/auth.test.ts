import type { Plugin } from "@opencode-ai/plugin"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  diskAuth: vi.fn(),
}))

vi.mock("../plugin/oauth-auth-from-disk", () => ({
  oauthAuthFromDisk: mocks.diskAuth,
}))

import { resolveAuth } from "./auth"

function createContext(credential: unknown): Pick<Plugin.Context, "integration"> {
  return {
    integration: {
      connection: {
        active: vi.fn(async () => ({ id: "connection-1" })),
        resolve: vi.fn(async () => credential),
      },
    },
  } as unknown as Pick<Plugin.Context, "integration">
}

describe("v2 credential resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.diskAuth.mockResolvedValue(undefined)
  })

  it("accepts only the Antigravity Google OAuth method", async () => {
    const auth = await resolveAuth(createContext({
      type: "oauth",
      methodID: "antigravity",
      refresh: "refresh-token|project-1",
      access: "access-token",
      expires: 12345,
    }))

    expect(auth).toEqual({
      type: "oauth",
      refresh: "refresh-token|project-1",
      access: "access-token",
      expires: 12345,
    })
    expect(mocks.diskAuth).not.toHaveBeenCalled()
  })

  it("falls back to the Antigravity pool for other Google OAuth methods", async () => {
    const diskAuth = {
      type: "oauth",
      refresh: "pool-token|project-1",
      access: "",
      expires: 0,
    }
    mocks.diskAuth.mockResolvedValue(diskAuth)

    await expect(resolveAuth(createContext({
      type: "oauth",
      methodID: "another-google-method",
      refresh: "wrong-token",
      access: "wrong-access",
      expires: 99999,
    }))).resolves.toEqual(diskAuth)
  })
})
