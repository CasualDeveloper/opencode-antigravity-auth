import type { Plugin } from "@opencode-ai/plugin"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resolveOAuth: vi.fn(),
  loadManager: vi.fn(),
  ensureProject: vi.fn(),
  executeSearch: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("./auth", () => ({ resolveOAuthAuth: mocks.resolveOAuth }))
vi.mock("../plugin/accounts", () => ({
  AccountManager: { loadFromDisk: mocks.loadManager },
}))
vi.mock("../plugin/project", () => ({ ensureProjectContext: mocks.ensureProject }))
vi.mock("../plugin/search", () => ({ executeSearch: mocks.executeSearch }))
vi.mock("../plugin/token", () => ({ refreshAccessToken: mocks.refresh }))

import { registerGoogleSearch } from "./search-tool"

interface RegisteredTool {
  name: string
  description: string
  options?: { codemode?: boolean }
  execute: (input: { query: string; urls?: string[]; thinking?: boolean }) => Promise<{ output?: string }>
}

async function captureTool(): Promise<RegisteredTool> {
  let registered: RegisteredTool | undefined
  const context = {
    integration: {},
    tool: {
      transform: vi.fn(async (transform) => {
        transform({
          add: (tool: RegisteredTool) => {
            registered = tool
          },
        })
      }),
    },
  }
  await registerGoogleSearch(context as unknown as Pick<Plugin.Context, "integration" | "tool">)
  if (!registered) throw new Error("Search tool was not registered")
  return registered
}

describe("v2 Google Search tool", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("registers as a direct provider tool", async () => {
    const tool = await captureTool()
    expect(tool.name).toBe("google_search")
    expect(tool.options).toEqual({ codemode: false })
  })

  it("directs the model to prefer targeted tools", async () => {
    const tool = await captureTool()

    expect(tool.description).toContain("Do not use for a known URL")
    expect(tool.description).toContain("GitHub repositories, issues, pull requests, commits, or releases")
    expect(tool.description).toContain("Prefer first-party targeted tools")
  })

  it("does not register when Google Search is disabled", async () => {
    const add = vi.fn()
    const context = {
      integration: {},
      tool: {
        transform: vi.fn(async (transform) => transform({ add })),
      },
    }

    await registerGoogleSearch(
      context as unknown as Pick<Plugin.Context, "integration" | "tool">,
      false,
    )

    expect(add).not.toHaveBeenCalled()
  })

  it("returns a safe authentication error", async () => {
    mocks.resolveOAuth.mockResolvedValue(undefined)
    const tool = await captureTool()

    await expect(tool.execute({ query: "latest news" })).resolves.toEqual({
      output: "Error: Google Antigravity is not authenticated. Connect the integration first.",
      content: "Error: Google Antigravity is not authenticated. Connect the integration first.",
    })
    expect(mocks.executeSearch).not.toHaveBeenCalled()
  })

  it("resolves project context and delegates to the existing search executor", async () => {
    const auth = {
      type: "oauth",
      refresh: "refresh-token|project-1",
      access: "access-token",
      expires: Date.now() + 3_600_000,
    }
    mocks.resolveOAuth.mockResolvedValue(auth)
    mocks.loadManager.mockResolvedValue({
      getAccounts: () => [],
      getCurrentOrNextForFamily: () => null,
    })
    mocks.ensureProject.mockResolvedValue({
      auth,
      effectiveProjectId: "managed-project-1",
    })
    mocks.executeSearch.mockResolvedValue("## Search Results\n\nAnswer")
    const tool = await captureTool()

    const result = await tool.execute({
      query: "current release",
      urls: ["https://example.com/release"],
      thinking: false,
    })

    expect(mocks.executeSearch).toHaveBeenCalledWith(
      {
        query: "current release",
        urls: ["https://example.com/release"],
        thinking: false,
      },
      "access-token",
      "managed-project-1",
    )
    expect(result).toEqual({
      output: "## Search Results\n\nAnswer",
      content: "## Search Results\n\nAnswer",
    })
  })
})
