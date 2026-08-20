import { Message } from "@opencode-ai/ai"
import { Model } from "@opencode-ai/plugin"
import type { Plugin } from "@opencode-ai/plugin"
import type { SessionContext } from "@opencode-ai/plugin/promise/session"
import { describe, expect, it, vi } from "vitest"

import {
  normalizeAntigravitySessionContext,
  normalizeAntigravitySystemMessages,
  registerSessionContext,
} from "./session-context"

function sessionContext(
  messages: Message[],
  model = "google/antigravity-gemini-3.1-pro",
): Pick<SessionContext, "model" | "messages"> {
  return {
    model: Model.Ref.parse(model),
    messages,
  }
}

describe("v2 session context", () => {
  it("lowers chronological system updates to wrapped user text", () => {
    const context = sessionContext([
      Message.user("Before."),
      Message.system("Use <new> rules & constraints."),
      Message.assistant("After."),
    ])

    normalizeAntigravitySystemMessages(context)

    expect(context.messages).toHaveLength(2)
    expect(context.messages[0]).toMatchObject({
      role: "user",
      content: [
        { type: "text", text: "Before." },
        {
          type: "text",
          text: "<system-update>\nUse &lt;new&gt; rules &amp; constraints.\n</system-update>",
        },
      ],
    })
    expect(context.messages[1]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "After." }],
    })
    expect(context.messages.some((message) => message.role === "system")).toBe(false)
  })

  it("preserves the chronological position after an assistant message", () => {
    const context = sessionContext([
      Message.user("Before."),
      Message.assistant("Response."),
      Message.system("Instructions changed."),
      Message.user("Continue."),
    ])

    normalizeAntigravitySystemMessages(context)

    expect(context.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "user",
    ])
    expect(context.messages[2]?.content).toEqual([
      {
        type: "text",
        text: "<system-update>\nInstructions changed.\n</system-update>",
      },
    ])
  })

  it("does not alter non-Antigravity model history", () => {
    const context = sessionContext([
      Message.user("Before."),
      Message.system("Instructions changed."),
    ], "google/gemini-2.5-pro")
    const original = context.messages

    normalizeAntigravitySystemMessages(context)

    expect(context.messages).toBe(original)
    expect(context.messages[1]?.role).toBe("system")
  })

  it("disposes the session hook during plugin cleanup", async () => {
    const dispose = vi.fn(async () => {})
    const hook = vi.fn(async () => ({ dispose }))
    const context = {
      session: { hook },
    } as unknown as Pick<Plugin.Context, "session">

    const cleanup = await registerSessionContext(context)

    expect(hook).toHaveBeenCalledWith("context", normalizeAntigravitySessionContext)
    await cleanup()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
