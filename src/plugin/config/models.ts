export type ModelThinkingLevel = "minimal" | "low" | "medium" | "high";

export interface ModelThinkingConfig {
  thinkingBudget: number;
}

export interface ModelVariant {
  backendModelID?: string;
  thinkingLevel?: ModelThinkingLevel;
  thinkingConfig?: ModelThinkingConfig;
}

export interface ModelLimit {
  context: number;
  output: number;
}

export type ModelModality = "text" | "image" | "pdf";

export interface ModelModalities {
  input: ModelModality[];
  output: ModelModality[];
}

export interface OpencodeModelDefinition {
  backendModelID?: string;
  name: string;
  temperature?: boolean;
  limit: ModelLimit;
  modalities: ModelModalities;
  variants?: Record<string, ModelVariant>;
}

export type OpencodeModelDefinitions = Record<string, OpencodeModelDefinition>;

export interface GeminiApiModel {
  name?: string;
  baseModelId?: string;
  displayName?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

export interface AntigravityAvailableModel {
  displayName?: string;
  modelName?: string;
  isInternal?: boolean;
  maxTokens?: number;
  maxOutputTokens?: number;
}

export type AntigravityAvailableModels = Record<string, AntigravityAvailableModel>;

const DEFAULT_MODALITIES: ModelModalities = {
  input: ["text", "image", "pdf"],
  output: ["text"],
};

// Metadata overrides for known models, never a source of model availability.
export const OPENCODE_MODEL_DEFINITIONS: OpencodeModelDefinitions = {
  "antigravity-gemini-3-pro": {
    name: "Gemini 3 Pro (Antigravity)",
    limit: { context: 1048576, output: 65535 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      low: { thinkingLevel: "low" },
      high: { thinkingLevel: "high" },
    },
  },
  "antigravity-gemini-3.1-pro": {
    name: "Gemini 3.1 Pro (Antigravity)",
    limit: { context: 1048576, output: 65535 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      low: { thinkingLevel: "low" },
      high: { thinkingLevel: "high" },
    },
  },
  "antigravity-gemini-3-flash": {
    name: "Gemini 3 Flash (Antigravity)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "antigravity-gemini-3.5-flash": {
    name: "Gemini 3.5 Flash (Antigravity)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "antigravity-gemini-3.6-flash": {
    name: "Gemini 3.6 Flash (Antigravity)",
    temperature: false,
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "antigravity-gemini-3.7-flash": {
    name: "Gemini 3.7 Flash (Antigravity)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "antigravity-claude-sonnet-4-6": {
    name: "Claude Sonnet 4.6 (Antigravity)",
    limit: { context: 200000, output: 64000 },
    modalities: DEFAULT_MODALITIES,
  },
  "antigravity-claude-opus-4-6-thinking": {
    name: "Claude Opus 4.6 Thinking (Antigravity)",
    limit: { context: 200000, output: 64000 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      low: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } },
    },
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash (Gemini CLI)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro (Gemini CLI)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
  },
  "gemini-3-flash-preview": {
    name: "Gemini 3 Flash Preview (Gemini CLI)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
  },
  "gemini-3.5-flash": {
    name: "Gemini 3.5 Flash (Gemini CLI)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
  },
  "gemini-3.5-flash-lite": {
    name: "Gemini 3.5 Flash-Lite (Gemini CLI)",
    temperature: false,
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "gemini-3.6-flash": {
    name: "Gemini 3.6 Flash (Gemini CLI)",
    temperature: false,
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "gemini-3.7-flash": {
    name: "Gemini 3.7 Flash (Gemini CLI)",
    limit: { context: 1048576, output: 65536 },
    modalities: DEFAULT_MODALITIES,
    variants: {
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    },
  },
  "gemini-3-pro-preview": {
    name: "Gemini 3 Pro Preview (Gemini CLI)",
    limit: { context: 1048576, output: 65535 },
    modalities: DEFAULT_MODALITIES,
  },
  "gemini-3.1-pro": {
    name: "Gemini 3.1 Pro (Gemini CLI)",
    limit: { context: 1048576, output: 65535 },
    modalities: DEFAULT_MODALITIES,
  },
  "gemini-3.1-pro-preview-customtools": {
    name: "Gemini 3.1 Pro Preview Custom Tools (Gemini CLI)",
    limit: { context: 1048576, output: 65535 },
    modalities: DEFAULT_MODALITIES,
  },
};

function modelIdFromGeminiName(name: string | undefined): string | null {
  if (!name) return null;
  const id = name.replace(/^models\//, "").trim();
  return id || null;
}

function supportsGeminiGeneration(model: GeminiApiModel): boolean {
  const methods = model.supportedGenerationMethods ?? [];
  return methods.includes("generateContent") || methods.includes("streamGenerateContent");
}

function titleFromModelId(modelId: string): string {
  return modelId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultLimitForModel(modelId: string): ModelLimit {
  if (modelId.includes("claude")) {
    return { context: 200000, output: 64000 };
  }
  return { context: 1048576, output: 65536 };
}

function defaultVariantsForModel(modelId: string): Record<string, ModelVariant> | undefined {
  const normalized = modelId.toLowerCase().replace(/^antigravity-/, "");
  if (normalized.includes("claude") && normalized.includes("thinking")) {
    return {
      low: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } },
    };
  }
  if (normalized.startsWith("gemini-3") || normalized.startsWith("gemini-2.5")) {
    if (normalized.includes("pro")) {
      return {
        low: { thinkingLevel: "low" },
        high: { thinkingLevel: "high" },
      };
    }
    if (normalized.includes("flash")) {
      return {
        minimal: { thinkingLevel: "minimal" },
        low: { thinkingLevel: "low" },
        medium: { thinkingLevel: "medium" },
        high: { thinkingLevel: "high" },
      };
    }
  }
  return undefined;
}

function mergeWithStaticDefinition(
  modelId: string,
  discovered: OpencodeModelDefinition,
): OpencodeModelDefinition {
  const existing = OPENCODE_MODEL_DEFINITIONS[modelId];
  if (!existing) return discovered;

  return {
    ...existing,
    ...discovered,
    limit: discovered.limit ?? existing.limit,
    modalities: discovered.modalities ?? existing.modalities,
    variants: existing.variants ?? discovered.variants,
  };
}

function antigravityModelIdFromEntry(sourceId: string, entry: AntigravityAvailableModel): string | null {
  const rawId = (entry.modelName || sourceId).trim();
  if (!rawId) return null;
  const modelId = rawId.replace(/^models\//, "");
  return modelId.startsWith("antigravity-") ? modelId : `antigravity-${modelId}`;
}

export function modelsFromGeminiApi(models: GeminiApiModel[]): OpencodeModelDefinitions {
  const definitions: OpencodeModelDefinitions = {};

  for (const model of models) {
    if (!supportsGeminiGeneration(model)) continue;
    const modelId = modelIdFromGeminiName(model.name) || model.baseModelId;
    if (!modelId) continue;

    const variants = defaultVariantsForModel(modelId);
    const discovered: OpencodeModelDefinition = {
      name: model.displayName ? `${model.displayName} (Gemini API)` : `${titleFromModelId(modelId)} (Gemini API)`,
      limit: {
        context: model.inputTokenLimit ?? defaultLimitForModel(modelId).context,
        output: model.outputTokenLimit ?? defaultLimitForModel(modelId).output,
      },
      modalities: DEFAULT_MODALITIES,
      ...(variants ? { variants } : {}),
    };
    definitions[modelId] = mergeWithStaticDefinition(modelId, discovered);
  }

  return definitions;
}

function antigravityBackendDefinitions(
  models: AntigravityAvailableModels,
): OpencodeModelDefinitions {
  const definitions: OpencodeModelDefinitions = {};
  const selectedNames = new Map<string, { id: string; matchesName: boolean }>();

  for (const [sourceId, entry] of Object.entries(models)) {
    const modelId = antigravityModelIdFromEntry(sourceId, entry);
    if (!modelId) continue;

    // Exclude editor-internal models, but keep advertised tier IDs: a static
    // base-model definition is metadata, not evidence that a base ID is served.
    const rawModelId = modelId.replace(/^antigravity-/, "");
    if (entry.isInternal || /^(?:chat_|tab(?:_jump)?_)/i.test(rawModelId)) continue;

    const displayName = entry.displayName?.trim();
    if (displayName) {
      const nameKey = displayName.toLowerCase().replace(/\s+/g, " ");
      const matchesName = rawModelId.toLowerCase().replace(/[^a-z0-9]/g, "")
        === nameKey.replace(/[^a-z0-9]/g, "");
      const selected = selectedNames.get(nameKey);
      // Backends advertise legacy aliases under the same name. Prefer a
      // matching ID, then use ID order so API response order cannot flip it.
      if (selected) {
        if (selected.matchesName && !matchesName) continue;
        if (selected.matchesName === matchesName && selected.id <= modelId) continue;
        delete definitions[selected.id];
      }
      selectedNames.set(nameKey, { id: modelId, matchesName });
    }

    const fixedTier = /-(?:extra-low|minimal|low|medium|high|max|agent)$/i.test(rawModelId);
    const variants = fixedTier ? undefined : defaultVariantsForModel(modelId);
    const discovered: OpencodeModelDefinition = {
      name: `${displayName || titleFromModelId(rawModelId)} (Antigravity)`,
      limit: {
        context: entry.maxTokens ?? defaultLimitForModel(modelId).context,
        output: entry.maxOutputTokens ?? defaultLimitForModel(modelId).output,
      },
      modalities: DEFAULT_MODALITIES,
      ...(variants ? { variants } : {}),
    };
    definitions[modelId] = mergeWithStaticDefinition(modelId, discovered);
  }

  return definitions;
}

export function modelsFromAntigravityAvailableModels(
  models: AntigravityAvailableModels,
): OpencodeModelDefinitions {
  const groups = new Map<string, Array<{
    id: string;
    name: string;
    tier?: string;
    definition: OpencodeModelDefinition;
  }>>();
  for (const [id, definition] of Object.entries(antigravityBackendDefinitions(models))) {
    const label = definition.name.replace(/ \(Antigravity\)$/, "");
    const tierMatch = label.match(/\s+\((minimal|extra-low|low|medium|high|max)\)$/i);
    const tier = tierMatch?.[1]?.toLowerCase();
    const name = tierMatch
      ? label.slice(0, tierMatch.index)
      : label.replace(/ Tiered$/i, "");
    const key = name.toLowerCase();
    const group = groups.get(key) ?? [];
    group.push({ id, name, tier, definition });
    groups.set(key, group);
  }

  const definitions: OpencodeModelDefinitions = {};
  const tiers = ["minimal", "extra-low", "low", "medium", "high", "max"];
  for (const group of groups.values()) {
    // A bare/tiered endpoint supplies the default when advertised. Otherwise
    // default to the lowest advertised tier, independent of response order.
    group.sort((a, b) =>
      (a.tier ? tiers.indexOf(a.tier) + 1 : 0) - (b.tier ? tiers.indexOf(b.tier) + 1 : 0)
      || a.id.localeCompare(b.id),
    );
    const preferred = group[0];
    if (!preferred) continue;
    const tiered = group.filter((entry) => entry.tier !== undefined);
    const matchingBaseID = group
      .map((entry) => entry.id.replace(/-(?:extra-low|minimal|low|medium|high|max|tiered)$/i, ""))
      .find((base) => base.replace(/^antigravity-/, "").replace(/[^a-z0-9]/gi, "").toLowerCase()
        === preferred.name.replace(/[^a-z0-9]/gi, "").toLowerCase());
    const id = tiered.length > 0
      ? matchingBaseID ?? `antigravity-${preferred.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`
      : preferred.id.replace(/-tiered$/i, "");
    const variants = tiered.length > 0
      ? Object.fromEntries(tiered.map((entry) => [entry.tier!, {
        backendModelID: entry.id.replace(/^antigravity-/, ""),
      }]))
      : preferred.definition.variants;
    definitions[id] = {
      ...preferred.definition,
      name: `${preferred.name} (Antigravity)`,
      backendModelID: preferred.id.replace(/^antigravity-/, ""),
      variants,
    };
  }
  return definitions;
}
