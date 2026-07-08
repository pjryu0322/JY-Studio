import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServerConfig } from "./config.js";
import { createBridgeServer } from "./bridge.js";
import { JYKStoreClient } from "./jykstore-client.js";

export async function startStdioServer(config: McpServerConfig): Promise<void> {
  const client = new JYKStoreClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
    maxResponseBytes: config.maxResponseBytes,
    maxExportSourceBytes: config.maxExportSourceBytes,
    allowedPackIds: config.allowedPackIds,
  });
  const server = createBridgeServer(client, config.allowedPackIds);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
