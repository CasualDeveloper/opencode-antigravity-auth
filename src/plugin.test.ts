import { Model, Provider } from "@opencode/plugin"
import type { Plugin } from "@opencode/plugin"
import type { ModelEditor } from "@opencode/plugin/promise/model"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fetchModels: vi.fn(), configDirectory: vi.fn(), sessionCreated: vi.fn() }))
vi.mock("./plugin/quota", () => ({ fetchAvailableModels: mocks.fetchModels }))
vi.mock("./plugin/storage", async (original) => ({
  ...await original<typeof import("./plugin/storage")>(), loadAccounts: async () => null,
}))
vi.mock("./plugin/config", async (original) => {
  const config = await original<typeof import("./plugin/config")>()
  return { ...config, loadConfig: (directory: string) => {
    mocks.configDirectory(directory)
    return { ...config.DEFAULT_CONFIG, auto_update: false }
  } }
})
vi.mock("./hooks/auto-update-checker", () => ({
  createAutoUpdateChecker: () => ({ onSessionCreated: mocks.sessionCreated }),
}))

import { antigravityAuthPlugin } from "./plugin"
import { resetModelCatalogsForTests } from "./plugin/model-catalog"

function createContext(events: Array<{ type: string; data: Record<string, unknown> }> = []) {
  const transforms: Array<(editor: ModelEditor) => void> = []
  const hooks = new Map<string, (event: unknown) => void>()
  const methods: unknown[] = []
  const dispose = vi.fn(async () => {})
  const context = {
    location: { directory: "/test-project" },
    provider: { transform: async () => {}, reload: async () => {} },
    integration: {
      connection: {
        active: async () => ({ type: "credential", id: "test-credential" }),
        resolve: async () => ({
          type: "oauth", methodID: "antigravity", refresh: "test-refresh|test-project",
          access: "test-token", expires: Number.MAX_SAFE_INTEGER,
        }),
      },
      transform: async (callback: (editor: object) => void) => {
        callback({ method: { update: (method: unknown) => methods.push(method) } })
        return { dispose }
      },
    },
    model: {
      transform: async (callback: (editor: ModelEditor) => void) => { transforms.push(callback) },
      reload: vi.fn(async () => {}),
    },
    aisdk: { hook: async (name: string, callback: (event: unknown) => void) => {
      hooks.set(name, callback)
      return { dispose }
    } },
    session: { hook: async (name: string, callback: (event: unknown) => void) => {
      hooks.set(name, callback)
      return { dispose }
    } },
    tool: { transform: async () => ({ dispose }) },
    event: { subscribe: async function* () { yield* events } },
  }
  const models = () => {
    const entries = new Map<string, Model.Info>([
      ["antigravity-retired", Model.Info.default(Provider.ID.google, Model.ID.make("antigravity-retired"))],
      ["gemini-public", Model.Info.default(Provider.ID.google, Model.ID.make("gemini-public"))],
    ])
    const editor = {
      list: () => [...entries.values()],
      remove: (_provider: string, id: string) => { entries.delete(id) },
      update: (_provider: string, id: string, mutate: (model: object) => void) => {
        const model = Model.Info.default(Provider.ID.google, Model.ID.make(id))
        mutate(model)
        entries.set(id, model)
      },
    }
    for (const transform of transforms) transform(editor as unknown as ModelEditor)
    return [...entries.keys()].sort()
  }
  return { context: context as unknown as Plugin.Context, models, hooks, methods, dispose }
}

describe("Antigravity native plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetModelCatalogsForTests()
    mocks.fetchModels.mockResolvedValue({ models: {
      "claude-opus-5-5-low": { displayName: "Claude Opus 5.5 (Low)" },
      "claude-opus-5-5-high": { displayName: "Claude Opus 5.5 (High)" },
    } })
  })

  it("uses the native identity, location, and owning modules without a V1 adapter", async () => {
    const { context, models, hooks, methods, dispose } = createContext()
    const cleanup = await antigravityAuthPlugin.setup(context)
    expect(antigravityAuthPlugin.id).toBe("opencode.provider.antigravity")
    expect(models()).toEqual(["antigravity-claude-opus-5-5", "gemini-public"])
    expect(mocks.configDirectory).toHaveBeenCalledWith("/test-project")
    expect([...hooks.keys()]).toEqual(["sdk", "language", "context"])
    expect(methods).toHaveLength(1)
    if (typeof cleanup !== "function") throw new Error("Missing plugin cleanup")
    await cleanup()
    expect(dispose).toHaveBeenCalled()
  })

  it("refreshes on credential changes and preserves session update handling", async () => {
    const { context } = createContext([
      { type: "credential.updated", data: {} },
      { type: "credential.switched", data: { integrationID: "anthropic" } },
      { type: "credential.switched", data: { integrationID: "google" } },
      { type: "session.created", data: { sessionID: "session-1" } },
    ])
    const cleanup = await antigravityAuthPlugin.setup(context)
    await vi.waitFor(() => expect(mocks.fetchModels).toHaveBeenCalledTimes(3))
    expect(mocks.sessionCreated).toHaveBeenCalledWith({ sessionID: "session-1" })
    if (typeof cleanup === "function") await cleanup()
  })
})
