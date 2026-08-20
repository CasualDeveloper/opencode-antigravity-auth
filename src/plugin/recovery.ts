export type RecoveryErrorType =
  | "tool_result_missing"
  | "thinking_block_order"
  | "thinking_disabled_violation"
  | null

function getErrorMessage(error: unknown): string {
  if (!error) return ""
  if (typeof error === "string") return error.toLowerCase()

  const errorObject = error as Record<string, unknown>
  const candidates = [
    errorObject.data,
    errorObject.error,
    errorObject,
    (errorObject.data as Record<string, unknown>)?.error,
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const message = (candidate as Record<string, unknown>).message
    if (typeof message === "string" && message.length > 0) return message.toLowerCase()
  }

  try {
    return JSON.stringify(error).toLowerCase()
  } catch {
    return ""
  }
}

export function detectErrorType(error: unknown): RecoveryErrorType {
  const message = getErrorMessage(error)
  const hasExpectedFoundThinkingOrder =
    (message.includes("expected thinking") || message.includes("expected a thinking"))
    && message.includes("found")

  if (message.includes("tool_use") && message.includes("tool_result")) {
    return "tool_result_missing"
  }

  if (
    message.includes("thinking")
    && (
      message.includes("first block")
      || message.includes("must start with")
      || message.includes("preceeding")
      || message.includes("preceding")
      || hasExpectedFoundThinkingOrder
    )
  ) {
    return "thinking_block_order"
  }

  if (message.includes("thinking is disabled") && message.includes("cannot contain")) {
    return "thinking_disabled_violation"
  }

  return null
}

export function isRecoverableError(error: unknown): boolean {
  return detectErrorType(error) !== null
}
