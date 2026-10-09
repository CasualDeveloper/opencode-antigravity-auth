# Troubleshooting

This package targets OpenCode V2 only. Keep private account storage, tokens, authorization URLs, prompts, and logs out of public issues.

## Plugin fails to load

Confirm Node.js is at least 22.22.2, install the locked dependencies, and rebuild:

```sh
npm ci
npm run check:native
npm run build
```

The OpenCode `plugins` entry must point to the built `dist` directory. There is no V1 `server`/`v1` export and no `src/v2` adapter. A missing `context.provider` or `context.model` indicates an incompatible host plugin API; do not mask it by installing old V1 dependencies.

Use the host plugin status dialog to confirm `opencode.provider.antigravity` is active. If a local rebuild has not reloaded, restart the OpenCode service and check status again.

## No models or a retired model disappeared

Availability is discovery-only. Sign in through **Connect an integration → Google → Google Antigravity**, keep `model_discovery.enabled` and `model_discovery.antigravity` enabled, and confirm the account can reach the Antigravity discovery endpoint.

If discovery succeeds with an empty list, plugin-managed models disappear. If it fails, the last discovered inventory is retained, but a cold start has no static fallback. A model being absent from a successful inventory is not fixed by restoring an old static configuration.

The picker contains one entry per family; choose Low/Medium/High through variants. Backend aliases and their displayed version numbers can differ. Do not rename a backend ID by guessing its public model name.

## Sign-in does not complete

Complete Google authorization in the browser. The loopback listener uses port 51121 and validates the OAuth state. In a headless/remote environment or when the listener cannot start, paste the complete redirected localhost URL into the host dialog. Do not paste another attempt's URL or disclose it in an issue.

Repeat sign-in if Google revoked the selected credential. Token refresh is owned by the account pool so normal requests can rotate to another usable account. Do not delete the account file as a routine reset: it contains the other accounts and their persisted state.

## Rate limits or quota exhaustion

The transport rotates accounts and observes cooldowns. When all usable accounts are blocked, wait for reset or connect another account. Public Gemini API keys cannot serve Claude or other Antigravity-only models. Explicit Antigravity routing retains its existing quota semantics.

## Search stalls or cancellation

`google_search` uses a separate grounded request with a request timeout and the host tool's cancellation signal. Confirm the selected OAuth account and project are usable. Disable the tool with `google_search_enabled: false` if only targeted web/API tools are desired.

## Reporting a problem

Include the host version, package commit, sanitized plugin status/error, model family and variant, and the smallest reproduction. Mention whether the failure happens during discovery, OAuth, or generation. Never attach `antigravity-accounts.json` or unredacted request/response logs.
