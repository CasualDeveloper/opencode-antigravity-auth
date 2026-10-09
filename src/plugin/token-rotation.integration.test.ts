import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import type { Plugin } from "@opencode/plugin"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resolveAuth } from "./auth"
import { clearCachedAuth } from "./cache"
import { DEFAULT_CONFIG } from "./config"
import { discoverAntigravityModels, resetModelCatalogsForTests } from "./model-catalog"
import { reconcileOAuthAuth } from "./oauth-auth-from-disk"
import { loadAccounts, removeAccountFromStorage, replaceAccountRefreshToken, saveAccounts } from "./storage"
import { refreshAccessToken } from "./token"

let directory: string
let originalConfigDirectory: string | undefined
const hostAuth = {
  type: "oauth" as const,
  refresh: "original-token|selected-project",
  access: "expired-access",
  expires: 0,
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const context = {
  integration: { connection: {
    active: async () => ({ type: "credential", id: "selected" }),
    resolve: async () => ({ ...hostAuth, methodID: "antigravity" }),
  } },
} as unknown as Pick<Plugin.Context, "integration">

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "antigravity-rotation-"))
  originalConfigDirectory = process.env.OPENCODE_CONFIG_DIR
  process.env.OPENCODE_CONFIG_DIR = directory
  clearCachedAuth()
  resetModelCatalogsForTests()
  await saveAccounts({
    version: 4,
    activeIndex: 0,
    accounts: [
      { refreshToken: "unrelated-token", projectId: "other-project", addedAt: 1, lastUsed: 1 },
      { refreshToken: "original-token", projectId: "selected-project", addedAt: 1, lastUsed: 1 },
    ],
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  clearCachedAuth()
  resetModelCatalogsForTests()
  if (originalConfigDirectory === undefined) delete process.env.OPENCODE_CONFIG_DIR
  else process.env.OPENCODE_CONFIG_DIR = originalConfigDirectory
  await rm(directory, { recursive: true, force: true })
})

describe("persisted refresh-token rotation", () => {
  it("resolves a stale host credential and discovers models after a cold reload without email", async () => {
    const refreshTokens: Array<string | null> = []
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).includes("oauth2.googleapis.com/token")) {
        const token = new URLSearchParams(String(init?.body)).get("refresh_token")
        refreshTokens.push(token)
        if (refreshTokens.length > 1 && token !== "rotated-token") {
          return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
        }
        return new Response(JSON.stringify({
          access_token: "fresh-access", expires_in: 3600, refresh_token: "rotated-token",
        }))
      }
      expect(String(input)).toContain("fetchAvailableModels")
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fresh-access")
      return new Response(JSON.stringify({ models: { "gemini-discovered": {} } }))
    })

    await refreshAccessToken(hostAuth)
    const persisted = await loadAccounts()
    expect(persisted?.accounts.map((account) => account.refreshToken))
      .toEqual(["unrelated-token", "rotated-token"])
    expect(persisted?.accounts[1]?.previousRefreshTokenHashes).toEqual([hash("original-token")])

    clearCachedAuth()
    resetModelCatalogsForTests()
    expect(await resolveAuth(context)).toMatchObject({ refresh: "rotated-token|selected-project", access: "" })
    // Also exercise direct discovery callers with the host's old snapshot.
    expect(await discoverAntigravityModels(DEFAULT_CONFIG, hostAuth)).toHaveProperty("antigravity-gemini-discovered")
    expect(refreshTokens).toEqual(["original-token", "rotated-token"])
    expect(await resolveAuth(context)).toMatchObject({ refresh: "rotated-token|selected-project", access: "fresh-access" })
  })

  it("retains the predecessor chain across multiple rotations and stale saves", async () => {
    await replaceAccountRefreshToken("original-token", "intermediate-token")
    await replaceAccountRefreshToken("intermediate-token", "final-token")
    const persisted = await loadAccounts()
    if (!persisted) throw new Error("Missing pool")
    // A manager's older snapshot has no rotation history; it cannot erase it.
    await saveAccounts({ ...persisted, accounts: persisted.accounts.map((account) => ({
      ...account, previousRefreshTokenHashes: [],
    })) })
    expect(await reconcileOAuthAuth(hostAuth)).toMatchObject({ refresh: "final-token|selected-project" })
    expect(await reconcileOAuthAuth({ ...hostAuth, refresh: "intermediate-token|selected-project" }))
      .toMatchObject({ refresh: "final-token|selected-project" })
  })

  it("does not substitute an unrelated account after the selected account is removed", async () => {
    await replaceAccountRefreshToken("original-token", "rotated-token")
    await removeAccountFromStorage("rotated-token")
    expect(await resolveAuth(context)).toEqual(hostAuth)
  })

  it("preserves disabled state so account-pool selection still controls rotation", async () => {
    await replaceAccountRefreshToken("original-token", "rotated-token")
    const persisted = await loadAccounts()
    if (!persisted) throw new Error("Missing pool")
    await saveAccounts({ ...persisted, accounts: persisted.accounts.map((account) => ({
      ...account, enabled: account.refreshToken !== "rotated-token",
    })) })
    expect(await resolveAuth(context)).toMatchObject({ refresh: "rotated-token|selected-project" })
    expect((await loadAccounts())?.accounts.find((account) => account.refreshToken === "rotated-token")?.enabled).toBe(false)
  })
})
