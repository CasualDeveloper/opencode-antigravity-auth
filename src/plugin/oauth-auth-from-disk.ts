import { formatRefreshParts } from "./auth"
import { loadAccounts } from "./storage"
import type { OAuthAuthDetails } from "./types"

export async function oauthAuthFromDisk(): Promise<OAuthAuthDetails | undefined> {
  const stored = await loadAccounts()
  const accounts = stored?.accounts ?? []
  const indexed = typeof stored?.activeIndex === "number"
    && stored.activeIndex >= 0
    && stored.activeIndex < accounts.length
    ? accounts[stored.activeIndex]
    : undefined
  const account = indexed?.enabled !== false && indexed?.refreshToken
    ? indexed
    : accounts.find((candidate) => candidate.enabled !== false && !!candidate.refreshToken)
  if (!account?.refreshToken) return undefined

  return {
    type: "oauth",
    refresh: formatRefreshParts({
      refreshToken: account.refreshToken,
      projectId: account.projectId,
      managedProjectId: account.managedProjectId,
    }),
    access: "",
    expires: 0,
  }
}
