import { describe, expect, it } from "vitest"

import { OPENCODE_MODEL_DEFINITIONS } from "../plugin/config/models"
import { toV2Model } from "./catalog"

describe("v2 catalog conversion", () => {
  it("converts curated variants and capabilities", () => {
    const definition = OPENCODE_MODEL_DEFINITIONS["antigravity-gemini-3.1-pro"]
    if (!definition) throw new Error("Missing Gemini 3.1 Pro definition")

    expect(toV2Model("antigravity-gemini-3.1-pro", definition)).toMatchObject({
      id: "antigravity-gemini-3.1-pro",
      modelID: "antigravity-gemini-3.1-pro",
      providerID: "google",
      name: "Gemini 3.1 Pro (Antigravity)",
      capabilities: {
        tools: true,
        input: ["text", "image", "pdf"],
        output: ["text"],
      },
      variants: [
        {
          id: "low",
          settings: { thinkingConfig: { includeThoughts: true, thinkingLevel: "low" } },
        },
        {
          id: "high",
          settings: { thinkingConfig: { includeThoughts: true, thinkingLevel: "high" } },
        },
      ],
      status: "active",
      enabled: true,
      limit: { context: 1048576, output: 65535 },
    })
    expect(toV2Model("antigravity-gemini-3.1-pro", definition).package)
      .toMatch(/^aisdk:file:\/\/.*\/provider\.js$/)
  })

  it("converts Claude thinking budgets to Google provider settings", () => {
    const definition = OPENCODE_MODEL_DEFINITIONS["antigravity-claude-opus-4-6-thinking"]
    if (!definition) throw new Error("Missing Claude Opus definition")

    expect(toV2Model("antigravity-claude-opus-4-6-thinking", definition).variants).toEqual([
      {
        id: "low",
        settings: { thinkingConfig: { includeThoughts: true, thinkingBudget: 8192 } },
      },
      {
        id: "max",
        settings: { thinkingConfig: { includeThoughts: true, thinkingBudget: 32768 } },
      },
    ])
  })
})
