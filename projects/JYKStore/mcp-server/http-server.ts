import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isOriginAllowed } from "./cors.js";
import type { McpServerConfig } from "./config.js";
import { createBridgeServer } from "./bridge.js";
import { toSafeLogError } from "./errors.js";
import { JYKStoreClient } from "./jykstore-client.js";

export type StartedMcpHttpServer = {
  port: number;
  close: () => Promise<void>;
};

function requestPath(url: string | undefined): string {
  if (!url) return "/";
  try {
    return new URL(url, "http://127.0.0.1").pathname;
  } catch {
    return url.split("?")[0] || "/";
  }
}

function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[],
): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!isOriginAllowed(origin, allowedOrigins)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        code: "JYKSTORE_MCP_ORIGIN_NOT_ALLOWED",
        message: "Origin is not allowed by JYKSTORE_MCP_ALLOWED_ORIGINS.",
      }),
    );
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  return true;
}

function logHttpRequest(input: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId?: string;
}) {
  const requestIdPart = input.requestId ? ` requestId=${input.requestId}` : "";
  console.error(
    `[jykstore-mcp] ${input.method} ${input.path} status=${input.status} durationMs=${input.durationMs}${requestIdPart}`,
  );
}

export async function startHttpServer(
  config: McpServerConfig,
  options?: { createBridge?: typeof createBridgeServer },
): Promise<StartedMcpHttpServer> {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const createBridge = options?.createBridge ?? createBridgeServer;

  const httpServer = createServer(async (req, res) => {
    const startedAt = Date.now();
    const method = req.method ?? "GET";
    const path = requestPath(req.url);
    let statusLogged = false;

    const finishLog = (status: number) => {
      if (statusLogged) return;
      statusLogged = true;
      const requestIdHeader = req.headers["x-request-id"];
      const requestId =
        typeof requestIdHeader === "string"
          ? requestIdHeader
          : Array.isArray(requestIdHeader)
            ? requestIdHeader[0]
            : undefined;
      logHttpRequest({
        method,
        path,
        status,
        durationMs: Date.now() - startedAt,
        requestId,
      });
    };

    res.on("finish", () => finishLog(res.statusCode));

    if (!applyCors(req, res, config.allowedOrigins)) {
      return;
    }

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === "GET" && path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "jykstore-mcp-bridge",
          transport: "http",
        }),
      );
      return;
    }

    if (method === "GET" && path === "/ready") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "jykstore-mcp-bridge",
          baseUrl: config.baseUrl,
          apiKeyConfigured: Boolean(config.apiKey),
          allowedPackIdsConfigured: config.allowedPackIds.length > 0,
        }),
      );
      return;
    }

    let mcp: McpServer | undefined;
    try {
      const client = new JYKStoreClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        maxResponseBytes: config.maxResponseBytes,
        maxExportSourceBytes: config.maxExportSourceBytes,
        allowedPackIds: config.allowedPackIds,
      });
      mcp = createBridge(client, config.allowedPackIds);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        void transport.close();
        void mcp?.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      const safeError = toSafeLogError(error);
      console.error(
        `[jykstore-mcp] HTTP request failed code=${safeError.code} status=${safeError.status ?? "-"} requestId=${safeError.requestId ?? "-"} message=${safeError.message}`,
      );
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: "JYKSTORE_MCP_INTERNAL_ERROR",
            message: "HTTP transport error",
          }),
        );
      }
      void mcp?.close();
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(config.port, () => resolve());
  });

  const address = httpServer.address();
  const boundPort =
    address && typeof address === "object" ? address.port : config.port;
  console.error(`[jykstore-mcp] HTTP transport listening on :${boundPort}`);

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  };

  return { port: boundPort, close };
}

export function attachHttpSignalHandlers(close: () => Promise<void>): void {
  const shutdown = (signal: string) => {
    console.error(`[jykstore-mcp] received ${signal}, shutting down HTTP transport`);
    void close()
      .then(() => process.exit(0))
      .catch((error) => {
        const safeError = toSafeLogError(error);
        console.error(
          `[jykstore-mcp] shutdown failed code=${safeError.code} message=${safeError.message}`,
        );
        process.exit(1);
      });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
