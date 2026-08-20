import { describe, expect, it } from "vitest"

import { antigravityAuthPlugin } from "./plugin"

describe("Antigravity v2 plugin", () => {
  it("exports the expected plugin ID", () => {
    expect(antigravityAuthPlugin.id).toBe("opencode.provider.antigravity")
  })
})
