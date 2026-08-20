import type { Plugin } from "@opencode-ai/plugin"
import { z } from "zod"

import { accessTokenExpired, parseRefreshParts } from "../plugin/auth"
import { AccountManager } from "../plugin/accounts"
import { ensureProjectContext } from "../plugin/project"
import { executeSearch } from "../plugin/search"
import { refreshAccessToken } from "../plugin/token"
import { resolveOAuthAuth } from "./auth"

const SearchInput = z.object({
  query: z.string().min(1).describe("The search query or question to answer using web search"),
  urls: z.array(z.string().url()).optional().describe("Specific URLs to fetch and analyze"),
  thinking: z.boolean().optional().describe("Enable deep thinking for more thorough analysis"),
})

const SearchInputSchema = {
  type: "object",
  properties: {
    query: { type: "string", minLength: 1 },
    urls: { type: "array", items: { type: "string", format: "uri" } },
    thinking: { type: "boolean" },
  },
  required: ["query"],
  additionalProperties: false,
} as const

const SearchOutputSchema = { type: "string" } as const

const SEARCH_TOOL_DESCRIPTION = `Search the public web with Google grounding when broad discovery across unknown sources or current information is required.

Do not use for a known URL; use webfetch instead. For GitHub repositories, issues, pull requests, commits, or releases, prefer available GitHub or API tools. Prefer first-party targeted tools when available.`

export async function registerGoogleSearch(
  context: Pick<Plugin.Context, "integration" | "tool">,
  enabled = true,
): Promise<void> {
  if (!enabled) return

  await context.tool.transform((tools) => {
    tools.add({
      name: "google_search",
      description: SEARCH_TOOL_DESCRIPTION,
      input: SearchInputSchema,
      output: SearchOutputSchema,
      options: { codemode: false },
      execute: async (input) => {
        const args = SearchInput.parse(input)
        const connectedAuth = await resolveOAuthAuth(context)
        if (!connectedAuth) {
          const output = "Error: Google Antigravity is not authenticated. Connect the integration first."
          return { output, content: output }
        }

        const accountManager = await AccountManager.loadFromDisk(connectedAuth)
        const connectedToken = parseRefreshParts(connectedAuth.refresh).refreshToken
        const account = accountManager.getAccounts()
          .find((candidate) => candidate.parts.refreshToken === connectedToken)
          ?? accountManager.getCurrentOrNextForFamily("gemini")
        let auth = account ? accountManager.toAuthDetails(account) : connectedAuth
        if (!auth.access || accessTokenExpired(auth)) {
          const refreshed = await refreshAccessToken(auth)
          if (!refreshed?.access) {
            const output = "Error: No valid Google Antigravity access token is available. Reconnect the integration."
            return { output, content: output }
          }
          auth = refreshed
          if (account) {
            accountManager.updateFromAuth(account, auth)
            await accountManager.saveToDisk()
          }
        }

        const projectContext = await ensureProjectContext(auth)
        if (account && projectContext.auth.refresh !== auth.refresh) {
          accountManager.updateFromAuth(account, projectContext.auth)
          await accountManager.saveToDisk()
        }
        const accessToken = projectContext.auth.access ?? auth.access
        if (!accessToken) {
          const output = "Error: No valid Google Antigravity access token is available. Reconnect the integration."
          return { output, content: output }
        }

        const output = await executeSearch(
          {
            query: args.query,
            urls: args.urls,
            thinking: args.thinking ?? true,
          },
          accessToken,
          projectContext.effectiveProjectId,
        )
        return { output, content: output }
      },
    })
  })
}
