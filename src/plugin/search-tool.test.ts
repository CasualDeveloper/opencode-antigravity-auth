import type { Plugin } from "@opencode/plugin"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./auth", async (original) => ({
  ...await original<typeof import("./auth")>(),
  resolveOAuthAuth: async () => ({
    type: "oauth", refresh: "test-refresh|project", access: "test-token", expires: Number.MAX_SAFE_INTEGER,
  }),
}))
vi.mock("./accounts", () => ({ AccountManager: { loadFromDisk: async () => ({
  getAccounts: () => [], getCurrentOrNextForFamily: () => null,
}) } }))
vi.mock("./project", () => ({ ensureProjectContext: async (auth: object) => ({ auth, effectiveProjectId: "project" }) }))

import { registerGoogleSearch } from "./search"

interface RegisteredTool {
  name: string
  description: string
  options: { codemode?: boolean }
  execute(input: unknown, context: { signal: AbortSignal }): Promise<{ output: string }>
}
async function tool(enabled = true) {
  let registered: RegisteredTool | undefined
  const context = {
    integration: {},
    tool: { transform: async (callback: (editor: object) => void) => {
      callback({ add: (tool: RegisteredTool) => { registered = tool } })
    } },
  }
  await registerGoogleSearch(context as unknown as Pick<Plugin.Context, "integration" | "tool">, enabled)
  return registered
}

afterEach(() => vi.restoreAllMocks())

describe("native grounded-search tool", () => {
  it("is enabled by default and prefers targeted tools", async () => {
    const registered = await tool()
    expect(registered?.name).toBe("google_search")
    expect(registered?.options).toEqual({ codemode: false })
    expect(registered?.description).toContain("Do not use for a known URL")
    expect(registered?.description).toContain("GitHub repositories, issues, pull requests, commits, or releases")
    expect(registered?.description).toContain("Prefer first-party targeted tools")
  })

  it("does not register when disabled", async () => {
    expect(await tool(false)).toBeUndefined()
  })

  it("executes through the existing grounded executor and propagates cancellation", async () => {
    const controller = new AbortController()
    let signal: AbortSignal | undefined
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      signal = init?.signal ?? undefined
      return new Response(JSON.stringify({ response: {
        candidates: [{ content: { parts: [{ text: "Grounded answer" }] } }],
      } }))
    })
    const registered = await tool()
    if (!registered) throw new Error("Missing search tool")
    const result = await registered.execute({ query: "Current information" }, { signal: controller.signal })
    expect(result.output).toContain("Grounded answer")
    expect(fetch).toHaveBeenCalledOnce()
    controller.abort()
    expect(signal?.aborted).toBe(true)
  })
})
