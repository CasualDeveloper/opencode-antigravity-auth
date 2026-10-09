import { Integration, Model, Provider, type Plugin } from "@opencode/plugin"
import { loadConfig } from "./config"
import { accessTokenExpired, isOAuthAuth, parseRefreshParts, resolveAuth } from "./auth"
import { oauthAuthFromDisk, reconcileOAuthAuth } from "./oauth-auth-from-disk"
import { refreshAccessToken } from "./token"
import { fetchAvailableModels } from "./quota"
import { ANTIGRAVITY_DEFAULT_PROJECT_ID } from "../constants"
import { debugLogToFile } from "./debug"
import { createLogger } from "./logger"
import { modelsFromAntigravityAvailableModels, type ModelVariant, type OpencodeModelDefinition, type OpencodeModelDefinitions } from "./config/models"
import type { AntigravityConfig } from "./config"
import type { AuthDetails } from "./types"
/**
 * Live cache of the public Gemini API model catalog (`GET
 * generativelanguage.googleapis.com/v1beta/models`) and the Antigravity model
 * registry (`POST v1internal:fetchAvailableModels`), sourced from model discovery
 * and quota fetches.
 *
 * Routing decisions and dynamic model resolution use this live data to discover
 * new and updated models directly from Google's registries without requiring manual
 * plugin updates.
 */
import type { AntigravityAvailableModels, GeminiApiModel } from "./config/models";

const CATALOG_TTL_MS = 60 * 60 * 1000;

interface PublicModelCatalog {
  ids: ReadonlySet<string>;
  fetchedAt: number;
}

interface AntigravityModelCatalog {
  models: AntigravityAvailableModels;
  fetchedAt: number;
}

let catalog: PublicModelCatalog | undefined;
let antigravityCatalog: AntigravityModelCatalog | undefined;

function modelIdFromName(model: GeminiApiModel): string | null {
  const raw = (model.name ? model.name.replace(/^models\//, "") : model.baseModelId)?.trim();
  return raw || null;
}

/**
 * Records a freshly-fetched public Gemini API model list. Called as a side
 * effect of the existing model-discovery fetch — no extra network round trip.
 */
export function recordPublicGeminiApiModels(models: GeminiApiModel[]): void {
  const ids = new Set<string>();
  for (const model of models) {
    const id = modelIdFromName(model);
    if (id) ids.add(id.toLowerCase());
  }
  if (ids.size === 0) return;
  catalog = { ids, fetchedAt: Date.now() };
}

/**
 * Returns the live set of public Gemini API model ids, or `undefined` when no
 * catalog has been fetched yet (cold start) or the cached one is stale.
 * Callers should fall back to static heuristics in the `undefined` case.
 */
export function getPublicGeminiApiModelIds(): ReadonlySet<string> | undefined {
  if (!catalog) return undefined;
  if (Date.now() - catalog.fetchedAt > CATALOG_TTL_MS) return undefined;
  return catalog.ids;
}

/**
 * Records available models from the Antigravity model registry (`fetchAvailableModels`).
 * Called as a side effect of quota checks and model discovery.
 */
export function recordAntigravityAvailableModels(models: AntigravityAvailableModels): void {
  antigravityCatalog = {
    models: { ...models },
    fetchedAt: Date.now(),
  };
}

/**
 * Returns the cached Antigravity available models, or `undefined` when no catalog
 * has been fetched yet or the cached one is stale.
 */
export function getCachedAntigravityAvailableModels(): AntigravityAvailableModels | undefined {
  if (!antigravityCatalog) return undefined;
  if (Date.now() - antigravityCatalog.fetchedAt > CATALOG_TTL_MS) return undefined;
  return antigravityCatalog.models;
}

export function resetPublicGeminiApiModelCatalogForTests(): void {
  catalog = undefined;
}

export function resetAntigravityModelCatalogForTests(): void {
  antigravityCatalog = undefined;
}

export function resetModelCatalogsForTests(): void {
  catalog = undefined;
  antigravityCatalog = undefined;
}

const log = createLogger("model-catalog")
export async function discoverAntigravityModels(
  config: AntigravityConfig,
  auth: AuthDetails | undefined,
): Promise<OpencodeModelDefinitions | undefined> {
  if (!config.model_discovery.enabled || !config.model_discovery.antigravity) return {};

  let effectiveAuth = auth && isOAuthAuth(auth) ? auth : undefined;
  if (!effectiveAuth) {
    effectiveAuth = await oauthAuthFromDisk();
  }
  if (effectiveAuth) effectiveAuth = await reconcileOAuthAuth(effectiveAuth);

  if (!effectiveAuth) {
    const cached = getCachedAntigravityAvailableModels();
    if (cached) {
      return modelsFromAntigravityAvailableModels(cached);
    }
    return undefined;
  }

  let accessToken = effectiveAuth.access;
  if (!accessToken || accessTokenExpired(effectiveAuth)) {
    const refreshed = await refreshAccessToken(effectiveAuth);
    if (refreshed) {
      effectiveAuth = refreshed;
      accessToken = refreshed.access;
    }
  }
  if (!accessToken) {
    const cached = getCachedAntigravityAvailableModels();
    if (cached) {
      return modelsFromAntigravityAvailableModels(cached);
    }
    return undefined;
  }

  const parts = parseRefreshParts(effectiveAuth.refresh);
  const projectId = parts.managedProjectId || parts.projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID;
  try {
    const response = await fetchAvailableModels(accessToken, projectId);
    if (!response.models) throw new Error("Antigravity discovery returned no model inventory");
    recordAntigravityAvailableModels(response.models);
    return modelsFromAntigravityAvailableModels(response.models);
  } catch (error) {
    log.debug("fetchAvailableModels-failed", { error: String(error) });
    const cached = getCachedAntigravityAvailableModels();
    if (cached) {
      return modelsFromAntigravityAvailableModels(cached);
    }
    return undefined;
  }
}


export const ANTIGRAVITY_PROVIDER_PACKAGE = `aisdk:${new URL("../google-provider.js", import.meta.url).href}`

function variantSettings(variant: ModelVariant): Record<string, unknown> {
  if (variant.backendModelID) {
    return { antigravityModelID: variant.backendModelID }
  }
  if (variant.thinkingLevel) {
    return {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: variant.thinkingLevel,
      },
    }
  }
  if (variant.thinkingConfig) {
    return {
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: variant.thinkingConfig.thinkingBudget,
      },
    }
  }
  return {}
}

export function toCatalogModel(
  modelID: string,
  definition: OpencodeModelDefinition,
): Model.Info {
  return {
    ...Model.Info.default(Provider.ID.google, Model.ID.make(modelID)),
    modelID: Model.ID.make(definition.backendModelID ? `antigravity-${definition.backendModelID}` : modelID),
    name: definition.name,
    package: ANTIGRAVITY_PROVIDER_PACKAGE,
    capabilities: {
      tools: true,
      input: [...definition.modalities.input],
      output: [...definition.modalities.output],
    },
    variants: Object.entries(definition.variants ?? {}).map(([id, settings]) => ({
      id: Model.VariantID.make(id),
      settings: variantSettings(settings),
    })),
    time: { released: 0 },
    cost: [],
    status: "active",
    enabled: true,
    limit: { ...definition.limit },
  }
}

export async function registerDynamicCatalog(
  context: Pick<Plugin.Context, "provider" | "model" | "integration" | "location">,
): Promise<() => Promise<void>> {
  let discovered: OpencodeModelDefinitions = {}

  await context.provider.transform((editor) => {
    const models = Object.entries(discovered).map(([id, definition]) => toCatalogModel(id, definition))
    if (models.length === 0) return
    const existing = editor.get("google")
    if (!existing) {
      editor.add({
        info: {
          ...Provider.Info.empty(Provider.ID.google),
          name: "Google",
          integrationID: Integration.ID.make("google"),
          package: ANTIGRAVITY_PROVIDER_PACKAGE,
          activation: "enabled",
        },
        models,
      })
      return
    }
    // Discovered disk-backed accounts are usable without a host credential.
    // Keep unrelated Google source definitions and their original drivers.
    editor.update("google", (provider) => { provider.activation = "enabled" })
    editor.models.set("google", [
      ...[...existing.models.values()].filter((model) => !model.id.startsWith("antigravity-")),
      ...models,
    ])
  })

  await context.model.transform((model) => {
    for (const entry of model.list("google")) {
      const id = String(entry.id)
      if (id.startsWith("antigravity-") && !Object.hasOwn(discovered, id)) {
        model.remove("google", id)
      }
    }
    for (const [modelID, definition] of Object.entries(discovered)) {
      model.update("google", modelID, (draft) => {
        Object.assign(draft, toCatalogModel(modelID, definition))
      })
    }
  })

  return async () => {
    try {
      const config = loadConfig(context.location.directory)
      const auth = await resolveAuth(context)
      const next = await discoverAntigravityModels(config, auth)
      if (next === undefined) return
      discovered = next
      await context.provider.reload()
    } catch (error) {
      debugLogToFile(`[V2 Discovery] Keeping last discovered inventory: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
