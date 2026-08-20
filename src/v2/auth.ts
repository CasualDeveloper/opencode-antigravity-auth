import type { Plugin } from "@opencode-ai/plugin"

import { oauthAuthFromDisk } from "../plugin/oauth-auth-from-disk"
import { isOAuthAuth } from "../plugin/auth"
import type { AuthDetails, OAuthAuthDetails } from "../plugin/types"

export async function resolveAuth(
  context: Pick<Plugin.Context, "integration">,
): Promise<AuthDetails> {
  const connection = await context.integration.connection.active("google")
  if (!connection) return await oauthAuthFromDisk() ?? { type: "none" }

  const credential = await context.integration.connection.resolve(connection)
  if (!credential) return await oauthAuthFromDisk() ?? { type: "none" }
  if (credential.type === "oauth" && credential.methodID === "antigravity") {
    return {
      type: "oauth",
      refresh: credential.refresh,
      access: credential.access,
      expires: credential.expires,
    }
  }
  if (credential.type === "oauth") return await oauthAuthFromDisk() ?? { type: "none" }
  if (credential.type === "key") return { type: "api", key: credential.key }
  return { type: "none" }
}

export async function resolveOAuthAuth(
  context: Pick<Plugin.Context, "integration">,
): Promise<OAuthAuthDetails | undefined> {
  const auth = await resolveAuth(context)
  return isOAuthAuth(auth) ? auth : oauthAuthFromDisk()
}
