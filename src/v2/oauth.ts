import type { Plugin } from "@opencode-ai/plugin"
import type { IntegrationOAuthAuthorization } from "@opencode-ai/plugin/promise/integration"
import type { Credential } from "@opencode-ai/schema/credential"
import { Integration } from "@opencode-ai/schema/integration"

import { authorizeAntigravity, exchangeAntigravity } from "../antigravity/oauth"
import { parseRefreshParts } from "../plugin/auth"
import { persistAccountPool } from "../plugin/persist-account-pool"
import {
  shouldUseManualOAuthCallback,
  startOAuthListener,
  type OAuthListener,
} from "../plugin/server"
import { refreshAccessToken } from "../plugin/token"

export const ANTIGRAVITY_INTEGRATION_ID = Integration.ID.make("google")
export const ANTIGRAVITY_METHOD_ID = Integration.MethodID.make("antigravity")
const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

interface OAuthCallbackParams {
  code: string
  state: string
}

export function parseOAuthCallbackInput(
  value: string,
  fallbackState: string,
): OAuthCallbackParams {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("Missing authorization code")
  if (!fallbackState) throw new Error("Missing OAuth state for authorization attempt")

  let url: URL | undefined
  try {
    url = new URL(trimmed)
  } catch {
    return { code: trimmed, state: fallbackState }
  }

  if (url) {
    const state = url.searchParams.get("state")
    if (!state) throw new Error("Missing state in callback URL")
    if (state !== fallbackState) throw new Error("OAuth state mismatch")

    const oauthError = url.searchParams.get("error")
    if (oauthError) {
      const description = url.searchParams.get("error_description")
      throw new Error(`Google OAuth failed: ${description || oauthError}`)
    }

    const code = url.searchParams.get("code")
    if (!code) throw new Error("Missing code in callback URL")
    return { code, state }
  }

  return { code: trimmed, state: fallbackState }
}

function metadataString(credential: Credential.OAuth, key: string): string | undefined {
  const value = credential.metadata?.[key]
  return typeof value === "string" && value ? value : undefined
}

interface PendingAutomaticAuthorization {
  readonly url: string
  readonly startedAt: number
  readonly listener: OAuthListener
  readonly callback: Promise<Credential.OAuth>
  closePromise?: Promise<void>
  completed: boolean
}

function closePendingAuthorization(pending: PendingAutomaticAuthorization): Promise<void> {
  pending.closePromise ??= pending.listener.close().catch(() => {})
  return pending.closePromise
}

function automaticAuthorization(
  pending: PendingAutomaticAuthorization,
): IntegrationOAuthAuthorization {
  return {
    mode: "auto",
    url: pending.url,
    instructions: "Complete Google sign-in in your browser. OpenCode will detect the localhost callback automatically.",
    expiresAt: pending.startedAt + OAUTH_CALLBACK_TIMEOUT_MS,
    callback: pending.callback,
  }
}

export async function registerOAuthIntegration(
  context: Pick<Plugin.Context, "integration">,
  onCredentialChanged?: () => Promise<void>,
): Promise<() => Promise<void>> {
  let disposed = false
  let pending: PendingAutomaticAuthorization | undefined
  let startInFlight: Promise<IntegrationOAuthAuthorization> | undefined

  const exchangeCredential = async (code: string, state: string): Promise<Credential.OAuth> => {
    if (disposed) throw new Error("Google Antigravity authorization was cancelled")
    const result = await exchangeAntigravity(code, state)
    if (result.type === "failed") throw new Error(result.error)
    if (disposed) throw new Error("Google Antigravity authorization was cancelled")

    await persistAccountPool([result])
    await onCredentialChanged?.()
    return {
      type: "oauth",
      methodID: ANTIGRAVITY_METHOD_ID,
      refresh: result.refresh,
      access: result.access,
      expires: result.expires,
      metadata: {
        ...(result.email ? { email: result.email } : {}),
        ...(result.projectId ? { projectId: result.projectId } : {}),
      },
    }
  }

  const startAuthorization = async (): Promise<IntegrationOAuthAuthorization> => {
    const authorization = await authorizeAntigravity()
    const fallbackState = new URL(authorization.url).searchParams.get("state") ?? ""
    if (!fallbackState) throw new Error("Google OAuth authorization did not include state")
    if (disposed) throw new Error("Google Antigravity authorization was cancelled")

    const manualAuthorization = (listenerError?: unknown): IntegrationOAuthAuthorization => ({
      mode: "code",
      url: authorization.url,
      instructions: listenerError
        ? "Automatic localhost callback is unavailable. Complete Google sign-in, then paste the full redirected localhost URL."
        : "Complete Google sign-in, then paste the full redirected localhost URL.",
      expiresAt: Date.now() + OAUTH_CALLBACK_TIMEOUT_MS,
      callback: async (value) => {
        const { code, state } = parseOAuthCallbackInput(value, fallbackState)
        return exchangeCredential(code, state)
      },
    })

    if (shouldUseManualOAuthCallback()) return manualAuthorization()

    let listener: OAuthListener
    try {
      listener = await startOAuthListener({
        timeoutMs: OAUTH_CALLBACK_TIMEOUT_MS,
        expectedState: fallbackState,
        bindAddress: "127.0.0.1",
      })
    } catch (error) {
      if (disposed) throw new Error("Google Antigravity authorization was cancelled")
      return manualAuthorization(error)
    }

    if (disposed) {
      await listener.close().catch(() => {})
      throw new Error("Google Antigravity authorization was cancelled")
    }

    let session!: PendingAutomaticAuthorization
    const callback = (async (): Promise<Credential.OAuth> => {
      try {
        const callbackUrl = await listener.waitForCallback()
        const { code, state } = parseOAuthCallbackInput(callbackUrl.href, fallbackState)
        return await exchangeCredential(code, state)
      } finally {
        session.completed = true
        if (pending === session) pending = undefined
        await closePendingAuthorization(session)
      }
    })()
    callback.catch(() => {})

    session = {
      url: authorization.url,
      startedAt: Date.now(),
      listener,
      callback,
      completed: false,
    }
    pending = session
    return automaticAuthorization(session)
  }

  const registration = await context.integration.transform((draft) => {
    draft.method.update({
      integrationID: ANTIGRAVITY_INTEGRATION_ID,
      method: {
        id: ANTIGRAVITY_METHOD_ID,
        type: "oauth",
        label: "Google Antigravity",
      },
      authorize: async () => {
        if (disposed) throw new Error("Google Antigravity integration is disposed")
        if (pending && !pending.completed) return automaticAuthorization(pending)
        if (startInFlight) return startInFlight

        const attempt = startAuthorization()
        startInFlight = attempt
        try {
          return await attempt
        } finally {
          if (startInFlight === attempt) startInFlight = undefined
        }
      },
      refresh: async (credential) => {
        const refreshed = await refreshAccessToken(credential)
        if (!refreshed?.access || typeof refreshed.expires !== "number") {
          throw new Error("Google Antigravity token refresh returned no access token")
        }

        const parts = parseRefreshParts(refreshed.refresh)
        const email = metadataString(credential, "email")
        const projectId = parts.projectId ?? metadataString(credential, "projectId") ?? ""
        await persistAccountPool([{
          type: "success",
          refresh: refreshed.refresh,
          access: refreshed.access,
          expires: refreshed.expires,
          email,
          projectId,
        }])

        return {
          ...credential,
          refresh: refreshed.refresh,
          access: refreshed.access,
          expires: refreshed.expires,
          metadata: {
            ...credential.metadata,
            ...(projectId ? { projectId } : {}),
          },
        }
      },
      label: (credential) => metadataString(credential, "email") ?? "Google Antigravity",
    })
  })

  return async () => {
    disposed = true
    if (startInFlight) await startInFlight.catch(() => {})
    const active = pending
    pending = undefined
    if (active && !active.completed) await closePendingAuthorization(active)
    await registration.dispose()
  }
}
