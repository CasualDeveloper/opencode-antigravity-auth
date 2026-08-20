import type { Plugin } from "@opencode-ai/plugin"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  loadConfig: vi.fn(),
  resolveAuth: vi.fn(),
  toV2Model: vi.fn(),
}))

vi.mock("../plugin", () => ({ discoverAntigravityModels: mocks.discover }))
vi.mock("../plugin/config", () => ({ loadConfig: mocks.loadConfig }))
vi.mock("./auth", () => ({ resolveAuth: mocks.resolveAuth }))
vi.mock("./catalog", () => ({ toV2Model: mocks.toV2Model }))

import { registerDynamicCatalog } from "./discovery"

describe("v2 dynamic catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadConfig.mockReturnValue({ model_discovery: { enabled: true, antigravity: true } })
    mocks.resolveAuth.mockResolvedValue({ type: "none" })
  })

  it("reloads the catalog after successful discovery", async () => {
    let transform: ((draft: {
      model: { update: (providerID: string, modelID: string, update: (model: object) => void) => void }
    }) => void) | undefined
    const reload = vi.fn(async () => {})
    const context = {
      integration: {},
      catalog: {
        transform: vi.fn(async (callback) => {
          transform = callback
        }),
        reload,
      },
    }
    mocks.discover.mockResolvedValue({
      "antigravity-gemini-new": {
        name: "Gemini New (Antigravity)",
        limit: { context: 1000, output: 100 },
        modalities: { input: ["text"], output: ["text"] },
      },
    })
    mocks.toV2Model.mockReturnValue({ id: "antigravity-gemini-new" })

    const refresh = await registerDynamicCatalog(
      context as unknown as Pick<Plugin.Context, "catalog" | "integration">,
    )
    await refresh()
    expect(reload).toHaveBeenCalledOnce()

    const update = vi.fn((_providerID, _modelID, mutate) => mutate({}))
    if (!transform) throw new Error("Catalog transform was not registered")
    transform({ model: { update } })
    expect(update).toHaveBeenCalledWith(
      "google",
      "antigravity-gemini-new",
      expect.any(Function),
    )
  })

  it("preserves the current catalog when discovery has no result", async () => {
    const reload = vi.fn(async () => {})
    const context = {
      integration: {},
      catalog: {
        transform: vi.fn(async () => {}),
        reload,
      },
    }
    mocks.discover.mockResolvedValue({})
    const refresh = await registerDynamicCatalog(
      context as unknown as Pick<Plugin.Context, "catalog" | "integration">,
    )

    await refresh()

    expect(reload).not.toHaveBeenCalled()
  })

  it("preserves the current catalog when discovery fails", async () => {
    const reload = vi.fn(async () => {})
    const context = {
      integration: {},
      catalog: {
        transform: vi.fn(async () => {}),
        reload,
      },
    }
    mocks.discover.mockRejectedValue(new Error("registry unavailable"))
    const refresh = await registerDynamicCatalog(
      context as unknown as Pick<Plugin.Context, "catalog" | "integration">,
    )

    await expect(refresh()).resolves.toBeUndefined()
    expect(reload).not.toHaveBeenCalled()
  })
})
