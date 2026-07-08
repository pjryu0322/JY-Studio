import { loadMcpServerConfig, maskApiKey } from "./config.js";
import { toSafeLogError } from "./errors.js";
import { attachHttpSignalHandlers, startHttpServer } from "./http-server.js";
import { startStdioServer } from "./stdio-server.js";

export { createBridgeServer } from "./bridge.js";

async function main() {
  const config = loadMcpServerConfig();
  console.error(
    `[jykstore-mcp] starting transport=${config.transport} baseUrl=${config.baseUrl} apiKey=${maskApiKey(config.apiKey)}`,
  );

  if (config.transport === "http") {
    const started = await startHttpServer(config);
    attachHttpSignalHandlers(started.close);
  } else {
    await startStdioServer(config);
  }
}

main().catch((error) => {
  const safeError = toSafeLogError(error);
  console.error(
    `[jykstore-mcp] failed to start code=${safeError.code} message=${safeError.message}`,
  );
  process.exit(1);
});
