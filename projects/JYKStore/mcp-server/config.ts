import { mcpError } from "./errors.js";

export type McpTransport = "stdio" | "http";

export type McpServerConfig = {
  baseUrl: string;
  apiKey: string;
  transport: McpTransport;
  port: number;
  allowedPackIds: string[];
  timeoutMs: number;
  maxResponseBytes: number;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseAllowedPackIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  ];
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "***";
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}

export function loadMcpServerConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv,
): McpServerConfig {
  const baseUrl = (env.JYKSTORE_BASE_URL ?? env.JYKSTORE_API_BASE_URL)?.trim();
  const apiKey = env.JYKSTORE_API_KEY?.trim();

  if (!baseUrl) {
    throw mcpError(
      "JYKSTORE_MCP_CONFIG_MISSING",
      "JYKSTORE_BASE_URL is required (example: http://localhost:3004).",
    );
  }
  if (!apiKey) {
    throw mcpError(
      "JYKSTORE_MCP_CONFIG_MISSING",
      "JYKSTORE_API_KEY is required (Bearer API key with context:read scope).",
    );
  }

  const transportArg = argv.find((arg) => arg.startsWith("--transport="))?.split("=")[1];
  const transportFlagIndex = argv.indexOf("--transport");
  const transportFlagValue =
    transportFlagIndex >= 0 ? argv[transportFlagIndex + 1] : undefined;
  const transportRaw = (
    transportArg ??
    transportFlagValue ??
    env.JYKSTORE_MCP_TRANSPORT ??
    "stdio"
  )
    .trim()
    .toLowerCase();

  if (transportRaw !== "stdio" && transportRaw !== "http") {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      `JYKSTORE_MCP_TRANSPORT must be stdio or http (got: ${transportRaw}).`,
    );
  }

  const portRaw = env.JYKSTORE_MCP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 3014;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      "JYKSTORE_MCP_PORT must be an integer between 1 and 65535.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    transport: transportRaw,
    port,
    allowedPackIds: parseAllowedPackIds(env.JYKSTORE_MCP_ALLOWED_PACK_IDS),
    timeoutMs: 30_000,
    maxResponseBytes: 2_000_000,
  };
}

/** @internal exported for tests that inject env maps */
export function loadMcpServerConfigFromRecord(
  env: Record<string, string | undefined>,
  argv: string[] = [],
): McpServerConfig {
  return loadMcpServerConfig(env as NodeJS.ProcessEnv, argv);
}

export function assertPackAllowed(
  knowledgePackId: string,
  allowedPackIds: string[],
): void {
  if (allowedPackIds.length === 0) return;
  if (!allowedPackIds.includes(knowledgePackId)) {
    throw mcpError(
      "JYKSTORE_MCP_PACK_NOT_ALLOWED",
      `knowledgePackId "${knowledgePackId}" is not allowed by JYKSTORE_MCP_ALLOWED_PACK_IDS.`,
      {
        hint: "Remove the allowlist or add this packId to JYKSTORE_MCP_ALLOWED_PACK_IDS.",
      },
    );
  }
}

export { readEnv };
