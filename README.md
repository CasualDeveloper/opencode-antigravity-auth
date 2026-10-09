# Antigravity OAuth for OpenCode

An **OpenCode V2-only** plugin for Antigravity OAuth, Gemini and Claude models, multi-account quota rotation, and grounded Google Search.

This `beta` implementation is based on chrisgeo's upstream `main` commit [`fa05be9`](https://github.com/chrisgeo/opencode-antigravity-auth/commit/fa05be9d236fd40d4eb36abd44e6cf2bcd9ed72d). It replaces the existing plugin runtime rather than wrapping V1 behind a V2 adapter. There is no `src/v2` implementation or V1 package entrypoint.

> [!CAUTION]
> Using an unofficial OAuth client or proxy may violate Google's terms or lead to account restrictions. This plugin is not affiliated with Google or Anthropic. Use it at your own risk and avoid relying on a critical account.

## Local installation

Requires Node.js **22.22.2 or newer** and OpenCode V2. The native plugin contract is pinned to `@opencode/plugin` **2.0.22**.

1. Install dependencies and build:

   ```sh
   npm ci
   npm run build
   ```

2. Add the built directory to your OpenCode configuration:

   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": ["/absolute/path/to/opencode-antigravity-auth/dist"]
   }
   ```

3. Open **Connect an integration**, choose Google, and select **Google Antigravity**.

   OpenCode opens the authorization page. The plugin validates the OAuth state and detects the loopback callback automatically. On a remote/headless machine, or when the callback listener cannot start, the dialog asks for the full redirected localhost URL. Existing `antigravity-accounts.json` storage remains supported.

4. Choose a discovered Antigravity model and its variant in OpenCode.

The package identity remains `@chrisgeo/opencode-antigravity-auth`, but this rework has not been published to npm. Do not assume the public `latest` or `beta` tags contain it.

## Dynamic models and variants

Model **availability comes only from discovery**, not the bundled model metadata. At startup and after credential changes, the plugin fetches the Antigravity inventory.

- Successful refreshes replace the inventory, including an empty result. Retired models disappear.
- Failed refreshes retain the last discovered inventory. A cold start with no discovered inventory does not invent fallback models.
- Internal editor models are excluded. Equivalent backend aliases appear once.
- The picker shows one entry per model family. Advertised Low/Medium/High backend IDs become OpenCode variants, not separate models.
- Each grouped variant routes to its exact discovered backend ID. A bare/tiered endpoint is the default when advertised; otherwise the lowest advertised tier is the default.
- Advertised token limits take precedence over family defaults. Bundled metadata can enrich a discovered model but cannot make a retired model available.

For example, a discovered `google/antigravity-claude-opus-5-5` entry can expose `low`, `medium`, and `high` variants. Gemini 3.5 Flash's variants can use different backend names; routing follows discovery rather than assuming that the suffix matches the displayed tier.

Discovery proves that an account's inventory advertises a model. It does not guarantee available quota or a successful generation request.

## Authentication and routing

The account pool owns token refresh, quota state, cooldowns, fingerprints, and account rotation. A selected host OAuth account is preferred without bypassing quota or cooldown checks. SDK fetches resolve the current connection on each request, including when an SDK was cached before a credential switch.

The custom Google driver is limited to plugin-managed `antigravity-*` models. Other Google models keep their existing drivers. Model IDs are normalized for the Google SDK's capability checks and restored at the request boundary to preserve explicit Antigravity routing.

Gemini API keys and configured Cloud Projects remain supported as optional Gemini routes/fallbacks through the existing `agy_sdk` configuration. Claude and other Antigravity-only models require OAuth.

See [configuration](docs/CONFIGURATION.md), [multi-account usage](docs/MULTI-ACCOUNT.md), and [architecture](docs/ARCHITECTURE.md).

## Google Search

`google_search` is enabled by default. Its guidance prefers targeted webfetch/GitHub/API tools over broad grounded search. It supports `query`, optional `urls`, and the existing `thinking` option, defaulting to `true`. Execution respects tool cancellation and the search request timeout.

To disable it, put this in `antigravity.json`:

```json
{
  "google_search_enabled": false
}
```

Configuration is loaded from the plugin's OpenCode location, not the shared server's working directory. Project `.opencode/antigravity.json` can override global configuration. Disabling `model_discovery.enabled` removes plugin-managed models; it does not restore a static catalog.

## Runtime layout

| Module | Responsibility |
|---|---|
| `src/plugin.ts` | Native setup and event lifecycle |
| `src/plugin/auth.ts` | OAuth integration and credential resolution |
| `src/plugin/model-catalog.ts` | Discovery, model metadata, grouped variants |
| `src/google-provider.ts` | SDK hooks and active backend/credential routing |
| `src/plugin/transport.ts` | Existing quota, account rotation, retries, request pipeline |
| `src/plugin/request.ts` | Request/response transformation |
| `src/plugin/search.ts` | Grounded search executor and native tool |
| `src/plugin/recovery.ts` | Outgoing session context normalization and missing-tool recovery |

Session hooks repair the outgoing context without editing V1 session files. Token queues, listeners, hooks, and event subscriptions are cleaned up when the plugin unloads.

## Development

```sh
npm run check:native
npm run typecheck
npm test
npm run build
npm run verify:pack
```

`check:native` rejects V1 contracts and version-adapter trees. `verify:pack` installs the tarball in an isolated consumer and checks native Node ESM loading and NodeNext declarations. Builds clean `dist` so removed compatibility files cannot leak into the published artifact.

The release workflow files remain release tooling, not authorization to publish. Publishing the scoped package requires control of the `chrisgeo` npm scope and configured trusted publishing or a suitably restricted token.

## License

[MIT](LICENSE). Original work by NoeFabris and subsequent contributors; upstream maintenance by [chrisgeo](https://github.com/chrisgeo/opencode-antigravity-auth).
