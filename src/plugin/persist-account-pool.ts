import type { AntigravityTokenExchangeResult } from "../antigravity/oauth"
import { parseRefreshParts } from "./auth"
import { loadAccounts, replaceAccountRefreshToken, saveAccounts } from "./storage"

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export async function persistAccountPool(
  results: Array<Extract<AntigravityTokenExchangeResult, { type: "success" }>>,
  replaceAll: boolean = false,
): Promise<void> {
  if (results.length === 0) return

  const now = Date.now()
  const stored = replaceAll ? null : await loadAccounts({ throwOnError: true })
  const accounts = stored?.accounts ? [...stored.accounts] : []
  const indexByRefreshToken = new Map<string, number>()
  const indexByEmail = new Map<string, number>()
  const refreshTokenRotations: Array<{ previous: string; next: string }> = []

  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index]
    if (account?.refreshToken) indexByRefreshToken.set(account.refreshToken, index)
    if (account?.email) indexByEmail.set(account.email, index)
  }

  for (const result of results) {
    const parts = parseRefreshParts(result.refresh)
    if (!parts.refreshToken) continue

    const existingIndex = (result.email ? indexByEmail.get(result.email) : undefined)
      ?? indexByRefreshToken.get(parts.refreshToken)
    if (existingIndex === undefined) {
      const newIndex = accounts.length
      indexByRefreshToken.set(parts.refreshToken, newIndex)
      if (result.email) indexByEmail.set(result.email, newIndex)
      accounts.push({
        email: result.email,
        refreshToken: parts.refreshToken,
        projectId: parts.projectId,
        managedProjectId: parts.managedProjectId,
        addedAt: now,
        lastUsed: now,
        enabled: true,
      })
      continue
    }

    const existing = accounts[existingIndex]
    if (!existing) continue

    const oldToken = existing.refreshToken
    accounts[existingIndex] = {
      ...existing,
      email: result.email ?? existing.email,
      refreshToken: parts.refreshToken,
      projectId: parts.projectId ?? existing.projectId,
      managedProjectId: parts.managedProjectId ?? existing.managedProjectId,
      lastUsed: now,
    }
    if (oldToken !== parts.refreshToken) {
      refreshTokenRotations.push({ previous: oldToken, next: parts.refreshToken })
      indexByRefreshToken.delete(oldToken)
      indexByRefreshToken.set(parts.refreshToken, existingIndex)
    }
  }

  if (accounts.length === 0) return

  for (const rotation of refreshTokenRotations) {
    await replaceAccountRefreshToken(rotation.previous, rotation.next)
  }

  const activeIndex = replaceAll
    ? 0
    : typeof stored?.activeIndex === "number" && Number.isFinite(stored.activeIndex)
      ? stored.activeIndex
      : 0
  const normalizedIndex = clampInt(activeIndex, 0, accounts.length - 1)
  const activeIndexByFamily = replaceAll
    ? { claude: 0, gemini: 0 }
    : {
        claude: clampInt(
          stored?.activeIndexByFamily?.claude ?? normalizedIndex,
          0,
          accounts.length - 1,
        ),
        gemini: clampInt(
          stored?.activeIndexByFamily?.gemini ?? normalizedIndex,
          0,
          accounts.length - 1,
        ),
      }
  await saveAccounts({
    version: 4,
    accounts,
    activeIndex: normalizedIndex,
    activeIndexByFamily,
  })
}
