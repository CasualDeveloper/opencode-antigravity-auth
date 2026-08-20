import { Model, Provider } from "@opencode-ai/plugin"
import type { CatalogDraft } from "@opencode-ai/plugin/promise/catalog"

import {
  OPENCODE_MODEL_DEFINITIONS,
  type ModelVariant,
  type OpencodeModelDefinition,
} from "../plugin/config/models"

export const ANTIGRAVITY_PROVIDER_PACKAGE = `aisdk:${new URL("./provider.js", import.meta.url).href}`

function toV2VariantSettings(variant: ModelVariant): Record<string, unknown> {
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

export function toV2Model(
  modelID: string,
  definition: OpencodeModelDefinition,
): Model.Info {
  return {
    ...Model.Info.default(Provider.ID.google, Model.ID.make(modelID)),
    modelID: Model.ID.make(modelID),
    name: definition.name,
    package: ANTIGRAVITY_PROVIDER_PACKAGE,
    capabilities: {
      tools: true,
      input: [...definition.modalities.input],
      output: [...definition.modalities.output],
    },
    variants: Object.entries(definition.variants ?? {}).map(([id, settings]) => ({
      id: Model.VariantID.make(id),
      settings: toV2VariantSettings(settings),
    })),
    time: { released: 0 },
    cost: [],
    status: "active",
    enabled: true,
    limit: { ...definition.limit },
  }
}

export function registerStaticCatalog(catalog: CatalogDraft): void {
  for (const [modelID, definition] of Object.entries(OPENCODE_MODEL_DEFINITIONS)) {
    if (!modelID.startsWith("antigravity-")) continue
    catalog.model.update("google", modelID, (model) => {
      Object.assign(model, toV2Model(modelID, definition))
    })
  }
}
