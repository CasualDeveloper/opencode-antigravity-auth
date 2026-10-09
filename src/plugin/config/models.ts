export interface ModelVariant {
  backendModelID: string;
}

export interface ModelLimit {
  context: number;
  output: number;
}

export type ModelModality = "text" | "image" | "pdf" | "audio" | "video";

export interface ModelModalities {
  input: ModelModality[];
  output: ModelModality[];
}

export interface OpencodeModelDefinition {
  backendModelID: string;
  name: string;
  tools: boolean;
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
  isInternal?: boolean;
  maxTokens?: number;
  maxOutputTokens?: number;
  supportsImages?: boolean;
  supportsVideo?: boolean;
  supportedMimeTypes?: Record<string, boolean>;
  tagTitle?: string;
  tagDescription?: string;
}

export type AntigravityAvailableModels = Record<string, AntigravityAvailableModel>;

/** The `fetchAvailableModels` response; its role lists classify the model entries. */
export interface AntigravityModelInventory {
  models?: AntigravityAvailableModels;
  agentModelSorts?: Array<{ groups?: Array<{ modelIds?: string[] }> }>;
  tieredModelIds?: Record<string, string[]>;
  deprecatedModelIds?: Record<string, { newModelId?: string }>;
  tabModelIds?: string[];
  imageGenerationModelIds?: string[];
  commandModelIds?: string[];
  mqueryModelIds?: string[];
  webSearchModelIds?: string[];
  commitMessageModelIds?: string[];
}

// Matches OpenCode's Model.Info default when the backend omits token limits.
const DEFAULT_LIMIT: ModelLimit = { context: 200_000, output: 32_000 };
const TIERS = ["minimal", "extra-low", "low", "medium", "high", "max"] as const;
type Tier = typeof TIERS[number];
const TIER_SUFFIX = /\s+\((minimal|extra[ -]low|low|medium|high|max)\)$/i;
const TIER_ID_SUFFIX = /-(?:extra-low|minimal|low|medium|high|max|tiered)$/i;

function titleFromModelId(modelId: string): string {
  return modelId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function comparable(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function modalities(
  id: string,
  entry: AntigravityAvailableModel,
  inventory: AntigravityModelInventory,
): ModelModalities {
  const mimeTypes = Object.entries(entry.supportedMimeTypes ?? {})
    .filter(([, supported]) => supported)
    .map(([type]) => type);
  const input: ModelModality[] = ["text"];
  if (entry.supportsImages || mimeTypes.some((type) => type.startsWith("image/"))) input.push("image");
  if (mimeTypes.includes("application/pdf")) input.push("pdf");
  if (mimeTypes.some((type) => type.startsWith("audio/"))) input.push("audio");
  // `video/*` frame MIME types appear on models without video support.
  if (entry.supportsVideo) input.push("video");
  const output: ModelModality[] = inventory.imageGenerationModelIds?.includes(id)
    ? ["text", "image"]
    : ["text"];
  return { input, output };
}

/**
 * Converts the backend inventory into OpenCode models. Availability, names,
 * limits, modalities, aliases, and tiers come only from the response.
 */
export function modelsFromAntigravityInventory(
  inventory: AntigravityModelInventory,
): OpencodeModelDefinitions {
  const models = inventory.models ?? {};
  const roles = new Set([
    ...(inventory.agentModelSorts ?? []).flatMap((sort) => sort.groups ?? []).flatMap((group) => group.modelIds ?? []),
    ...Object.values(inventory.tieredModelIds ?? {}).flat(),
    ...(inventory.commandModelIds ?? []),
    ...(inventory.imageGenerationModelIds ?? []),
    ...(inventory.mqueryModelIds ?? []),
    ...(inventory.webSearchModelIds ?? []),
    ...(inventory.commitMessageModelIds ?? []),
  ]);
  const tabModels = new Set(inventory.tabModelIds ?? []);
  const isReplaced = (id: string) => {
    const next = inventory.deprecatedModelIds?.[id]?.newModelId;
    return next !== undefined && next !== id && next in models;
  };
  // An untitled tag naming another advertised model marks this entry as its alias.
  const isAlias = (id: string, entry: AntigravityAvailableModel) => {
    const target = entry.tagDescription?.trim();
    return !entry.tagTitle && !!target && target !== id && target in models;
  };

  const byName = new Map<string, { id: string; entry: AntigravityAvailableModel; label: string }>();
  for (const [id, entry] of Object.entries(models).sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.isInternal || tabModels.has(id) || isReplaced(id) || isAlias(id, entry)) continue;
    const displayName = entry.displayName?.trim();
    // Untitled entries are user-facing only when a backend role list names them.
    if (!displayName && !roles.has(id)) continue;
    const label = displayName || titleFromModelId(id.replace(/-tiered$/i, ""));
    const key = label.toLowerCase().replace(/\s+/g, " ");
    const existing = byName.get(key);
    // Keep one entry per display name, preferring an ID the backend assigns a role.
    if (existing && (roles.has(existing.id) || !roles.has(id))) continue;
    byName.set(key, { id, entry, label });
  }

  const groups = new Map<string, Array<{ id: string; entry: AntigravityAvailableModel; name: string; tier?: Tier }>>();
  for (const { id, entry, label } of byName.values()) {
    const match = label.match(TIER_SUFFIX);
    const tier = match?.[1]?.toLowerCase().replace(" ", "-") as Tier | undefined;
    const name = match ? label.slice(0, match.index).trim() : label;
    const key = name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), { id, entry, name, tier }]);
  }

  const definitions: OpencodeModelDefinitions = {};
  for (const group of groups.values()) {
    // An untiered entry is the default route; otherwise the lowest tier is.
    group.sort((a, b) =>
      (a.tier ? TIERS.indexOf(a.tier) + 1 : 0) - (b.tier ? TIERS.indexOf(b.tier) + 1 : 0)
      || a.id.localeCompare(b.id),
    );
    const preferred = group[0];
    if (!preferred) continue;
    const tiered = group.filter((member) => member.tier !== undefined);
    const baseID = tiered
      .map((member) => member.id.replace(TIER_ID_SUFFIX, ""))
      .find((base) => comparable(base) === comparable(preferred.name));
    const id = tiered.length > 0
      ? `antigravity-${baseID ?? preferred.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`
      : `antigravity-${preferred.id.replace(/-tiered$/i, "")}`;
    definitions[id] = {
      backendModelID: preferred.id,
      name: `${preferred.name} (Antigravity)`,
      tools: !inventory.imageGenerationModelIds?.includes(preferred.id),
      limit: {
        context: preferred.entry.maxTokens ?? DEFAULT_LIMIT.context,
        output: preferred.entry.maxOutputTokens ?? DEFAULT_LIMIT.output,
      },
      modalities: modalities(preferred.id, preferred.entry, inventory),
      ...(tiered.length > 0
        ? { variants: Object.fromEntries(tiered.map((member) => [member.tier!, { backendModelID: member.id }])) }
        : {}),
    };
  }
  return definitions;
}
