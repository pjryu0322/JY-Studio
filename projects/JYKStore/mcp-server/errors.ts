export type JYKStoreMcpError = {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  hint?: string;
};

export class McpBridgeError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly hint?: string;

  constructor(error: JYKStoreMcpError) {
    super(error.message);
    this.name = "McpBridgeError";
    this.code = error.code;
    this.status = error.status;
    this.requestId = error.requestId;
    this.details = error.details;
    this.hint = error.hint;
  }

  toJSON(): JYKStoreMcpError {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
      details: this.details,
      hint: this.hint,
    };
  }
}

export function mcpError(
  code: string,
  message: string,
  extra?: Partial<Omit<JYKStoreMcpError, "code" | "message">>,
): McpBridgeError {
  return new McpBridgeError({ code, message, ...extra });
}

export function formatToolError(error: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  if (error instanceof McpBridgeError) {
    return {
      content: [{ type: "text", text: JSON.stringify(error.toJSON(), null, 2) }],
      isError: true,
    };
  }
  const message = error instanceof Error ? error.message : "Unknown MCP bridge error";
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            code: "JYKSTORE_MCP_INTERNAL_ERROR",
            message,
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

export type SafeLogError = {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
};

/** Mask common secrets and truncate for operational logs. */
export function sanitizeLogMessage(message: string): string {
  return message
    .replace(/Bearer\s+[^\s]+/gi, "Bearer ***")
    .replace(/JYKSTORE_API_KEY=\S+/gi, "JYKSTORE_API_KEY=***")
    .replace(/DATABASE_URL=\S+/gi, "DATABASE_URL=***")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://***")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-***")
    .slice(0, 300);
}

/**
 * Narrow unknown errors to safe log fields only.
 * Never includes details, bodies, headers, tokens, or stacks.
 */
export function toSafeLogError(error: unknown): SafeLogError {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const rawMessage =
      typeof record.message === "string"
        ? record.message
        : error instanceof Error
          ? error.message
          : "Unexpected MCP error.";
    return {
      code: typeof record.code === "string" ? record.code : "JYKSTORE_MCP_INTERNAL_ERROR",
      message: sanitizeLogMessage(rawMessage),
      status: typeof record.status === "number" ? record.status : undefined,
      requestId: typeof record.requestId === "string" ? record.requestId : undefined,
    };
  }

  return {
    code: "JYKSTORE_MCP_INTERNAL_ERROR",
    message: sanitizeLogMessage(
      typeof error === "string" ? error : "Unexpected MCP error.",
    ),
  };
}
