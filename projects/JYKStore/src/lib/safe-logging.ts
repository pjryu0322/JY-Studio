export type SafeLogError = {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
};

/** Mask common secrets and truncate for operational logs. */
export function sanitizeLogMessage(message: string): string {
  return message
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer ***")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer ***")
    .replace(/JYKSTORE_API_KEY=\S+/gi, "JYKSTORE_API_KEY=***")
    .replace(/JYKSTORE_ADMIN_OPS_TOKEN=\S+/gi, "JYKSTORE_ADMIN_OPS_TOKEN=***")
    .replace(/\bjyk_(?:live|test)_[A-Za-z0-9]+/gi, "jyk_***")
    .replace(/rawKey=\S+/gi, "rawKey=***")
    .replace(/plainKey=\S+/gi, "plainKey=***")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://***")
    .replace(/DATABASE_URL=\S+/gi, "DATABASE_URL=***")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-***")
    .slice(0, 300);
}

/**
 * Narrow unknown errors to safe log fields only.
 * Never includes details, bodies, headers, tokens, or stacks.
 */
export function toSafeLogError(
  error: unknown,
  options?: { defaultCode?: string; defaultMessage?: string },
): SafeLogError {
  const defaultCode = options?.defaultCode ?? "INTERNAL_SERVER_ERROR";
  const defaultMessage = options?.defaultMessage ?? "Unexpected error.";

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const rawMessage =
      typeof record.message === "string"
        ? record.message
        : error instanceof Error
          ? error.message
          : defaultMessage;

    return {
      code: typeof record.code === "string" ? record.code : defaultCode,
      message: sanitizeLogMessage(rawMessage),
      status: typeof record.status === "number" ? record.status : undefined,
      requestId: typeof record.requestId === "string" ? record.requestId : undefined,
    };
  }

  return {
    code: defaultCode,
    message: sanitizeLogMessage(typeof error === "string" ? error : defaultMessage),
  };
}

/**
 * Log a route failure without attaching the raw error object.
 */
export function logSafeRouteError(input: {
  scope: string;
  method: string;
  path: string;
  requestId?: string;
  error: unknown;
}): void {
  const safeError = toSafeLogError(input.error);
  console.error(
    `[jykstore-api] scope=${input.scope} method=${input.method} path=${input.path} status=${safeError.status ?? "-"} requestId=${safeError.requestId ?? input.requestId ?? "-"} code=${safeError.code} message=${safeError.message}`,
  );
}
