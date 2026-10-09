import { formatRefreshParts, parseRefreshParts } from "./auth"
import { resolveCachedAuth } from "./cache"
import { findAccountByRefreshToken, isRefreshTokenDeleted, loadAccounts } from "./storage"
import type { OAuthAuthDetails } from "./types"

/** Resolve only the selected account, including persisted refresh-token rotation. */
export async function reconcileOAuthAuth(auth: OAuthAuthDetails, email?: string): Promise<OAuthAuthDetails> {
  const stored = await loadAccounts()
  const parts = parseRefreshParts(auth.refresh)
  if (!stored || !parts.refreshToken) return resolveCachedAuth(auth)
  const account = findAccountByRefreshToken(stored, parts.refreshToken)
    ?? (email && isRefreshTokenDeleted(stored, parts.refreshToken)
      ? stored.accounts.find((candidate) => candidate.email === email)
      : undefined)
  if (!account) {
    return resolveCachedAuth(auth)
  }
  if (account.refreshToken === parts.refreshToken) return resolveCachedAuth(auth)
  return resolveCachedAuth({
    type: "oauth",
    refresh: formatRefreshParts({
      refreshToken: account.refreshToken,
      projectId: account.projectId ?? parts.projectId,
      managedProjectId: account.managedProjectId ?? parts.managedProjectId,
    }),
    access: "",
    expires: 0,
  })
}

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
