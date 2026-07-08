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
