import type { Plugin } from "@opencode/plugin"
import type { ModelEditor } from "@opencode/plugin/promise/model"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fetchModels: vi.fn() }))
vi.mock("./quota", () => ({ fetchAvailableModels: mocks.fetchModels }))
vi.mock("./storage", async (original) => ({
  ...await original<typeof import("./storage")>(), loadAccounts: async () => null,
}))
vi.mock("./auth", async (original) => ({
  ...await original<typeof import("./auth")>(),
  resolveAuth: async () => ({
    type: "oauth", refresh: "test-refresh|project", access: "test-token", expires: Number.MAX_SAFE_INTEGER,
  }),
}))
vi.mock("./config", async (original) => {
  const module = await original<typeof import("./config")>()
  return { ...module, loadConfig: () => module.DEFAULT_CONFIG }
})

import { registerDynamicCatalog, resetModelCatalogsForTests } from "./model-catalog"

async function inventory() {
  let transform: ((editor: ModelEditor) => void) | undefined
  const reload = vi.fn(async () => {})
  const context = {
    location: { directory: "/test-project" },
    integration: {},
    provider: { transform: async () => {}, reload },
    model: {
      transform: async (callback: (editor: ModelEditor) => void) => { transform = callback },
      reload,
    },
  }
  const refresh = await registerDynamicCatalog(context as unknown as Pick<Plugin.Context, "provider" | "model" | "integration" | "location">)
  const render = () => {
    if (!transform) throw new Error("Missing model transform")
    const entries = new Map<string, object>([
      ["antigravity-retired", { id: "antigravity-retired" }],
      ["gemini-public", { id: "gemini-public" }],
    ])
    const editor = {
      list: () => [...entries.values()],
      remove: (_provider: string, id: string) => { entries.delete(id) },
      update: (_provider: string, id: string, mutate: (model: object) => void) => {
        const model = { id }
        mutate(model)
        entries.set(id, model)
      },
    }
    transform(editor as unknown as ModelEditor)
    return [...entries.keys()].sort()
  }
  return { refresh, render, reload }
}

describe("discovery-owned catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetModelCatalogsForTests()
  })

  it("never seeds static entries and replaces retired models on refresh", async () => {
    const catalog = await inventory()
    expect(catalog.render()).toEqual(["gemini-public"])
    mocks.fetchModels.mockResolvedValue({ models: { "gemini-new": {} } })
    await catalog.refresh()
    expect(catalog.render()).toEqual(["antigravity-gemini-new", "gemini-public"])
    mocks.fetchModels.mockResolvedValue({ models: { "gemini-newer": {} } })
    await catalog.refresh()
    expect(catalog.render()).toEqual(["antigravity-gemini-newer", "gemini-public"])
  })

  it("clears a successful empty inventory", async () => {
    const catalog = await inventory()
    mocks.fetchModels.mockResolvedValue({ models: { "gemini-new": {} } })
    await catalog.refresh()
    mocks.fetchModels.mockResolvedValue({ models: {} })
    await catalog.refresh()
    expect(catalog.render()).toEqual(["gemini-public"])
    expect(catalog.reload).toHaveBeenCalledTimes(2)
  })

  it("retains only discovered inventory when refresh fails", async () => {
    const catalog = await inventory()
    mocks.fetchModels.mockResolvedValue({ models: { "gemini-new": {} } })
    await catalog.refresh()
    mocks.fetchModels.mockRejectedValue(new Error("offline"))
    await catalog.refresh()
    expect(catalog.render()).toEqual(["antigravity-gemini-new", "gemini-public"])
  })

  it("keeps an empty catalog on an initial discovery failure", async () => {
    const catalog = await inventory()
    mocks.fetchModels.mockRejectedValue(new Error("offline"))
    await catalog.refresh()
    expect(catalog.render()).toEqual(["gemini-public"])
  })
})
