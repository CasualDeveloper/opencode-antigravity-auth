import type { LanguageModelV3 } from "@ai-sdk/provider"
import type { Plugin } from "@opencode-ai/plugin"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { OPENCODE_MODEL_DEFINITIONS } from "../plugin/config/models"

const mocks = vi.hoisted(() => ({
  createPipeline: vi.fn(),
}))

vi.mock("../plugin", () => ({
  createAntigravityRequestPipeline: mocks.createPipeline,
}))

import {
  isAntigravitySDKEvent,
  registerFetchInterceptor,
  toGoogleSDKModelID,
} from "./fetch"
import { ANTIGRAVITY_PROVIDER_PACKAGE } from "./catalog"

const PROVIDER_PACKAGE = ANTIGRAVITY_PROVIDER_PACKAGE.slice("aisdk:".length)

interface SDKEvent {
  readonly model: {
    readonly providerID: string
    readonly id: string
    readonly modelID?: string
    readonly package?: string
  }
  readonly package: string
  readonly options: Record<string, unknown>
  sdk?: unknown
  language?: unknown
}

function createContext() {
  const hooks = new Map<string, (event: SDKEvent) => Promise<void>>()
  const hookDisposers: Array<ReturnType<typeof vi.fn>> = []
  const context = {
    aisdk: {
      hook: vi.fn(async (_name: string, callback: (event: SDKEvent) => Promise<void>) => {
        hooks.set(_name, callback)
        const dispose = vi.fn(async () => {})
        hookDisposers.push(dispose)
        return { dispose }
      }),
    },
    integration: {
      connection: {
        active: vi.fn(async () => ({ id: "connection-1" })),
        resolve: vi.fn(async () => ({
          type: "oauth",
          methodID: "antigravity",
          refresh: "refresh-token|project-1",
          access: "access-token",
          expires: Date.now() + 60_000,
        })),
      },
    },
  }
  return {
    context: context as unknown as Pick<Plugin.Context, "aisdk" | "integration">,
    getHook: (name: "sdk" | "language" = "sdk") => {
      const hook = hooks.get(name)
      if (!hook) throw new Error("SDK hook was not registered")
      return hook
    },
    hookDisposers,
  }
}

describe("v2 fetch interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("only matches curated Antigravity Google SDK models", () => {
    expect(isAntigravitySDKEvent({
      model: { providerID: "google", id: "antigravity-gemini-3-pro" },
      package: PROVIDER_PACKAGE,
    })).toBe(true)
    expect(isAntigravitySDKEvent({
      model: { providerID: "google", id: "gemini-2.5-pro" },
      package: PROVIDER_PACKAGE,
    })).toBe(false)
    expect(isAntigravitySDKEvent({
      model: { providerID: "google", id: "antigravity-gemini-3-pro" },
      package: "@ai-sdk/google",
    })).toBe(false)
  })

  it("installs the existing request pipeline for matching models", async () => {
    const interceptedFetch = vi.fn(async () => new Response("ok"))
    mocks.createPipeline.mockResolvedValue({ apiKey: "", fetch: interceptedFetch })
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)

    const event: SDKEvent = {
      model: { providerID: "google", id: "antigravity-gemini-3-pro" },
      package: PROVIDER_PACKAGE,
      options: {},
    }
    await getHook()(event)

    expect(mocks.createPipeline).toHaveBeenCalledOnce()
    expect(event.options.fetch).toEqual(expect.any(Function))
    expect(event.sdk).toBeDefined()
  })

  it("leaves ordinary Google models untouched", async () => {
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)
    const event: SDKEvent = {
      model: { providerID: "google", id: "gemini-2.5-pro" },
      package: PROVIDER_PACKAGE,
      options: {},
    }

    await getHook()(event)

    expect(event.options.fetch).toBeUndefined()
    expect(mocks.createPipeline).not.toHaveBeenCalled()
  })

  it("fails locally with guidance when no OAuth account is available", async () => {
    mocks.createPipeline.mockResolvedValue(undefined)
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)
    const event: SDKEvent = {
      model: { providerID: "google", id: "antigravity-gemini-3-pro" },
      package: PROVIDER_PACKAGE,
      options: {},
    }
    await getHook()(event)
    const installedFetch = event.options.fetch
    if (typeof installedFetch !== "function") throw new Error("Fetch interceptor was not installed")

    await expect(installedFetch("https://generativelanguage.googleapis.com"))
      .rejects.toThrow("Connect the Google Antigravity integration")
  })

  it("replaces warmed language models that bypass the SDK hook", async () => {
    const interceptedFetch = vi.fn(async () => new Response("ok"))
    mocks.createPipeline.mockResolvedValue({ apiKey: "", fetch: interceptedFetch })
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)
    const event: SDKEvent = {
      model: {
        providerID: "google",
        id: "antigravity-gemini-3-pro",
        modelID: "antigravity-gemini-3-pro",
        package: ANTIGRAVITY_PROVIDER_PACKAGE,
      },
      package: PROVIDER_PACKAGE,
      options: {},
    }

    await getHook("language")(event)

    expect(event.options.fetch).toEqual(expect.any(Function))
    expect(event.language).toBeDefined()
  })

  it("maps every Antigravity catalog model to its native SDK model ID", async () => {
    mocks.createPipeline.mockResolvedValue({
      apiKey: "",
      fetch: vi.fn(async () => new Response("ok")),
    })
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)

    for (const modelID of Object.keys(OPENCODE_MODEL_DEFINITIONS)) {
      if (!modelID.startsWith("antigravity-")) continue
      const event: SDKEvent = {
        model: {
          providerID: "google",
          id: modelID,
          modelID,
          package: ANTIGRAVITY_PROVIDER_PACKAGE,
        },
        package: PROVIDER_PACKAGE,
        options: {},
      }

      await getHook("language")(event)

      expect((event.language as LanguageModelV3 | undefined)?.modelId)
        .toBe(modelID.slice("antigravity-".length))
    }
  })

  it("normalizes any discovered Antigravity model instead of hard-coding model names", async () => {
    expect(toGoogleSDKModelID("antigravity-gemini-4-flash")).toBe("gemini-4-flash")
    expect(toGoogleSDKModelID("antigravity-claude-opus-5-thinking")).toBe("claude-opus-5-thinking")
    expect(toGoogleSDKModelID("gemini-3.1-pro")).toBe("gemini-3.1-pro")

    mocks.createPipeline.mockResolvedValue({
      fetch: vi.fn(async () => new Response("ok")),
    })
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)
    const event: SDKEvent = {
      model: {
        providerID: "google",
        id: "antigravity-gemini-4-flash",
        modelID: "antigravity-gemini-4-flash",
        package: ANTIGRAVITY_PROVIDER_PACKAGE,
      },
      package: PROVIDER_PACKAGE,
      options: {},
    }

    await getHook("sdk")(event)
    const sdk = event.sdk as { languageModel: (modelID: string) => LanguageModelV3 }
    expect(sdk.languageModel("antigravity-gemini-4-flash").modelId).toBe("gemini-4-flash")

    await getHook("language")(event)
    expect((event.language as LanguageModelV3 | undefined)?.modelId).toBe("gemini-4-flash")
  })

  it("uses Gemini 3 multimodal function responses while preserving Antigravity routing", async () => {
    let requestedUrl = ""
    let requestedBody: Record<string, unknown> | undefined
    const interceptedFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input)
      requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"continued"}]},"finishReason":"STOP","index":0}]}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      )
    })
    mocks.createPipeline.mockResolvedValue({ apiKey: "", fetch: interceptedFetch })
    const { context, getHook } = createContext()
    await registerFetchInterceptor(context)
    const event: SDKEvent = {
      model: {
        providerID: "google",
        id: "antigravity-gemini-3.1-pro",
        modelID: "antigravity-gemini-3.1-pro",
        package: ANTIGRAVITY_PROVIDER_PACKAGE,
      },
      package: PROVIDER_PACKAGE,
      options: { apiKey: "unused" },
    }
    await getHook("language")(event)

    const language = event.language as LanguageModelV3 | undefined
    if (!language) throw new Error("Language model was not installed")
    await language.doStream({
      prompt: [
        {
          role: "assistant",
          content: [{
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "read",
            input: { path: "image.jpg" },
          }],
        },
        {
          role: "tool",
          content: [{
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "read",
            output: {
              type: "content",
              value: [
                { type: "text", text: "Image attached" },
                { type: "image-data", data: "AA==", mediaType: "image/jpeg" },
              ],
            },
          }],
        },
      ],
    })

    expect(requestedUrl).toContain("/models/antigravity-gemini-3.1-pro:")
    const contents = requestedBody?.contents as Array<{
      parts: Array<{
        functionResponse?: { parts?: Array<{ inlineData?: unknown }> }
        inlineData?: unknown
      }>
    }>
    const toolResultParts = contents[1]?.parts ?? []
    expect(toolResultParts).toHaveLength(1)
    expect(toolResultParts[0]?.functionResponse?.parts).toEqual([
      { inlineData: { mimeType: "image/jpeg", data: "AA==" } },
    ])
    expect(toolResultParts.some((part) => part.inlineData !== undefined)).toBe(false)
  })

  it("stops the request pipeline and disposes hooks during cleanup", async () => {
    const disposePipeline = vi.fn()
    mocks.createPipeline.mockResolvedValue({
      apiKey: "",
      fetch: vi.fn(async () => new Response("ok")),
      dispose: disposePipeline,
    })
    const { context, getHook, hookDisposers } = createContext()
    const cleanup = await registerFetchInterceptor(context)
    await getHook()({
      model: { providerID: "google", id: "antigravity-gemini-3-pro" },
      package: PROVIDER_PACKAGE,
      options: {},
    })

    await cleanup()

    expect(disposePipeline).toHaveBeenCalledOnce()
    expect(hookDisposers).toHaveLength(2)
    expect(hookDisposers.every((dispose) => dispose.mock.calls.length === 1)).toBe(true)
  })
})
