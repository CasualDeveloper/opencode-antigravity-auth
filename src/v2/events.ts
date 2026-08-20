import type { Plugin } from "@opencode-ai/plugin"

import { createAutoUpdateChecker } from "../hooks/auto-update-checker"
import type { AntigravityConfig } from "../plugin/config"

export async function registerLifecycleEvents(
  context: Pick<Plugin.Context, "event">,
  config: AntigravityConfig,
): Promise<() => Promise<void>> {
  const updateChecker = createAutoUpdateChecker(process.cwd(), {
    autoUpdate: config.auto_update,
  })
  const events = context.event.subscribe()
  const iterator = events[Symbol.asyncIterator]()
  let stopped = false

  void (async () => {
    while (!stopped) {
      const result = await iterator.next()
      if (result.done) return
      const event = result.value
      if (event.type !== "session.created") continue
      updateChecker.onSessionCreated(event.data)
    }
  })().catch(() => {})

  return async () => {
    stopped = true
    await iterator.return?.()
  }
}
