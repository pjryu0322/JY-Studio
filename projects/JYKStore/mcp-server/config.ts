import { mcpError } from "./errors.js";
import { parseAllowedOrigins } from "./cors.js";

export type McpTransport = "stdio" | "http";

export type McpServerConfig = {
  baseUrl: string;
  apiKey: string;
  transport: McpTransport;
  port: number;
  allowedPackIds: string[];
  allowedOrigins: string[];
  timeoutMs: number;
  maxResponseBytes: number;
  maxExportSourceBytes: number;
};

const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_MAX_EXPORT_SOURCE_BYTES = 20_000_000;

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

function parsePositiveIntEnv(
  raw: string | undefined,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < min || value > max) {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      `${field} must be an integer between ${min} and ${max}.`,
    );
  }
  return value;
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

  const maxResponseBytes = parsePositiveIntEnv(
    env.JYKSTORE_MCP_MAX_RESPONSE_BYTES,
    "JYKSTORE_MCP_MAX_RESPONSE_BYTES",
    DEFAULT_MAX_RESPONSE_BYTES,
    100_000,
    10_000_000,
  );

  const maxExportSourceBytes = parsePositiveIntEnv(
    env.JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES,
    "JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES",
    DEFAULT_MAX_EXPORT_SOURCE_BYTES,
    maxResponseBytes,
    100_000_000,
  );

  if (maxExportSourceBytes < maxResponseBytes) {
    throw mcpError(
      "JYKSTORE_MCP_INVALID_INPUT",
      "JYKSTORE_MCP_MAX_EXPORT_SOURCE_BYTES must be >= JYKSTORE_MCP_MAX_RESPONSE_BYTES.",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    transport: transportRaw,
    port,
    allowedPackIds: parseAllowedPackIds(env.JYKSTORE_MCP_ALLOWED_PACK_IDS),
    allowedOrigins: parseAllowedOrigins(env.JYKSTORE_MCP_ALLOWED_ORIGINS),
    timeoutMs: 30_000,
    maxResponseBytes,
    maxExportSourceBytes,
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

export { readEnv, parseAllowedOrigins };
