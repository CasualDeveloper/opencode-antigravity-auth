import type { Plugin } from "@opencode/plugin"
import { z } from "zod"
import { accessTokenExpired, parseRefreshParts, resolveOAuthAuth } from "./auth"
import { AccountManager } from "./accounts"
import { ensureProjectContext } from "./project"
import { refreshAccessToken } from "./token"
/**
 * Google Search Tool Implementation
 *
 * Due to Gemini API limitations, native search tools (googleSearch, urlContext)
 * cannot be combined with function declarations. This module implements a
 * wrapper that makes separate API calls with only the grounding tools enabled.
 */

import {
  ANTIGRAVITY_ENDPOINT,
  getAntigravityHeaders,
  SEARCH_MODEL,
  SEARCH_TIMEOUT_MS,
  SEARCH_SYSTEM_INSTRUCTION,
} from "../constants";
import { createLogger } from "./logger";

const log = createLogger("search");

// ============================================================================
// Types
// ============================================================================

interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GroundingSupport {
  segment?: {
    startIndex?: number;
    endIndex?: number;
    text?: string;
  };
  groundingChunkIndices?: number[];
}

interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  searchEntryPoint?: {
    renderedContent?: string;
  };
}

interface UrlMetadata {
  retrieved_url?: string;
  url_retrieval_status?: string;
}

interface UrlContextMetadata {
  url_metadata?: UrlMetadata[];
}

interface SearchResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
    finishReason?: string;
    groundingMetadata?: GroundingMetadata;
    urlContextMetadata?: UrlContextMetadata;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface AntigravitySearchResponse {
  response?: SearchResponse;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface SearchArgs {
  query: string;
  urls?: string[];
  thinking?: boolean;
}

export interface SearchResult {
  text: string;
  sources: Array<{ title: string; url: string }>;
  searchQueries: string[];
  urlsRetrieved: Array<{ url: string; status: string }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

let sessionCounter = 0;
const sessionPrefix = `search-${Date.now().toString(36)}`;

function generateRequestId(): string {
  return `search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSessionId(): string {
  sessionCounter++;
  return `${sessionPrefix}-${sessionCounter}`;
}

function formatSearchResult(result: SearchResult): string {
  const lines: string[] = [];

  lines.push("## Search Results\n");
  lines.push(result.text);
  lines.push("");

  if (result.sources.length > 0) {
    lines.push("### Sources");
    for (const source of result.sources) {
      lines.push(`- [${source.title}](${source.url})`);
    }
    lines.push("");
  }

  if (result.urlsRetrieved.length > 0) {
    lines.push("### URLs Retrieved");
    for (const url of result.urlsRetrieved) {
      const status = url.status === "URL_RETRIEVAL_STATUS_SUCCESS" ? "✓" : "✗";
      lines.push(`- ${status} ${url.url}`);
    }
    lines.push("");
  }

  if (result.searchQueries.length > 0) {
    lines.push("### Search Queries Used");
    for (const q of result.searchQueries) {
      lines.push(`- "${q}"`);
    }
  }

  return lines.join("\n");
}

function parseSearchResponse(data: AntigravitySearchResponse): SearchResult {
  const result: SearchResult = {
    text: "",
    sources: [],
    searchQueries: [],
    urlsRetrieved: [],
  };

  const response = data.response;
  if (!response || !response.candidates || response.candidates.length === 0) {
    if (data.error) {
      result.text = `Error: ${data.error.message ?? "Unknown error"}`;
    } else if (response?.error) {
      result.text = `Error: ${response.error.message ?? "Unknown error"}`;
    }
    return result;
  }

  const candidate = response.candidates[0];
  if (!candidate) {
    return result;
  }

  // Extract text content
  if (candidate.content?.parts) {
    result.text = candidate.content.parts
      .map((p: { text?: string }) => p.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  // Extract grounding metadata
  if (candidate.groundingMetadata) {
    const groundingMeta = candidate.groundingMetadata;

    if (groundingMeta.webSearchQueries) {
      result.searchQueries = groundingMeta.webSearchQueries;
    }

    if (groundingMeta.groundingChunks) {
      for (const chunk of groundingMeta.groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          result.sources.push({
            title: chunk.web.title,
            url: chunk.web.uri,
          });
        }
      }
    }
  }

  // Extract URL context metadata
  if (candidate.urlContextMetadata?.url_metadata) {
    for (const meta of candidate.urlContextMetadata.url_metadata) {
      if (meta.retrieved_url) {
        result.urlsRetrieved.push({
          url: meta.retrieved_url,
          status: meta.url_retrieval_status ?? "UNKNOWN",
        });
      }
    }
  }

  return result;
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Execute a Google Search using the Gemini grounding API.
 *
 * This makes a SEPARATE API call with only googleSearch/urlContext tools,
 * which is required because these tools cannot be combined with function declarations.
 */
export async function executeSearch(
  args: SearchArgs,
  accessToken: string,
  projectId: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const { query, urls, thinking = true } = args;

  // Build prompt with optional URLs
  let prompt = query;
  if (urls && urls.length > 0) {
    const urlList = urls.join("\n");
    prompt = `${query}\n\nURLs to analyze:\n${urlList}`;
  }

  // Build tools array - only grounding tools, no function declarations
  const tools: Array<Record<string, unknown>> = [];
  tools.push({ googleSearch: {} });
  if (urls && urls.length > 0) {
    tools.push({ urlContext: {} });
  }

  const requestPayload = {
    systemInstruction: {
      parts: [{ text: SEARCH_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    tools,
    generationConfig: {
      temperature: 0,
      topP: 1,
    },
  };

  // Wrap in Antigravity format
  const wrappedBody = {
    project: projectId,
    model: SEARCH_MODEL,
    userAgent: "antigravity",
    requestId: generateRequestId(),
    request: {
      ...requestPayload,
      sessionId: getSessionId(),
    },
  };

  // Use non-streaming endpoint for search
  const url = `${ANTIGRAVITY_ENDPOINT}/v1internal:generateContent`;

  log.debug("Executing search", {
    query,
    urlCount: urls?.length ?? 0,
    thinking,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getAntigravityHeaders(),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wrappedBody),
      signal: abortSignal
        ? AbortSignal.any([abortSignal, AbortSignal.timeout(SEARCH_TIMEOUT_MS)])
        : AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.debug("Search API error", { status: response.status, error: errorText });
      return `## Search Error\n\nFailed to execute search: ${response.status} ${response.statusText}\n\n${errorText}\n\nPlease try again with a different query.`;
    }

    const data = (await response.json()) as AntigravitySearchResponse;
    log.debug("Search response received", { hasResponse: !!data.response });

    const result = parseSearchResponse(data);
    const formatted = formatSearchResult(result);
    log.debug("Search response formatted", { resultLength: formatted.length });
    return formatted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.debug("Search execution error", { error: message });
    return `## Search Error\n\nFailed to execute search: ${message}. Please try again with a different query.`;
  }
}

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
      execute: async (input, toolContext) => {
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
          toolContext.signal,
        )
        return { output, content: output }
      },
    })
  })
}
