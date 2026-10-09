import { describe, expect, it } from "vitest";

import { ANTIGRAVITY_INVENTORY_FIXTURE } from "./antigravity-inventory.fixture";
import { modelsFromAntigravityInventory, type AntigravityModelInventory } from "./models";

const models = modelsFromAntigravityInventory(ANTIGRAVITY_INVENTORY_FIXTURE);

const model = (id: string) => {
  const definition = models[id];
  if (!definition) throw new Error(`Missing normalized model ${id}`);
  return definition;
};

describe("modelsFromAntigravityInventory", () => {
  it("normalizes the live inventory into one OpenCode model per family", () => {
    expect(Object.keys(models).sort()).toEqual([
      "antigravity-claude-opus-4-6-thinking",
      "antigravity-claude-sonnet-4-6",
      "antigravity-gemini-2.5-pro",
      "antigravity-gemini-3-flash",
      "antigravity-gemini-3.1-flash-image",
      "antigravity-gemini-3.1-flash-lite",
      "antigravity-gemini-3.1-pro",
      "antigravity-gemini-3.5-flash",
      "antigravity-gemini-3.5-flash-lite",
      "antigravity-gemini-3.6-flash",
      "antigravity-gemini-3.8-flash",
      "antigravity-gpt-oss-120b",
    ]);
  });

  it("routes advertised tiers to their exact backend IDs, defaulting to the lowest tier", () => {
    expect(model("antigravity-gemini-3.5-flash")).toMatchObject({
      name: "Gemini 3.5 Flash (Antigravity)",
      backendModelID: "gemini-3.5-flash-extra-low",
      variants: {
        low: { backendModelID: "gemini-3.5-flash-extra-low" },
        medium: { backendModelID: "gemini-3.5-flash-low" },
        high: { backendModelID: "gemini-3-flash-agent" },
      },
    });
    expect(model("antigravity-gemini-3.6-flash").variants).toEqual({
      low: { backendModelID: "gemini-3.6-flash-low" },
      medium: { backendModelID: "gemini-3.6-flash-medium" },
      high: { backendModelID: "gemini-3.6-flash-high" },
    });
    expect(model("antigravity-gpt-oss-120b")).toMatchObject({
      name: "GPT-OSS 120B (Antigravity)",
      variants: { medium: { backendModelID: "gpt-oss-120b-medium" } },
    });
  });

  it("follows the backend deprecation map instead of keeping a replaced ID", () => {
    expect(model("antigravity-gemini-3.1-pro").variants).toEqual({
      low: { backendModelID: "gemini-3.1-pro-low" },
      high: { backendModelID: "gemini-pro-agent" },
    });
    const backendIDs = Object.values(models).flatMap((definition) => [
      definition.backendModelID,
      ...Object.values(definition.variants ?? {}).map((variant) => variant.backendModelID),
    ]);
    expect(backendIDs).not.toContain("gemini-3.1-pro-high");
  });

  it("collapses aliases into the model their backend tag names", () => {
    expect(model("antigravity-gemini-3.5-flash-lite").backendModelID).toBe("gemini-3.5-flash-lite");
    expect(Object.keys(models).filter((id) => id.startsWith("antigravity-gemini-2.5-flash"))).toEqual([]);
  });

  it("excludes internal and editor-only models", () => {
    expect(Object.keys(models).some((id) => /chat_|tab_/.test(id))).toBe(false);
  });

  it("keeps an untitled model only because a backend role list names it", () => {
    expect(model("antigravity-gemini-3.8-flash")).toMatchObject({
      name: "Gemini 3.8 Flash (Antigravity)",
      backendModelID: "gemini-3.8-flash-tiered",
    });
  });

  it("does not invent variants for single backend models", () => {
    for (const id of [
      "antigravity-claude-opus-4-6-thinking",
      "antigravity-gemini-3-flash",
      "antigravity-gemini-2.5-pro",
    ]) {
      expect(model(id).variants).toBeUndefined();
    }
    expect(model("antigravity-claude-opus-4-6-thinking").name).toBe("Claude Opus 4.6 (Thinking) (Antigravity)");
  });

  it("uses advertised limits, input types, and image generation roles", () => {
    expect(model("antigravity-claude-opus-4-6-thinking")).toMatchObject({
      tools: true,
      limit: { context: 250000, output: 64000 },
      // Claude advertises JPEG 2000 video frames, but not video support.
      modalities: { input: ["text", "image"], output: ["text"] },
    });
    expect(model("antigravity-gemini-3-flash").modalities.input)
      .toEqual(["text", "image", "pdf", "audio", "video"]);
    expect(model("antigravity-gemini-3.1-flash-lite")).toMatchObject({
      limit: { context: 1048576, output: 65535 },
      modalities: { input: ["text"], output: ["text"] },
    });
    expect(model("antigravity-gemini-3.1-flash-image")).toMatchObject({
      tools: false,
      limit: { context: 200000, output: 32000 },
      modalities: { input: ["text"], output: ["text", "image"] },
    });
  });

  it("does not depend on response order", () => {
    const reversed: AntigravityModelInventory = {
      ...ANTIGRAVITY_INVENTORY_FIXTURE,
      models: Object.fromEntries(Object.entries(ANTIGRAVITY_INVENTORY_FIXTURE.models ?? {}).reverse()),
    };
    expect(modelsFromAntigravityInventory(reversed)).toEqual(models);
  });

  it("prefers the role-assigned ID among same-named entries", () => {
    const normalized = modelsFromAntigravityInventory({
      models: {
        "a-legacy": { displayName: "Future Model" },
        "z-current": { displayName: "Future Model" },
      },
      agentModelSorts: [{ groups: [{ modelIds: ["z-current"] }] }],
    });
    expect(Object.values(normalized).map((definition) => definition.backendModelID)).toEqual(["z-current"]);
  });

  it("returns an empty catalog for an empty inventory", () => {
    expect(modelsFromAntigravityInventory({ models: {} })).toEqual({});
    expect(modelsFromAntigravityInventory({})).toEqual({});
  });
});
