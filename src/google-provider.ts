import type { Plugin } from "@opencode/plugin"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

import { createAntigravityRequestPipeline } from "./plugin/transport"
import { debugLogToFile } from "./plugin/debug"
import { resolveAuth } from "./plugin/auth"
import { ANTIGRAVITY_PROVIDER_PACKAGE } from "./plugin/model-catalog"

const PROVIDER_ID = "google"
const PROVIDER_PACKAGE = ANTIGRAVITY_PROVIDER_PACKAGE.slice("aisdk:".length)

interface FetchPipeline {
  fetch: typeof fetch
  dispose: () => void
}

export function toGoogleSDKModelID(modelID: string): string {
  return modelID.replace(/^antigravity-/i, "")
}

const MODEL_FACTORY_METHODS = new Set<PropertyKey>([
  "languageModel",
  "chat",
  "generativeAI",
  "image",
  "imageModel",
  "embedding",
  "embeddingModel",
  "textEmbedding",
  "textEmbeddingModel",
  "video",
  "videoModel",
])

function createAntigravityGoogleSDK(options: Record<string, unknown>) {
  const sdk = createGoogleGenerativeAI(options)
  return new Proxy(sdk, {
    apply(target, thisArg, argumentsList) {
      const [modelID, ...rest] = argumentsList
      return Reflect.apply(target, thisArg, [
        typeof modelID === "string" ? toGoogleSDKModelID(modelID) : modelID,
        ...rest,
      ])
    },
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (!MODEL_FACTORY_METHODS.has(property) || typeof value !== "function") return value
      return (modelID: string, ...rest: unknown[]) => Reflect.apply(value, target, [
        toGoogleSDKModelID(modelID),
        ...rest,
      ])
    },
  })
}

function rewriteModelURL(
  value: string,
  sdkModelID: string,
  catalogModelID: string,
): string {
  const marker = `/models/${sdkModelID}:`
  return value.includes(marker)
    ? value.replace(marker, `/models/${catalogModelID}:`)
    : value
}

function routeModelThroughAntigravity(
  fetchImpl: typeof fetch,
  sdkModelID: string,
  catalogModelID: string,
): typeof fetch {
  return async (input, init) => {
    if (input instanceof Request) {
      const url = rewriteModelURL(input.url, sdkModelID, catalogModelID)
      return fetchImpl(url === input.url ? input : new Request(url, input), init)
    }
    if (input instanceof URL) {
      const url = rewriteModelURL(input.toString(), sdkModelID, catalogModelID)
      return fetchImpl(new URL(url), init)
    }
    return fetchImpl(rewriteModelURL(input, sdkModelID, catalogModelID), init)
  }
}

function unavailableFetch(): typeof fetch {
  return async () => {
    throw new Error(
      "Google Antigravity is not authenticated. Connect the Google Antigravity integration first.",
    )
  }
}

async function createFetchPipeline(
  context: Pick<Plugin.Context, "integration" | "location">,
): Promise<FetchPipeline | undefined> {
  const pipeline = await createAntigravityRequestPipeline({
    directory: context.location.directory,
    getAuth: () => resolveAuth(context),
  })
  if (!pipeline) return undefined
  return {
    fetch: pipeline.fetch as typeof fetch,
    dispose: () => pipeline.dispose?.(),
  }
}

export function isAntigravitySDKEvent(event: {
  readonly model: { readonly providerID: string; readonly id: string }
  readonly package: string
}): boolean {
  return event.model.providerID === PROVIDER_ID
    && event.package === PROVIDER_PACKAGE
    && event.model.id.startsWith("antigravity-")
}

function isAntigravityModel(model: {
  readonly providerID: string
  readonly id: string
  readonly package?: string
}): boolean {
  return model.providerID === PROVIDER_ID
    && model.package === ANTIGRAVITY_PROVIDER_PACKAGE
    && model.id.startsWith("antigravity-")
}

function backendModelID(model: {
  readonly id: string
  readonly modelID?: string
  readonly settings?: Readonly<Record<string, unknown>>
}): string {
  const selected = model.settings?.antigravityModelID
  return typeof selected === "string" && selected
    ? `antigravity-${selected}`
    : model.modelID ?? model.id
}

export async function registerFetchInterceptor(
  context: Pick<Plugin.Context, "aisdk" | "integration" | "location">,
): Promise<() => Promise<void>> {
  let pipelinePromise: Promise<FetchPipeline | undefined> | undefined
  let credentialKey: string | undefined
  let disposed = false

  const interceptedFetch = async (): Promise<typeof fetch> => {
    if (disposed) throw new Error("Antigravity plugin is unloaded")
    const auth = await resolveAuth(context)
    const key = JSON.stringify([auth.type, "refresh" in auth ? auth.refresh : "key" in auth ? auth.key : undefined])
    if (!pipelinePromise || key !== credentialKey) {
      const previous = pipelinePromise
      credentialKey = key
      const pending = createFetchPipeline(context).then((pipeline) => {
        if (disposed) pipeline?.dispose()
        return pipeline
      }).catch((error: unknown) => {
        if (pipelinePromise === pending) pipelinePromise = undefined
        throw error
      })
      pipelinePromise = pending
      void previous?.then((pipeline) => pipeline?.dispose()).catch((error: unknown) => {
        debugLogToFile(`[Transport] Previous pipeline cleanup failed: ${String(error)}`)
      })
    }
    const pending = pipelinePromise
    const pipeline = await pending
    if (!pipeline && pipelinePromise === pending) pipelinePromise = undefined
    return pipeline?.fetch ?? unavailableFetch()
  }

  // Cached SDKs survive host credential switches. Resolve the current pipeline
  // at the actual fetch boundary, not only when a language model is created.
  const fetchCurrent: typeof fetch = async (input, init) => (await interceptedFetch())(input, init)

  const registrations = await Promise.all([
    context.aisdk.hook("sdk", async (event) => {
      debugLogToFile(
        `[V2 SDK] provider=${event.model.providerID} model=${event.model.id} package=${event.package}`,
      )
      if (!isAntigravitySDKEvent(event)) return
      const catalogModelID = backendModelID(event.model)
      const sdkModelID = toGoogleSDKModelID(catalogModelID)
      await interceptedFetch()
      event.options.apiKey ||= "antigravity-oauth"
      event.options.fetch = routeModelThroughAntigravity(
        fetchCurrent,
        sdkModelID,
        catalogModelID,
      )
      event.sdk = createAntigravityGoogleSDK(event.options)
    }),
    context.aisdk.hook("language", async (event) => {
      if (!isAntigravityModel(event.model)) return
      const catalogModelID = backendModelID(event.model)
      const sdkModelID = toGoogleSDKModelID(catalogModelID)
      await interceptedFetch()
      event.options.apiKey ||= "antigravity-oauth"
      event.options.fetch = routeModelThroughAntigravity(
        fetchCurrent,
        sdkModelID,
        catalogModelID,
      )
      const sdk = createAntigravityGoogleSDK(event.options)
      // The Google SDK gates Gemini 3 multimodal function responses by model
      // name. Keep the catalog prefix out of that capability check, then add it
      // back at the fetch boundary so the shared router retains explicit
      // Antigravity quota semantics.
      event.language = sdk.languageModel(catalogModelID)
    }),
  ])
  return async () => {
    disposed = true
    const pipeline = await pipelinePromise?.catch(() => undefined)
    pipeline?.dispose()
    await Promise.all(registrations.map((registration) => registration.dispose()))
  }
}

export { createGoogleGenerativeAI } from "@ai-sdk/google"
