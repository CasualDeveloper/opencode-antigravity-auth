import { describe, expect, it } from "vitest";

import {
  OPENCODE_MODEL_DEFINITIONS,
  modelsFromAntigravityAvailableModels,
  modelsFromGeminiApi,
} from "./models";

const getModel = (name: string) => {
  const model = OPENCODE_MODEL_DEFINITIONS[name];
  if (!model) {
    throw new Error(`Missing model definition for ${name}`);
  }
  return model;
};

describe("OPENCODE_MODEL_DEFINITIONS", () => {
  it("includes the full set of configured models", () => {
    const modelNames = Object.keys(OPENCODE_MODEL_DEFINITIONS).sort();

    expect(modelNames).toEqual([
      "antigravity-claude-opus-4-6-thinking",
      "antigravity-claude-sonnet-4-6",
      "antigravity-gemini-3-flash",
      "antigravity-gemini-3-pro",
      "antigravity-gemini-3.1-pro",
      "antigravity-gemini-3.5-flash",
      "antigravity-gemini-3.6-flash",
      "antigravity-gemini-3.7-flash",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
      "gemini-3.1-pro",
      "gemini-3.1-pro-preview-customtools",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
    ]);
  });

  it("defines Gemini 3 variants for Antigravity models", () => {
    expect(getModel("antigravity-gemini-3-pro").variants).toEqual({
      low: { thinkingLevel: "low" },
      high: { thinkingLevel: "high" },
    });

    expect(getModel("antigravity-gemini-3.1-pro").variants).toEqual({
      low: { thinkingLevel: "low" },
      high: { thinkingLevel: "high" },
    });

    expect(getModel("antigravity-gemini-3-flash").variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });

    expect(getModel("antigravity-gemini-3.5-flash").variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });

    expect(getModel("antigravity-gemini-3.6-flash").variants).toEqual({
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });

    expect(getModel("antigravity-gemini-3.7-flash").variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    expect(getModel("antigravity-gemini-3.6-flash").temperature).toBe(false);
    expect(getModel("gemini-3.6-flash").temperature).toBe(false);
    expect(getModel("gemini-3.5-flash-lite").temperature).toBe(false);
    expect(getModel("gemini-3.6-flash").variants).toEqual({
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    expect(getModel("gemini-3.7-flash").variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    expect(getModel("gemini-3.5-flash-lite").variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
  });

  it("defines thinking budget variants for Claude thinking models", () => {
    expect(getModel("antigravity-claude-opus-4-6-thinking").variants).toEqual({
      low: { thinkingConfig: { thinkingBudget: 8192 } },
      max: { thinkingConfig: { thinkingBudget: 32768 } },
    });
  });
});

describe("dynamic model discovery helpers", () => {
  it("converts Gemini models.list metadata into OpenCode models", () => {
    const models = modelsFromGeminiApi([
      {
        name: "models/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        inputTokenLimit: 1000,
        outputTokenLimit: 2000,
        supportedGenerationMethods: ["generateContent"],
      },
      {
        name: "models/text-embedding-004",
        displayName: "Text Embedding 004",
        supportedGenerationMethods: ["embedContent"],
      },
    ]);

    expect(models["gemini-2.5-flash"]).toMatchObject({
      name: "Gemini 2.5 Flash (Gemini API)",
      limit: { context: 1000, output: 2000 },
      modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    });
    expect(models["text-embedding-004"]).toBeUndefined();
  });

  it("keeps Gemini models.list resource names distinct from shared base aliases", () => {
    const models = modelsFromGeminiApi([
      {
        name: "models/gemini-2.5-flash-001",
        baseModelId: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash 001",
        inputTokenLimit: 1000,
        outputTokenLimit: 2000,
        supportedGenerationMethods: ["generateContent"],
      },
      {
        name: "models/gemini-2.5-flash-002",
        baseModelId: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash 002",
        inputTokenLimit: 3000,
        outputTokenLimit: 4000,
        supportedGenerationMethods: ["generateContent"],
      },
    ]);

    expect(models["gemini-2.5-flash-001"]?.limit).toEqual({ context: 1000, output: 2000 });
    expect(models["gemini-2.5-flash-002"]?.limit).toEqual({ context: 3000, output: 4000 });
  });

  it("converts Antigravity available models while preserving curated variants and inferring dynamic ones", () => {
    const models = modelsFromAntigravityAvailableModels({
      "gemini-3-flash": {
        displayName: "Gemini 3 Flash",
        modelName: "gemini-3-flash",
      },
      "gemini-3.6-flash": {
        displayName: "Gemini 3.6 Flash",
        modelName: "gemini-3.6-flash",
      },
      "gemini-3.7-flash": {
        displayName: "Gemini 3.7 Flash",
        modelName: "gemini-3.7-flash",
      },
      "gemini-3.8-flash": {
        displayName: "Gemini 3.8 Flash Preview",
        modelName: "gemini-3.8-flash",
      },
      "gemini-3.8-pro": {
        displayName: "Gemini 3.8 Pro Preview",
        modelName: "gemini-3.8-pro",
      },
      "claude-sonnet-4-6": {
        displayName: "Claude Sonnet 4.6",
      },
    });

    expect(models["antigravity-gemini-3-flash"]?.variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    expect(models["antigravity-gemini-3.6-flash"]?.variants).toEqual({
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    expect(models["antigravity-gemini-3.7-flash"]?.variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    // Inferred variants for dynamically discovered models not in static table
    expect(models["antigravity-gemini-3.8-flash"]?.variants).toEqual({
      minimal: { thinkingLevel: "minimal" },
      low: { thinkingLevel: "low" },
      medium: { thinkingLevel: "medium" },
      high: { thinkingLevel: "high" },
    });
    expect(models["antigravity-gemini-3.8-pro"]?.variants).toEqual({
      low: { thinkingLevel: "low" },
      high: { thinkingLevel: "high" },
    });
    expect(models["antigravity-claude-sonnet-4-6"]).toMatchObject({
      name: "Claude Sonnet 4.6 (Antigravity)",
      limit: { context: 200000, output: 64000 },
    });
  });

  it("groups advertised backend tiers without relying on static base models", () => {
    const models = modelsFromAntigravityAvailableModels({
      chat_20706: {
        displayName: "Gemini 3.1 Flash Lite",
        modelName: "chat_20706",
      },
      tab_flash_lite_preview: {
        displayName: "Gemini 3.1 Flash Lite",
        modelName: "tab_flash_lite_preview",
      },
      "gemini-3-flash-agent": {
        displayName: "Gemini 3.5 Flash (High)",
        modelName: "gemini-3-flash-agent",
      },
      "gemini-3.1-pro": {
        displayName: "Gemini 3.1 Pro",
        modelName: "gemini-3.1-pro",
      },
      "gemini-3.1-pro-low": {
        displayName: "Gemini 3.1 Pro (Low)",
        modelName: "gemini-3.1-pro-low",
      },
      "gemini-3.1-pro-high": {
        displayName: "Gemini 3.1 Pro (High)",
        modelName: "gemini-3.1-pro-high",
      },
      "gemini-3.6-flash-tiered": {
        displayName: "Gemini 3.6 Flash",
        modelName: "gemini-3.6-flash-tiered",
      },
      "claude-opus-4-6-thinking-max": {
        displayName: "Claude Opus 4.6 Thinking (Max)",
        modelName: "claude-opus-4-6-thinking-max",
      },
      "gpt-oss-120b-medium": {
        displayName: "GPT-OSS 120B (Medium)",
        modelName: "gpt-oss-120b-medium",
      },
      "gemini-3.9-flash": {
        displayName: "Gemini 3.9 Flash",
        modelName: "gemini-3.9-flash",
      },
    });

    expect(Object.keys(models).sort()).toEqual([
      "antigravity-claude-opus-4-6-thinking",
      "antigravity-gemini-3.1-pro",
      "antigravity-gemini-3.5-flash",
      "antigravity-gemini-3.6-flash",
      "antigravity-gemini-3.9-flash",
      "antigravity-gpt-oss-120b",
    ]);
    expect(models["antigravity-gemini-3.1-pro"]?.variants).toEqual({
      low: { backendModelID: "gemini-3.1-pro-low" },
      high: { backendModelID: "gemini-3.1-pro-high" },
    });
    expect(models["antigravity-gemini-3.5-flash"]?.variants).toEqual({
      high: { backendModelID: "gemini-3-flash-agent" },
    });
  });

  it("does not resurrect retired models from the bundled metadata", () => {
    const models = modelsFromAntigravityAvailableModels({
      "gemini-3.1-pro-high": { displayName: "Gemini 3.1 Pro (High)" },
      "gemini-3.7-flash-tiered": {},
    });

    expect(Object.keys(models).sort()).toEqual([
      "antigravity-gemini-3.1-pro",
      "antigravity-gemini-3.7-flash",
    ]);
    expect(models["antigravity-gemini-3.1-pro"]?.variants).toEqual({
      high: { backendModelID: "gemini-3.1-pro-high" },
    });
    expect(models["antigravity-gemini-3.1-pro"]?.backendModelID).toBe("gemini-3.1-pro-high");
    expect(modelsFromAntigravityAvailableModels({})).toEqual({});
  });

  it("keeps a tier model when no canonical model is available", () => {
    const models = modelsFromAntigravityAvailableModels({
      "future-model-high": {
        displayName: "Future Model High",
        modelName: "future-model-high",
      },
    });

    expect(models["antigravity-future-model-high"]).toBeDefined();
  });

  it("uses discovered limits and excludes explicitly internal models", () => {
    const models = modelsFromAntigravityAvailableModels({
      "claude-opus-5-5-high": {
        displayName: "Claude Opus 5.5 (High)",
        maxTokens: 1000000,
        maxOutputTokens: 128000,
      },
      "future-internal-model": { isInternal: true },
    });
    expect(models["antigravity-claude-opus-5-5"]?.limit)
      .toEqual({ context: 1000000, output: 128000 });
    expect(models["antigravity-future-internal-model"]).toBeUndefined();
  });

  it("deduplicates advertised aliases in favor of the ID matching the display name", () => {
    const entries = [
      ["gemini-2.5-flash", { displayName: "Gemini 3.5 Flash Lite" }],
      ["gemini-2.5-flash-lite", { displayName: "Gemini 3.5 Flash Lite" }],
      ["gemini-2.5-flash-thinking", { displayName: "Gemini 3.5 Flash Lite" }],
      ["gemini-3.5-flash-lite", { displayName: "Gemini 3.5 Flash Lite", maxTokens: 1000 }],
      ["gemini-pro-agent", { displayName: "Gemini 3.1 Pro (High)" }],
      ["gemini-3.1-pro-high", { displayName: "Gemini 3.1 Pro (High)", maxTokens: 2000 }],
      ["gemini-3.1-pro-low", { displayName: "Gemini 3.1 Pro (Low)" }],
    ] as const;
    const models = modelsFromAntigravityAvailableModels(Object.fromEntries(entries));
    expect(Object.keys(models).sort()).toEqual([
      "antigravity-gemini-3.1-pro",
      "antigravity-gemini-3.5-flash-lite",
    ]);
    expect(models["antigravity-gemini-3.5-flash-lite"]?.limit.context).toBe(1000);
    expect(models["antigravity-gemini-3.1-pro"]?.variants?.high?.backendModelID).toBe("gemini-3.1-pro-high");
    expect(modelsFromAntigravityAvailableModels(Object.fromEntries([...entries].reverse())))
      .toEqual(models);
  });

  it("keeps a sole alias and selects deterministically when no ID matches the name", () => {
    const entries = [
      ["gemini-3-flash-agent", { displayName: "Gemini 3.5 Flash (High)" }],
      ["old-alias-b", { displayName: "New Model" }],
      ["old-alias-a", { displayName: "New Model" }],
    ] as const;
    const models = modelsFromAntigravityAvailableModels(Object.fromEntries(entries));
    expect(Object.keys(models).sort()).toEqual([
      "antigravity-gemini-3.5-flash",
      "antigravity-old-alias-a",
    ]);
    expect(models["antigravity-gemini-3.5-flash"]?.backendModelID).toBe("gemini-3-flash-agent");
    expect(modelsFromAntigravityAvailableModels(Object.fromEntries([...entries].reverse())))
      .toEqual(models);
  });

  it("keeps unnamed models distinct and avoids repeating the Antigravity label", () => {
    const models = modelsFromAntigravityAvailableModels({
      "gemini-3.7-flash-tiered": {},
      "gemini-3.8-flash-tiered": {},
    });
    expect(Object.keys(models)).toHaveLength(2);
    expect(models["antigravity-gemini-3.7-flash"]?.name)
      .toBe("Gemini 3.7 Flash (Antigravity)");
    expect(models["antigravity-gemini-3.7-flash"]?.backendModelID)
      .toBe("gemini-3.7-flash-tiered");
  });

  it("builds one model per family with only discovered tier routes", () => {
    const models = modelsFromAntigravityAvailableModels({
      "claude-opus-5-5-high": { displayName: "Claude Opus 5.5 (High)" },
      "claude-opus-5-5-low": { displayName: "Claude Opus 5.5 (Low)" },
      "claude-opus-5-5-medium": { displayName: "Claude Opus 5.5 (Medium)" },
      "gemini-3-flash-agent": { displayName: "Gemini 3.5 Flash (High)" },
      "gemini-3.5-flash-low": { displayName: "Gemini 3.5 Flash (Medium)" },
      "gemini-3.5-flash-extra-low": { displayName: "Gemini 3.5 Flash (Low)" },
      "gemini-3.6-flash-tiered": {},
      "gemini-3.6-flash-low": { displayName: "Gemini 3.6 Flash (Low)" },
      "gemini-3.6-flash-high": { displayName: "Gemini 3.6 Flash (High)" },
    });
    expect(Object.keys(models).sort()).toEqual([
      "antigravity-claude-opus-5-5",
      "antigravity-gemini-3.5-flash",
      "antigravity-gemini-3.6-flash",
    ]);
    expect(models["antigravity-claude-opus-5-5"]?.name).toBe("Claude Opus 5.5 (Antigravity)");
    expect(models["antigravity-claude-opus-5-5"]?.variants).toEqual({
      low: { backendModelID: "claude-opus-5-5-low" },
      medium: { backendModelID: "claude-opus-5-5-medium" },
      high: { backendModelID: "claude-opus-5-5-high" },
    });
    expect(models["antigravity-gemini-3.5-flash"]?.variants).toEqual({
      low: { backendModelID: "gemini-3.5-flash-extra-low" },
      medium: { backendModelID: "gemini-3.5-flash-low" },
      high: { backendModelID: "gemini-3-flash-agent" },
    });
    expect(models["antigravity-gemini-3.6-flash"]?.backendModelID).toBe("gemini-3.6-flash-tiered");
    expect(Object.keys(models["antigravity-gemini-3.6-flash"]?.variants ?? {})).toEqual(["low", "high"]);
  });
});
