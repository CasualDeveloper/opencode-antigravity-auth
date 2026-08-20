import { beforeEach, describe, expect, it, vi } from "vitest";

import { AntigravityTokenRefreshError, refreshAccessToken } from "./token";
import type { OAuthAuthDetails } from "./types";

const baseAuth: OAuthAuthDetails = {
  type: "oauth",
  refresh: "refresh-token|project-123",
  access: "old-access",
  expires: Date.now() - 1000,
};

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates the caller when refresh token is unchanged", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: "new-access",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshAccessToken(baseAuth);

    expect(result?.access).toBe("new-access");
  });

  it("handles Google refresh token rotation", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: "next-access",
          expires_in: 3600,
          refresh_token: "rotated-token",
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshAccessToken(baseAuth);

    expect(result?.access).toBe("next-access");
    expect(result?.refresh).toContain("rotated-token");
  });

  it("throws a typed error on invalid_grant", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token revoked",
        }),
        { status: 400, statusText: "Bad Request" },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(refreshAccessToken(baseAuth)).rejects.toMatchObject({
      name: "AntigravityTokenRefreshError",
      code: "invalid_grant",
    });
  });
});
