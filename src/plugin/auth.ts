import type { Plugin } from "@opencode/plugin"
import type { IntegrationOAuthAuthorization } from "@opencode/plugin/promise/integration"
import type { Credential } from "@opencode/schema/credential"
import { Integration } from "@opencode/schema/integration"
import { authorizeAntigravity, exchangeAntigravity } from "../antigravity/oauth"
import { persistAccountPool } from "./persist-account-pool"
import { oauthAuthFromDisk, reconcileOAuthAuth } from "./oauth-auth-from-disk"
import { shouldUseManualOAuthCallback, startOAuthListener, type OAuthListener } from "./server"
import type { AuthDetails, OAuthAuthDetails, RefreshParts } from "./types";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export function isOAuthAuth(auth: AuthDetails): auth is OAuthAuthDetails {
  return auth.type === "oauth";
}

/**
 * Splits a packed refresh string into its constituent refresh token and project IDs.
 */
export function parseRefreshParts(refresh: string): RefreshParts {
  const [refreshToken = "", projectId = "", managedProjectId = ""] = (refresh ?? "").split("|");
  return {
    refreshToken,
    projectId: projectId || undefined,
    managedProjectId: managedProjectId || undefined,
  };
}

/**
 * Serializes refresh token parts into the stored string format.
 */
export function formatRefreshParts(parts: RefreshParts): string {
  const projectSegment = parts.projectId ?? "";
  const base = `${parts.refreshToken}|${projectSegment}`;
  return parts.managedProjectId ? `${base}|${parts.managedProjectId}` : base;
}

/**
 * Determines whether an access token is expired or missing, with buffer for clock skew.
 */
export function accessTokenExpired(auth: OAuthAuthDetails): boolean {
  if (!auth.access || typeof auth.expires !== "number") {
    return true;
  }
  return auth.expires <= Date.now() + ACCESS_TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Calculates absolute expiry timestamp based on a duration.
 * @param requestTimeMs The local time when the request was initiated
 * @param expiresInSeconds The duration returned by the server
 */
export function calculateTokenExpiry(requestTimeMs: number, expiresInSeconds: unknown): number {
  const seconds = typeof expiresInSeconds === "number" ? expiresInSeconds : 3600;
  // Safety check for bad data - if it's not a positive number, treat as immediately expired
  if (isNaN(seconds) || seconds <= 0) {
    return requestTimeMs;
  }
  return requestTimeMs + seconds * 1000;
}

export async function resolveAuth(
  context: Pick<Plugin.Context, "integration">,
): Promise<AuthDetails> {
  const connection = await context.integration.connection.active("google")
  if (!connection) return await oauthAuthFromDisk() ?? { type: "none" }

  const credential = await context.integration.connection.resolve(connection)
  if (!credential) return await oauthAuthFromDisk() ?? { type: "none" }
  if (credential.type === "oauth" && credential.methodID === "antigravity") {
    return reconcileOAuthAuth({
      type: "oauth",
      refresh: credential.refresh,
      access: credential.access,
      expires: credential.expires,
    }, typeof credential.metadata?.email === "string" ? credential.metadata.email : undefined)
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

export const ANTIGRAVITY_INTEGRATION_ID: Integration.ID = Integration.ID.make("google")
export const ANTIGRAVITY_METHOD_ID: Integration.MethodID = Integration.MethodID.make("antigravity")
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
      // The account pool owns refresh and invalid_grant rotation. Refreshing
      // here would fail host model resolution before another account can run.
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
