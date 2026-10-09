import { Plugin } from "@opencode/plugin"

import { registerFetchInterceptor } from "./google-provider"
import { registerOAuthIntegration } from "./plugin/auth"
import { loadConfig, initRuntimeConfig } from "./plugin/config"
import { initializeDebug } from "./plugin/debug"
import { createLogger } from "./plugin/logger"
import { registerDynamicCatalog } from "./plugin/model-catalog"
import { registerSessionContext } from "./plugin/recovery"
import { registerGoogleSearch } from "./plugin/search"
import { createAutoUpdateChecker } from "./hooks/auto-update-checker"

const log = createLogger("plugin")

export const antigravityAuthPlugin = Plugin.define({
  id: "opencode.provider.antigravity",
  async setup(context) {
    const config = loadConfig(context.location.directory)
    initRuntimeConfig(config)
    initializeDebug(config)

    const refreshDiscovery = await registerDynamicCatalog(context)
    const cleanupOAuth = await registerOAuthIntegration(context, refreshDiscovery)
    const cleanupTransport = await registerFetchInterceptor(context)
    const cleanupRecovery = await registerSessionContext(context, config.session_recovery)
    await registerGoogleSearch(context, config.google_search_enabled)

    const updateChecker = createAutoUpdateChecker(context.location.directory, {
      autoUpdate: config.auto_update,
    })
    const controller = new AbortController()
    const events = (async () => {
      for await (const event of context.event.subscribe({ signal: controller.signal })) {
        if (event.type === "session.created") {
          updateChecker.onSessionCreated(event.data)
        } else if (
          event.type === "credential.updated"
          || (event.type === "credential.switched" && event.data.integrationID === "google")
        ) {
          await refreshDiscovery()
        }
      }
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) log.warn("Event subscription failed", { error: String(error) })
    })

    await refreshDiscovery()
    return async () => {
      controller.abort()
      await Promise.all([cleanupOAuth(), cleanupTransport(), cleanupRecovery(), events])
    }
  },
})
