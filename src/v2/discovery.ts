import type { Plugin } from "@opencode-ai/plugin"

import { discoverAntigravityModels } from "../plugin"
import { loadConfig } from "../plugin/config"
import type { OpencodeModelDefinitions } from "../plugin/config/models"
import { debugLogToFile } from "../plugin/debug"
import { resolveAuth } from "./auth"
import { toV2Model } from "./catalog"

export async function registerDynamicCatalog(
  context: Pick<Plugin.Context, "catalog" | "integration">,
): Promise<() => Promise<void>> {
  let discovered: OpencodeModelDefinitions = {}

  await context.catalog.transform((catalog) => {
    for (const [modelID, definition] of Object.entries(discovered)) {
      catalog.model.update("google", modelID, (model) => {
        Object.assign(model, toV2Model(modelID, definition))
      })
    }
  })

  return async () => {
    try {
      const config = loadConfig(process.cwd())
      const auth = await resolveAuth(context)
      const next = await discoverAntigravityModels(config, auth)
      if (Object.keys(next).length === 0) return
      discovered = next
      await context.catalog.reload()
    } catch (error) {
      debugLogToFile(`[V2 Discovery] Static fallback: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
