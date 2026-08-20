import { Plugin } from "@opencode-ai/plugin"

import { loadConfig, initRuntimeConfig } from "../plugin/config"
import { initializeDebug } from "../plugin/debug"
import { registerStaticCatalog } from "./catalog"
import { registerDynamicCatalog } from "./discovery"
import { registerLifecycleEvents } from "./events"
import { registerFetchInterceptor } from "./fetch"
import { registerOAuthIntegration } from "./oauth"
import { registerGoogleSearch } from "./search-tool"
import { registerSessionContext } from "./session-context"

export const antigravityAuthPlugin = Plugin.define({
  id: "opencode.provider.antigravity",
  setup: async (context) => {
    const config = loadConfig(process.cwd())
    initRuntimeConfig(config)
    initializeDebug(config)
    const refreshDiscovery = await registerDynamicCatalog(context)
    const cleanupFetchInterceptor = await registerFetchInterceptor(context)
    const cleanupLifecycleEvents = await registerLifecycleEvents(context, config)
    const cleanupSessionContext = await registerSessionContext(context)
    const [, cleanupOAuthIntegration] = await Promise.all([
      context.catalog.transform(registerStaticCatalog),
      registerOAuthIntegration(context, refreshDiscovery),
      registerGoogleSearch(context, config.google_search_enabled),
    ])
    await refreshDiscovery()
    return async () => {
      await Promise.all([
        cleanupFetchInterceptor(),
        cleanupLifecycleEvents(),
        cleanupOAuthIntegration(),
        cleanupSessionContext(),
      ])
    }
  },
})
