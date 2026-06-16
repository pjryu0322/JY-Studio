/**
 * 기획단계 PostgreSQL 환경설정 — `requirementsStateJson.planningDatabaseSettingsV1` (비밀번호 제외).
 */

export const PLANNING_DB_SETTINGS_VERSION = 1 as const;

export type PlanningDatabaseConnectionStatus =
  | "NOT_CONFIGURED"
  | "READY"
  | "FAILED"
  | "CHECKING";

export type PlanningDatabaseSslMode = "DISABLE" | "REQUIRE" | "PREFER";

export type PlanningDatabaseSettingsV1 = Readonly<{
  readonly version: typeof PLANNING_DB_SETTINGS_VERSION;
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
  if (s === "READY" || s === "FAILED" || s === "CHECKING" || s === "NOT_CONFIGURED") return s;
  return "NOT_CONFIGURED";
}

export function defaultPlanningDatabaseSettingsV1(): PlanningDatabaseSettingsV1 {
  return {
    version: PLANNING_DB_SETTINGS_VERSION,
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
    passwordMasked: base.hasPassword ? base.passwordMasked || "••••••••" : null,
  };
}
