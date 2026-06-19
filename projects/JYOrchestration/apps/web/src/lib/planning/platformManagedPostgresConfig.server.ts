import "server-only";

import type { PlanningDatabaseSettingsV1, PlanningDatabaseSslMode } from "@/lib/planning/planningDatabaseSettingsV1";

export type PlatformManagedPostgresConfig = Readonly<{
  readonly configured: boolean;
  readonly host: string;
  readonly port: number;
  readonly adminDatabase: string;
  readonly adminUsername: string;
  readonly adminPassword: string;
  readonly sslMode: PlanningDatabaseSslMode;
  readonly runtimeApiBaseUrl: string | null;
  readonly projectDbPrefix: string;
}>;

function readEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function readSslMode(): PlanningDatabaseSslMode {
  const s = readEnv("JYO_PLATFORM_PG_SSL_MODE").toUpperCase();
  if (s === "DISABLE" || s === "REQUIRE" || s === "PREFER") return s;
  return "PREFER";
}

export function loadPlatformManagedPostgresConfig(): PlatformManagedPostgresConfig {
  const host = readEnv("JYO_PLATFORM_PG_HOST");
  const adminUsername = readEnv("JYO_PLATFORM_PG_ADMIN_USERNAME");
  const adminPassword = readEnv("JYO_PLATFORM_PG_ADMIN_PASSWORD");
  const adminDatabase = readEnv("JYO_PLATFORM_PG_ADMIN_DATABASE") || "postgres";
  const portRaw = Number(readEnv("JYO_PLATFORM_PG_PORT") || "5432");
  const port = Number.isFinite(portRaw) && portRaw > 0 ? Math.min(65535, Math.floor(portRaw)) : 5432;
  const configured = Boolean(host && adminUsername && adminPassword);
  return {
    configured,
    host,
    port,
    adminDatabase,
    adminUsername,
    adminPassword,
    sslMode: readSslMode(),
    runtimeApiBaseUrl: readEnv("JYO_PLATFORM_PG_RUNTIME_API_BASE_URL") || null,
    projectDbPrefix: readEnv("JYO_PLATFORM_PG_PROJECT_DB_PREFIX") || "p_",
  };
}

export function sanitizePlatformManagedPostgresConfigForAdmin(
  config: PlatformManagedPostgresConfig,
): Readonly<{
  readonly configured: boolean;
  readonly host: string;
  readonly port: number;
  readonly adminDatabase: string;
  readonly adminUsername: string;
  readonly hasAdminPassword: boolean;
  readonly sslMode: PlanningDatabaseSslMode;
  readonly runtimeApiBaseUrl: string | null;
  readonly projectDbPrefix: string;
}> {
  return {
    configured: config.configured,
    host: config.host,
    port: config.port,
    adminDatabase: config.adminDatabase,
    adminUsername: config.adminUsername,
    hasAdminPassword: Boolean(config.adminPassword),
    sslMode: config.sslMode,
    runtimeApiBaseUrl: config.runtimeApiBaseUrl,
    projectDbPrefix: config.projectDbPrefix,
  };
}

export function buildServerPlanningDatabaseSettingsForProjectDb(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly projectDbName: string;
  readonly config: PlatformManagedPostgresConfig;
}>): PlanningDatabaseSettingsV1 {
  return {
    ...input.settings,
    provider: "POSTGRESQL",
    host: input.config.host,
    port: input.config.port,
    database: input.projectDbName,
    username: input.config.adminUsername,
    sslMode: input.config.sslMode,
    runtimeApiBaseUrl: input.config.runtimeApiBaseUrl,
    connectionStatus: "READY",
    lastErrorMessage: null,
  };
}
