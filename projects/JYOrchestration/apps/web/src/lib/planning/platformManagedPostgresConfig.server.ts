import "server-only";

import {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
} from "@/lib/planning/platformDatabaseRoles";
import type { PlanningDatabaseSettingsV1, PlanningDatabaseSslMode } from "@/lib/planning/planningDatabaseSettingsV1";

export type PlatformManagedPostgresConfig = Readonly<{
  readonly configured: boolean;
  readonly host: string;
  readonly port: number;
  /** Bootstrap catalog DB for admin operations (typically `postgres`). */
  readonly adminDatabase: string;
  /** Platform management DB — orchestration metadata (typically `jyorchestration`). */
  readonly platformManagementDatabase: string;
  /** Generated project data DB — project schemas (typically `jyprojects`). */
  readonly generatedProjectDataDatabase: string;
  /** @deprecated Use generatedProjectDataDatabase */
  readonly runtimeDatabase: string;
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

function readGeneratedProjectDataDatabaseName(): string {
  return (
    readEnv("JYO_PLATFORM_PG_GENERATED_PROJECT_DATA_DATABASE") ||
    readEnv("JYO_PLATFORM_PG_RUNTIME_DATABASE") ||
    JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME
  );
}

function readPlatformManagementDatabaseName(): string {
  const explicit = readEnv("JYO_PLATFORM_PG_PLATFORM_DATABASE");
  if (explicit) return explicit;
  const fromUrl = readDatabaseNameFromPostgresUrl(readEnv("JY_PLATFORM_DATABASE_URL"));
  if (fromUrl) return fromUrl;
  const fromPrismaUrl = readDatabaseNameFromPostgresUrl(readEnv("DATABASE_URL"));
  if (fromPrismaUrl) return fromPrismaUrl;
  return JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME;
}

function readDatabaseNameFromPostgresUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.replace(/^postgresql:/i, "http:"));
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "").trim();
    return name || null;
  } catch {
    return null;
  }
}

export function loadPlatformManagedPostgresConfig(): PlatformManagedPostgresConfig {
  const host = readEnv("JYO_PLATFORM_PG_HOST");
  const adminUsername = readEnv("JYO_PLATFORM_PG_ADMIN_USERNAME");
  const adminPassword = readEnv("JYO_PLATFORM_PG_ADMIN_PASSWORD");
  const adminDatabase = readEnv("JYO_PLATFORM_PG_ADMIN_DATABASE") || "postgres";
  const platformManagementDatabase = readPlatformManagementDatabaseName();
  const generatedProjectDataDatabase = readGeneratedProjectDataDatabaseName();
  const portRaw = Number(readEnv("JYO_PLATFORM_PG_PORT") || "5432");
  const port = Number.isFinite(portRaw) && portRaw > 0 ? Math.min(65535, Math.floor(portRaw)) : 5432;
  const configured = Boolean(host && adminUsername && adminPassword);
  return {
    configured,
    host,
    port,
    adminDatabase,
    platformManagementDatabase,
    generatedProjectDataDatabase,
    runtimeDatabase: generatedProjectDataDatabase,
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
  readonly platformManagementDatabase: string;
  readonly generatedProjectDataDatabase: string;
  readonly runtimeDatabase: string;
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
    platformManagementDatabase: config.platformManagementDatabase,
    generatedProjectDataDatabase: config.generatedProjectDataDatabase,
    runtimeDatabase: config.generatedProjectDataDatabase,
    adminUsername: config.adminUsername,
    hasAdminPassword: Boolean(config.adminPassword),
    sslMode: config.sslMode,
    runtimeApiBaseUrl: config.runtimeApiBaseUrl,
    projectDbPrefix: config.projectDbPrefix,
  };
}

export function buildServerPlanningDatabaseSettingsForRuntimeDb(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly config: PlatformManagedPostgresConfig;
}>): PlanningDatabaseSettingsV1 {
  return {
    ...input.settings,
    provider: "POSTGRESQL",
    host: input.config.host,
    port: input.config.port,
    database: input.config.generatedProjectDataDatabase,
    username: input.config.adminUsername,
    sslMode: input.config.sslMode,
    runtimeApiBaseUrl: input.config.runtimeApiBaseUrl,
    platformManagementDatabaseName: input.config.platformManagementDatabase,
    generatedProjectDataDatabaseName: input.config.generatedProjectDataDatabase,
    runtimeDatabaseName: input.config.generatedProjectDataDatabase,
    connectionStatus: "READY",
    lastErrorMessage: null,
  };
}

/** @deprecated Use buildServerPlanningDatabaseSettingsForRuntimeDb */
export function buildServerPlanningDatabaseSettingsForProjectDb(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly projectDbName: string;
  readonly config: PlatformManagedPostgresConfig;
}>): PlanningDatabaseSettingsV1 {
  return buildServerPlanningDatabaseSettingsForRuntimeDb({
    settings: input.settings,
    config: input.config,
  });
}
