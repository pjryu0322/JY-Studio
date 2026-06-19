import "server-only";

import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  loadPlatformManagedPostgresConfig,
  type PlatformManagedPostgresConfig,
} from "@/lib/planning/platformManagedPostgresConfig.server";
import { resolveUserProjectDatabaseName } from "@/lib/planning/resolveUserProjectDatabaseName";
import type { ProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";
import { readProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";
import {
  PLATFORM_PROJECT_IMPLEMENTATION_SCHEMA,
  PLATFORM_PROJECT_REVIEW_SCHEMA,
} from "@/lib/planning/projectDatabaseNaming";
import {
  classifyProjectDatabaseCreationFailure,
  projectDatabaseFailureUserMessage,
  type ProjectDatabaseCreationFailureReason,
} from "@/lib/planning/projectDatabaseCreationFailure";

export type ProjectDatabaseCreationResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly projectDbName: string | null;
  readonly projectDbStatus: ProjectDatabaseLifecycleStatus;
  readonly failureReason?: ProjectDatabaseCreationFailureReason | null;
  readonly settingsPatch: Partial<PlanningDatabaseSettingsV1>;
}>;

function isValidPostgresDatabaseName(dbName: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(dbName) && dbName.length > 0 && dbName.length <= 63;
}

function buildFailureResult(input: Readonly<{
  readonly projectDbName: string;
  readonly nowIso: string;
  readonly reason: ProjectDatabaseCreationFailureReason;
  readonly adminMessage: string;
}>): ProjectDatabaseCreationResult {
  return {
    ok: false,
    message: projectDatabaseFailureUserMessage(input.reason),
    projectDbName: input.projectDbName,
    projectDbStatus: "FAILED",
    failureReason: input.reason,
    settingsPatch: {
      projectDbName: input.projectDbName,
      projectDbStatus: "FAILED",
      projectDbFailureReason: input.reason,
      connectionStatus: "FAILED",
      lastCheckedAt: input.nowIso,
      lastErrorMessage: input.adminMessage.slice(0, 500),
    },
  };
}

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function pgSsl(config: PlatformManagedPostgresConfig) {
  if (config.sslMode === "DISABLE") return false;
  if (config.sslMode === "REQUIRE") return { rejectUnauthorized: false };
  return undefined;
}

async function databaseExists(config: PlatformManagedPostgresConfig, dbName: string): Promise<boolean> {
  const pg = await import("pg");
  const Client = pg.Client ?? pg.default?.Client;
  if (!Client) return false;
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.adminDatabase,
    user: config.adminUsername,
    password: config.adminPassword,
    ssl: pgSsl(config),
    connectionTimeoutMillis: 12000,
  });
  await client.connect();
  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    return (res.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

async function createDatabase(config: PlatformManagedPostgresConfig, dbName: string): Promise<void> {
  const pg = await import("pg");
  const Client = pg.Client ?? pg.default?.Client;
  if (!Client) throw new Error("PostgreSQL client unavailable");
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.adminDatabase,
    user: config.adminUsername,
    password: config.adminPassword,
    ssl: pgSsl(config),
    connectionTimeoutMillis: 12000,
  });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${quotePgIdent(dbName)}`);
  } finally {
    await client.end();
  }
}

export async function verifyProjectDatabaseConnection(
  config: PlatformManagedPostgresConfig,
  dbName: string,
): Promise<boolean> {
  const pg = await import("pg");
  const Client = pg.Client ?? pg.default?.Client;
  if (!Client) return false;
  const client = new Client({
    host: config.host,
    port: config.port,
    database: dbName,
    user: config.adminUsername,
    password: config.adminPassword,
    ssl: pgSsl(config),
    connectionTimeoutMillis: 12000,
  });
  await client.connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    await client.end();
  }
}

export async function createProjectDatabaseForProject(input: Readonly<{
  readonly projectId: string;
  readonly gitRepoName?: string | null;
  readonly priorSettings: PlanningDatabaseSettingsV1;
  readonly nowIso: string;
}>): Promise<ProjectDatabaseCreationResult> {
  const config = loadPlatformManagedPostgresConfig();
  const displayName = String(input.priorSettings.databaseStoreName ?? "").trim();
  const projectDbName =
    String(input.priorSettings.projectDbName ?? "").trim() ||
    resolveUserProjectDatabaseName({
      databaseDisplayName: displayName,
      projectId: input.projectId,
      gitRepoName: input.gitRepoName,
    });

  if (!isValidPostgresDatabaseName(projectDbName)) {
    return buildFailureResult({
      projectDbName,
      nowIso: input.nowIso,
      reason: "INVALID_DATABASE_NAME",
      adminMessage: `Invalid PostgreSQL database name: ${projectDbName}`,
    });
  }

  if (!config.configured) {
    return buildFailureResult({
      projectDbName,
      nowIso: input.nowIso,
      reason: "POSTGRES_ADMIN_CONFIG_MISSING",
      adminMessage: "플랫폼 PostgreSQL 관리자 설정이 구성되지 않았습니다.",
    });
  }

  const priorStatus = readProjectDatabaseLifecycleStatus(input.priorSettings.projectDbStatus);
  if (priorStatus === "CREATED") {
    const ok = await verifyProjectDatabaseConnection(config, projectDbName);
    if (ok) {
      return {
        ok: true,
        message: "프로젝트 데이터베이스가 이미 준비되어 있습니다.",
        projectDbName,
        projectDbStatus: "CREATED",
        settingsPatch: {
          projectDbName,
          projectDbStatus: "CREATED",
          projectDbFailureReason: null,
          connectionStatus: "READY",
          lastCheckedAt: input.nowIso,
          lastErrorMessage: null,
        },
      };
    }
    return buildFailureResult({
      projectDbName,
      nowIso: input.nowIso,
      reason: "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE",
      adminMessage: "Project database marked CREATED but connection verification failed.",
    });
  }

  try {
    const exists = await databaseExists(config, projectDbName);
    if (!exists) {
      await createDatabase(config, projectDbName);
    }
    const verified = await verifyProjectDatabaseConnection(config, projectDbName);
    if (!verified) {
      return buildFailureResult({
        projectDbName,
        nowIso: input.nowIso,
        reason: classifyProjectDatabaseCreationFailure({
          databaseExists: exists,
          verifyFailedAfterCreate: true,
          rawError: "Project database connection verification failed",
        }),
        adminMessage: exists
          ? "Database exists but platform cannot connect to project database."
          : "Project database connection verification failed after create.",
      });
    }
    return {
      ok: true,
      message: "프로젝트 데이터베이스가 준비되었습니다.",
      projectDbName,
      projectDbStatus: "CREATED",
      settingsPatch: {
        projectDbName,
        projectDbStatus: "CREATED",
        projectDbFailureReason: null,
        database: projectDbName,
        ...(displayName ? { databaseStoreName: displayName } : {}),
        implementationSchemaName: PLATFORM_PROJECT_IMPLEMENTATION_SCHEMA,
        reviewSchemaName: PLATFORM_PROJECT_REVIEW_SCHEMA,
        schemaStrategy: "PROJECT_STAGE_SCHEMA",
        connectionStatus: "READY",
        lastCheckedAt: input.nowIso,
        lastErrorMessage: null,
        host: config.host,
        port: config.port,
        username: config.adminUsername,
        sslMode: config.sslMode,
        runtimeApiBaseUrl: config.runtimeApiBaseUrl,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    let exists = false;
    try {
      exists = await databaseExists(config, projectDbName);
    } catch {
      exists = false;
    }
    const reason = classifyProjectDatabaseCreationFailure({
      rawError: msg,
      databaseExists: exists,
      verifyFailedAfterCreate: exists,
    });
    console.error(`[planning-db] Project database creation failed (${reason}):`, msg);
    return buildFailureResult({
      projectDbName,
      nowIso: input.nowIso,
      reason,
      adminMessage: msg,
    });
  }
}

export async function testPlatformManagementDatabaseConnection(): Promise<Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly platformManagementDatabase?: string;
}>> {
  const config = loadPlatformManagedPostgresConfig();
  if (!config.configured) {
    return { ok: false, message: "JYO_PLATFORM_PG_* 환경 변수를 설정해 주세요." };
  }
  try {
    const pg = await import("pg");
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) return { ok: false, message: "PostgreSQL client unavailable" };
    const client = new Client({
      host: config.host,
      port: config.port,
      database: config.platformManagementDatabase,
      user: config.adminUsername,
      password: config.adminPassword,
      ssl: pgSsl(config),
      connectionTimeoutMillis: 12000,
    });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return {
      ok: true,
      platformManagementDatabase: config.platformManagementDatabase,
      message: `플랫폼 관리 DB \`${config.platformManagementDatabase}\` 접속을 확인했습니다.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: msg.slice(0, 500),
      platformManagementDatabase: config.platformManagementDatabase,
    };
  }
}

export async function testGeneratedProjectDataDatabaseConnection(): Promise<Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly canCreateSchema?: boolean;
  readonly generatedProjectDataDatabase?: string;
  /** @deprecated */
  readonly runtimeDatabase?: string;
}>> {
  const config = loadPlatformManagedPostgresConfig();
  if (!config.configured) {
    return { ok: false, message: "JYO_PLATFORM_PG_* 환경 변수를 설정해 주세요." };
  }
  const dbName = config.generatedProjectDataDatabase;
  const testSchema = `_jyo_schema_probe_${Date.now().toString(36)}`;
  try {
    const pg = await import("pg");
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) return { ok: false, message: "PostgreSQL client unavailable" };
    const client = new Client({
      host: config.host,
      port: config.port,
      database: dbName,
      user: config.adminUsername,
      password: config.adminPassword,
      ssl: pgSsl(config),
      connectionTimeoutMillis: 12000,
    });
    await client.connect();
    await client.query("SELECT 1");
    let canCreateSchema = false;
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${testSchema.replace(/"/g, "")}"`);
      await client.query(`DROP SCHEMA IF EXISTS "${testSchema.replace(/"/g, "")}"`);
      canCreateSchema = true;
    } catch {
      canCreateSchema = false;
    }
    await client.end();
    return {
      ok: true,
      generatedProjectDataDatabase: dbName,
      runtimeDatabase: dbName,
      canCreateSchema,
      message: canCreateSchema
        ? `생성 프로젝트 데이터 DB \`${dbName}\` 접속 및 CREATE SCHEMA 권한을 확인했습니다.`
        : `생성 프로젝트 데이터 DB \`${dbName}\` 접속은 가능하지만 CREATE SCHEMA 권한이 없을 수 있습니다.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: msg.slice(0, 500),
      generatedProjectDataDatabase: dbName,
      runtimeDatabase: dbName,
    };
  }
}

export async function testPlatformManagedPostgresAdminConnection(): Promise<Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly platformManagement?: Awaited<ReturnType<typeof testPlatformManagementDatabaseConnection>>;
  readonly generatedProjectData?: Awaited<ReturnType<typeof testGeneratedProjectDataDatabaseConnection>>;
  readonly canCreateSchema?: boolean;
  readonly runtimeDatabase?: string;
  readonly platformManagementDatabase?: string;
  readonly generatedProjectDataDatabase?: string;
}>> {
  const platformManagement = await testPlatformManagementDatabaseConnection();
  const generatedProjectData = await testGeneratedProjectDataDatabaseConnection();
  const ok = platformManagement.ok && generatedProjectData.ok;
  const message = [platformManagement.message, generatedProjectData.message].filter(Boolean).join(" ");
  return {
    ok,
    message,
    platformManagement,
    generatedProjectData,
    canCreateSchema: generatedProjectData.canCreateSchema,
    runtimeDatabase: generatedProjectData.generatedProjectDataDatabase,
    platformManagementDatabase: platformManagement.platformManagementDatabase,
    generatedProjectDataDatabase: generatedProjectData.generatedProjectDataDatabase,
  };
}
