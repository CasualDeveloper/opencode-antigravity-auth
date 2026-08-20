import { Message } from "@opencode-ai/ai"
import { wrapSystemUpdate } from "@opencode-ai/ai/protocols/shared"
import type { Plugin } from "@opencode-ai/plugin"
import type { SessionContext } from "@opencode-ai/plugin/promise/session"

type MutableSessionContext = Pick<SessionContext, "model" | "messages">

function isAntigravityModel(model: SessionContext["model"]): boolean {
  return model.providerID === "google" && model.id.startsWith("antigravity-")
}

export function normalizeAntigravitySystemMessages(
  context: MutableSessionContext,
): void {
  if (!isAntigravityModel(context.model)) return

  const messages: Message[] = []
  let changed = false

  for (const message of context.messages) {
    if (message.role !== "system") {
      messages.push(message)
      continue
    }

    changed = true
    const parts = message.content.filter((part) => part.type === "text")
    if (parts.length === 0) continue

    const cache = parts.at(-1)?.cache
    const update = {
      type: "text" as const,
      text: wrapSystemUpdate(parts),
      ...(cache ? { cache } : {}),
    }
    const previous = messages.at(-1)

    if (previous?.role === "user") {
      messages[messages.length - 1] = Message.make({
        ...previous,
        content: [...previous.content, update],
      })
      continue
    }

    messages.push(Message.make({
      id: message.id,
      role: "user",
      content: [update],
      metadata: message.metadata,
      native: message.native,
    }))
  }

  if (changed) context.messages = messages
}

export function normalizeAntigravitySessionContext(
  context: MutableSessionContext,
): void {
  normalizeAntigravitySystemMessages(context)
}

export async function registerSessionContext(
  context: Pick<Plugin.Context, "session">,
): Promise<() => Promise<void>> {
  const registration = await context.session.hook(
    "context",
    normalizeAntigravitySessionContext,
  )
  return () => registration.dispose()
}
