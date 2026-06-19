/**
 * 기획단계 PostgreSQL 환경설정 — `requirementsStateJson.planningDatabaseSettingsV1` (비밀번호 제외).
 */

import type { DatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { ProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";

export const PLANNING_DB_SETTINGS_VERSION = 1 as const;

export type PlanningDatabaseConnectionStatus =
  | "NOT_CONFIGURED"
  | "NOT_REQUIRED"
  | "READY"
  | "FAILED"
  | "CHECKING";

export type { DatabaseUsageMode };

export type PlanningDatabaseSslMode = "DISABLE" | "REQUIRE" | "PREFER";

export type PlanningDatabaseSettingsV1 = Readonly<{
  readonly version: typeof PLANNING_DB_SETTINGS_VERSION;
  readonly usageMode?: DatabaseUsageMode;
  readonly usageSelectionCommitted?: boolean;
  readonly enabled: boolean;
  readonly provider: "POSTGRESQL";
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly passwordMasked?: string | null;
  readonly hasPassword?: boolean;
  readonly sslMode: PlanningDatabaseSslMode;
  readonly runtimeApiBaseUrl?: string | null;
  readonly repositoryName?: string | null;
  readonly databaseStoreName?: string | null;
  readonly implementationSchemaName?: string | null;
  readonly reviewSchemaName?: string | null;
  readonly schemaStrategy?: "PROJECT_STAGE_SCHEMA" | null;
  readonly projectDbName?: string | null;
  readonly projectDbStatus?: ProjectDatabaseLifecycleStatus;
  readonly connectionStatus: PlanningDatabaseConnectionStatus;
  readonly lastCheckedAt?: string | null;
  readonly lastErrorMessage?: string | null;
}>;

function readStr(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function readPort(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 5432;
  return Math.min(65535, Math.floor(n));
}

function readSsl(v: unknown): PlanningDatabaseSslMode {
  const s = readStr(v, 20);
  if (s === "DISABLE" || s === "REQUIRE" || s === "PREFER") return s;
  return "PREFER";
}

function readStatus(v: unknown): PlanningDatabaseConnectionStatus {
  const s = readStr(v, 40);
  if (
    s === "READY" ||
    s === "FAILED" ||
    s === "CHECKING" ||
    s === "NOT_CONFIGURED" ||
    s === "NOT_REQUIRED"
  ) {
    return s;
  }
  return "NOT_CONFIGURED";
}

function readUsageMode(v: unknown): DatabaseUsageMode | undefined {
  const s = readStr(v, 40);
  if (
    s === "UNSELECTED" ||
    s === "DISABLED_JSON_SAMPLE" ||
    s === "ENABLED_PROJECT_DATABASE" ||
    s === "ENABLED_POSTGRESQL"
  ) {
    return s;
  }
  return undefined;
}

function readProjectDbStatus(v: unknown): ProjectDatabaseLifecycleStatus | undefined {
  const s = readStr(v, 40);
  if (
    s === "NOT_REQUIRED" ||
    s === "PLANNED" ||
    s === "CREATING" ||
    s === "CREATED" ||
    s === "FAILED" ||
    s === "DELETING" ||
    s === "DELETED"
  ) {
    return s;
  }
  return undefined;
}

export function defaultPlanningDatabaseSettingsV1(): PlanningDatabaseSettingsV1 {
  return {
    version: PLANNING_DB_SETTINGS_VERSION,
    usageMode: "UNSELECTED",
    usageSelectionCommitted: false,
    enabled: false,
    provider: "POSTGRESQL",
    host: "",
    port: 5432,
    database: "",
    username: "",
    passwordMasked: null,
    hasPassword: false,
    sslMode: "PREFER",
    runtimeApiBaseUrl: null,
    connectionStatus: "NOT_CONFIGURED",
    lastCheckedAt: null,
    lastErrorMessage: null,
  };
}

export function parsePlanningDatabaseSettingsV1(raw: unknown): PlanningDatabaseSettingsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== PLANNING_DB_SETTINGS_VERSION) return null;
  const masked = readStr(o.passwordMasked, 80) || null;
  return {
    version: PLANNING_DB_SETTINGS_VERSION,
    usageMode: readUsageMode(o.usageMode),
    usageSelectionCommitted: Boolean(o.usageSelectionCommitted),
    enabled: Boolean(o.enabled),
    provider: "POSTGRESQL",
    host: readStr(o.host, 400),
    port: readPort(o.port),
    database: readStr(o.database, 200),
    username: readStr(o.username, 200),
    passwordMasked: masked,
    hasPassword: Boolean(o.hasPassword) || Boolean(masked),
    sslMode: readSsl(o.sslMode),
    runtimeApiBaseUrl: readStr(o.runtimeApiBaseUrl, 500) || null,
    repositoryName: readStr(o.repositoryName, 200) || null,
    databaseStoreName: readStr(o.databaseStoreName, 120) || null,
    implementationSchemaName: readStr(o.implementationSchemaName, 120) || null,
    reviewSchemaName: readStr(o.reviewSchemaName, 120) || null,
    schemaStrategy: readStr(o.schemaStrategy, 40) === "PROJECT_STAGE_SCHEMA" ? "PROJECT_STAGE_SCHEMA" : null,
    projectDbName: readStr(o.projectDbName, 120) || null,
    ...(readProjectDbStatus(o.projectDbStatus) ? { projectDbStatus: readProjectDbStatus(o.projectDbStatus)! } : {}),
    connectionStatus: readStatus(o.connectionStatus),
    lastCheckedAt: readStr(o.lastCheckedAt, 80) || null,
    lastErrorMessage: readStr(o.lastErrorMessage, 500) || null,
  };
}

export function sanitizePlanningDatabaseSettingsForClient(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): PlanningDatabaseSettingsV1 {
  const base = settings ?? defaultPlanningDatabaseSettingsV1();
  return {
    ...base,
    host: "",
    port: 5432,
    database: "",
    username: "",
    passwordMasked: null,
    hasPassword: false,
    sslMode: "PREFER",
    runtimeApiBaseUrl: null,
    projectDbName: null,
    lastErrorMessage: null,
  };
}
