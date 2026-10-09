import { afterEach, describe, expect, it } from "vitest";

import {
  shouldUseManualOAuthCallback,
  startOAuthListener,
  type OAuthListener,
} from "./server";

const listeners: OAuthListener[] = [];

async function startListener(expectedState = "expected-state"): Promise<OAuthListener> {
  const listener = await startOAuthListener({
    bindAddress: "127.0.0.1",
    expectedState,
    redirectUri: "http://127.0.0.1:0/oauth-callback",
    timeoutMs: 2_000,
  });
  listeners.push(listener);
  return listener;
}

function callbackUrl(listener: OAuthListener, search: string): URL {
  const url = new URL(listener.callbackUrl);
  url.search = search;
  return url;
}

afterEach(async () => {
  await Promise.all(listeners.splice(0).map((listener) => listener.close().catch(() => {})));
});

describe("OAuth callback listener", () => {
  it("uses the manual flow when OpenCode is explicitly headless", () => {
    const previous = process.env.OPENCODE_HEADLESS;
    process.env.OPENCODE_HEADLESS = "1";
    try {
      expect(shouldUseManualOAuthCallback()).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.OPENCODE_HEADLESS;
      else process.env.OPENCODE_HEADLESS = previous;
    }
  });

  it("rejects invalid requests without consuming the pending callback", async () => {
    const listener = await startListener();
    const callback = listener.waitForCallback();
    let settled = false;
    void callback.then(
      () => { settled = true; },
      () => { settled = true; },
    );

    const wrongPath = new URL("/not-oauth", listener.callbackUrl);
    expect((await fetch(wrongPath)).status).toBe(404);

    const wrongMethod = await fetch(listener.callbackUrl, { method: "POST" });
    expect(wrongMethod.status).toBe(405);

    const wrongState = await fetch(callbackUrl(
      listener,
      "?code=attacker-code&state=wrong-state",
    ));
    expect(wrongState.status).toBe(400);
    expect(wrongState.headers.get("cache-control")).toBe("no-store");

    const missingResult = await fetch(callbackUrl(listener, "?state=expected-state"));
    expect(missingResult.status).toBe(400);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    const valid = await fetch(callbackUrl(
      listener,
      "?code=authorization-code&state=expected-state",
    ));
    expect(valid.status).toBe(200);
    expect(await valid.text()).toContain("Authorization received");

    const captured = await callback;
    expect(captured.searchParams.get("code")).toBe("authorization-code");
    expect(captured.searchParams.get("state")).toBe("expected-state");
  });

  it("captures a state-bound OAuth denial and shows an accurate response", async () => {
    const listener = await startListener();
    const callback = listener.waitForCallback();

    const response = await fetch(callbackUrl(
      listener,
      "?error=access_denied&error_description=User+cancelled&state=expected-state",
    ));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Sign-in was not completed");
    const captured = await callback;
    expect(captured.searchParams.get("error")).toBe("access_denied");
  });

  it("rejects a pending callback when explicitly closed", async () => {
    const listener = await startListener();
    const callback = expect(listener.waitForCallback()).rejects.toThrow(
      "OAuth listener closed before callback",
    );

    await listener.close();

    await callback;
  });

  it("fails cleanly when the callback port is already occupied", async () => {
    const listener = await startListener();

    await expect(startOAuthListener({
      bindAddress: "127.0.0.1",
      expectedState: "second-state",
      redirectUri: listener.callbackUrl,
      timeoutMs: 2_000,
    })).rejects.toThrow("already in use");
  });
});
