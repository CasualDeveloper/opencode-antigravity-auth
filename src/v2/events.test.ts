import type { Plugin } from "@opencode-ai/plugin"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  onSessionCreated: vi.fn(),
  createChecker: vi.fn(),
}))

vi.mock("../hooks/auto-update-checker", () => ({
  createAutoUpdateChecker: mocks.createChecker,
}))

import type { AntigravityConfig } from "../plugin/config"
import { registerLifecycleEvents } from "./events"

describe("v2 lifecycle events", () => {
  it("forwards V2 session creation and disposes the iterator", async () => {
    mocks.createChecker.mockReturnValue({ onSessionCreated: mocks.onSessionCreated })
    let resolveNext: ((result: IteratorResult<unknown>) => void) | undefined
    const iterator = {
      next: vi.fn(() => new Promise<IteratorResult<unknown>>((resolve) => {
        resolveNext = resolve
      })),
      return: vi.fn(async () => ({ done: true, value: undefined })),
    }
    const context = {
      event: {
        subscribe: () => ({
          [Symbol.asyncIterator]: () => iterator,
        }),
      },
    }

    const cleanup = await registerLifecycleEvents(
      context as unknown as Pick<Plugin.Context, "event">,
      { auto_update: true } as AntigravityConfig,
    )
    if (!resolveNext) throw new Error("Event subscription did not start")
    resolveNext({
      done: false,
      value: {
        type: "session.created",
        data: { id: "session-1" },
      },
    })

    await vi.waitFor(() => {
      expect(mocks.onSessionCreated).toHaveBeenCalledWith({ id: "session-1" })
    })
    await cleanup()
    expect(iterator.return).toHaveBeenCalledOnce()
  })
})
