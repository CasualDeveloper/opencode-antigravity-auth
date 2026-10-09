# Multi-account usage

Use OpenCode V2's **Connect an integration** dialog and select Google → **Google Antigravity**. Repeat sign-in to add another Google account. Successful OAuth exchanges are merged into `antigravity-accounts.json`, preserving existing account quota, cooldown, and fingerprint state.

The selected host credential is the preferred account when a request pipeline is created. Account selection still respects disabled accounts, per-model quota, and cooldowns. When a cached SDK survives a host credential switch, subsequent requests select the new credential's pipeline.

## Storage

Account refresh tokens, project IDs, fingerprints, and quota state remain in the existing global account file. Do not share this file or paste it into an issue. Keep a private backup before intentionally changing account storage.

The account pool reconciles disk changes without replacing pending in-memory writes. Token rotation preserves account identity and quota state; revoked accounts are removed from the usable pool by the transport's refresh/rotation handling.

## Quota handling

- Rate-limited accounts rotate according to `account_selection_strategy`.
- Per-model cooldowns avoid repeatedly selecting a blocked account.
- Gemini can use the existing Antigravity/Gemini CLI quota routing and optional configured API-key fallback where permitted.
- Explicit `antigravity-*` routing retains its existing quota semantics.
- Claude and other Antigravity-only models cannot be served by a public Gemini API key.

See [configuration](CONFIGURATION.md) for account selection, soft-quota thresholds, proactive refresh, and API-key settings.

## Model discovery

The catalog refreshes at startup and after credential updates or a Google credential switch. Successful discovery replaces the inventory and removes retired models. It groups advertised thinking tiers into variants and deduplicates aliases; model availability is not supplied by static definitions.

The V1 terminal login/account-management menu is not included in this V2-only package. Use the host integration dialog for sign-in instead.
