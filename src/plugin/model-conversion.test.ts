import { describe, expect, it } from "vitest"

import { ANTIGRAVITY_INVENTORY_FIXTURE } from "./config/antigravity-inventory.fixture"
import { modelsFromAntigravityInventory } from "./config/models"
import { toCatalogModel } from "./model-catalog"

const definitions = modelsFromAntigravityInventory(ANTIGRAVITY_INVENTORY_FIXTURE)

const catalogModel = (id: string) => {
  const definition = definitions[id]
  if (!definition) throw new Error(`Missing normalized model ${id}`)
  return toCatalogModel(id, definition)
}

describe("OpenCode catalog conversion", () => {
  it("converts backend tiers into variants that carry their route", () => {
    expect(catalogModel("antigravity-gemini-3.1-pro")).toMatchObject({
      id: "antigravity-gemini-3.1-pro",
      modelID: "antigravity-gemini-3.1-pro-low",
      providerID: "google",
      name: "Gemini 3.1 Pro (Antigravity)",
      capabilities: {
        tools: true,
        input: ["text", "image", "pdf", "audio", "video"],
        output: ["text"],
      },
      variants: [
        { id: "low", settings: { antigravityModelID: "gemini-3.1-pro-low" } },
        { id: "high", settings: { antigravityModelID: "gemini-pro-agent" } },
      ],
      status: "active",
      enabled: true,
      limit: { context: 1048576, output: 65536 },
    })
    expect(catalogModel("antigravity-gemini-3.1-pro").package)
      .toMatch(/^aisdk:file:\/\/.*\/google-provider\.js$/)
  })

  it("keeps single backend models without variants", () => {
    expect(catalogModel("antigravity-claude-opus-4-6-thinking")).toMatchObject({
      modelID: "antigravity-claude-opus-4-6-thinking",
      variants: [],
      limit: { context: 250000, output: 64000 },
    })
  })

  it("marks image generation models as image output without tools", () => {
    expect(catalogModel("antigravity-gemini-3.1-flash-image").capabilities)
      .toEqual({ tools: false, input: ["text"], output: ["text", "image"] })
  })
})
