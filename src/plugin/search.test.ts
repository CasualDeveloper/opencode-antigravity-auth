import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSearch } from "./search";
import { recordAntigravityAvailableModels, resetAntigravityModelCatalogForTests } from "./model-catalog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(
  text: string,
  opts: {
    searchQueries?: string[];
    chunks?: Array<{ title: string; uri: string }>;
    urlMetadata?: Array<{ retrieved_url: string; url_retrieval_status: string }>;
  } = {},
) {
  return {
    response: {
      candidates: [
        {
          content: { role: "model", parts: [{ text }] },
          finishReason: "STOP",
          groundingMetadata: {
            webSearchQueries: opts.searchQueries ?? [],
            groundingChunks: (opts.chunks ?? []).map((c) => ({ web: c })),
          },
          urlContextMetadata: { url_metadata: opts.urlMetadata ?? [] },
        },
      ],
    },
  };
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ─── executeSearch ────────────────────────────────────────────────────────────

describe("executeSearch", () => {
  beforeEach(() => {
    recordAntigravityAvailableModels({
      models: { "search-route": {} }, webSearchModelIds: ["search-route"],
    }, { projectId: "proj", accessToken: "tok" });
    vi.stubGlobal("fetch", mockFetch(makeResponse("Default result")));
  });

  afterEach(() => {
    resetAntigravityModelCatalogForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns formatted text from the response", async () => {
    vi.stubGlobal("fetch", mockFetch(makeResponse("The answer is 42.")));
    const result = await executeSearch({ query: "what is 42?" }, "tok", "proj");
    expect(result).toContain("The answer is 42.");
    expect(result).toContain("## Search Results");
  });

  it("lists sources from groundingChunks (uses groundingMeta internally)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeResponse("answer", {
          chunks: [{ title: "Example", uri: "https://example.com/page" }],
        }),
      ),
    );
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("### Sources");
    expect(result).toContain("Example");
    expect(result).toContain("https://example.com/page");
  });

  it("includes search queries section when queries are present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(makeResponse("res", { searchQueries: ["my query"] })),
    );
    const result = await executeSearch({ query: "my query" }, "tok", "proj");
    expect(result).toContain("### Search Queries Used");
    expect(result).toContain('"my query"');
  });

  it("marks successful URL retrieval with ✓", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeResponse("ok", {
          urlMetadata: [
            { retrieved_url: "https://docs.example.com", url_retrieval_status: "URL_RETRIEVAL_STATUS_SUCCESS" },
          ],
        }),
      ),
    );
    const result = await executeSearch({ query: "q", urls: ["https://docs.example.com"] }, "tok", "proj");
    expect(result).toContain("✓");
    expect(result).toContain("https://docs.example.com");
  });

  it("marks failed URL retrieval with ✗", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeResponse("ok", {
          urlMetadata: [
            { retrieved_url: "https://broken.example.com", url_retrieval_status: "URL_RETRIEVAL_STATUS_ERROR" },
          ],
        }),
      ),
    );
    const result = await executeSearch({ query: "q", urls: ["https://broken.example.com"] }, "tok", "proj");
    expect(result).toContain("✗");
  });

  it("returns error block on non-OK HTTP response", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "bad" }, 400));
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("## Search Error");
    expect(result).toContain("400");
  });

  it("returns error block when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("## Search Error");
    expect(result).toContain("Network down");
  });

  it("includes Authorization header with the provided token", async () => {
    const spy = mockFetch(makeResponse("ok"));
    vi.stubGlobal("fetch", spy);
    await executeSearch({ query: "q" }, "tok", "proj");
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok",
    );
    expect(JSON.parse(String(init.body)).model).toBe("search-route");
  });

  it.each([["other-token", "proj"], ["tok", "other-project"]])("discovers the search route on a scope change", async (token, project) => {
    const spy = mockFetch(makeResponse("ok")).mockResolvedValueOnce(new Response(JSON.stringify({
      models: { "new-route": {} }, webSearchModelIds: ["removed-route", "new-route"],
    })));
    vi.stubGlobal("fetch", spy);
    await executeSearch({ query: "q" }, token, project);
    await executeSearch({ query: "second" }, token, project);
    expect(spy.mock.calls).toHaveLength(3);
    expect(spy.mock.calls[0]?.[0]).toContain("fetchAvailableModels");
    for (const [, init] of spy.mock.calls.slice(1)) {
      expect(JSON.parse(init.body)).toMatchObject({ project, model: "new-route" });
    }
  });

  it("does not send the query when discovery advertises no search route", async () => {
    const spy = mockFetch({ models: { "chat-only": {} }, webSearchModelIds: [] });
    vi.stubGlobal("fetch", spy);
    expect(await executeSearch({ query: "q" }, "other-token", "proj")).toContain("Search Unavailable");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain("fetchAvailableModels");
  });
});
