import "server-only";

import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  loadPlatformManagedPostgresConfig,
  type PlatformManagedPostgresConfig,
} from "@/lib/planning/platformManagedPostgresConfig.server";
import { buildProjectDatabaseName } from "@/lib/planning/projectDatabaseNaming";
import type { ProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";
import { readProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";
import {
  PLATFORM_PROJECT_IMPLEMENTATION_SCHEMA,
  PLATFORM_PROJECT_REVIEW_SCHEMA,
} from "@/lib/planning/projectDatabaseNaming";

export type ProjectDatabaseCreationResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly projectDbName: string | null;
  readonly projectDbStatus: ProjectDatabaseLifecycleStatus;
  readonly settingsPatch: Partial<PlanningDatabaseSettingsV1>;
}>;

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

async function verifyProjectDatabaseConnection(
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
  const projectDbName =
    String(input.priorSettings.projectDbName ?? "").trim() ||
    buildProjectDatabaseName({ projectId: input.projectId, gitRepoName: input.gitRepoName });

  if (!config.configured) {
    return {
      ok: false,
      message: "플랫폼 PostgreSQL 관리자 설정이 구성되지 않았습니다.",
      projectDbName,
      projectDbStatus: "FAILED",
      settingsPatch: {
        projectDbName,
        projectDbStatus: "FAILED",
        connectionStatus: "FAILED",
        lastCheckedAt: input.nowIso,
        lastErrorMessage: "플랫폼 PostgreSQL 관리자 설정이 구성되지 않았습니다.",
      },
    };
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
          connectionStatus: "READY",
          lastCheckedAt: input.nowIso,
          lastErrorMessage: null,
        },
      };
    }
  }

  try {
    const exists = await databaseExists(config, projectDbName);
    if (!exists) {
      await createDatabase(config, projectDbName);
    }
    const verified = await verifyProjectDatabaseConnection(config, projectDbName);
    if (!verified) {
      return {
        ok: false,
        message: "프로젝트 데이터베이스 생성 후 접속 확인에 실패했습니다.",
        projectDbName,
        projectDbStatus: "FAILED",
        settingsPatch: {
          projectDbName,
          projectDbStatus: "FAILED",
          connectionStatus: "FAILED",
          lastCheckedAt: input.nowIso,
          lastErrorMessage: "프로젝트 데이터베이스 접속 확인에 실패했습니다.",
        },
      };
    }
    return {
      ok: true,
      message: "프로젝트 데이터베이스가 준비되었습니다.",
      projectDbName,
      projectDbStatus: "CREATED",
      settingsPatch: {
        projectDbName,
        projectDbStatus: "CREATED",
        database: projectDbName,
        databaseStoreName: projectDbName,
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
    return {
      ok: false,
      message: msg.slice(0, 500),
      projectDbName,
      projectDbStatus: "FAILED",
      settingsPatch: {
        projectDbName,
        projectDbStatus: "FAILED",
        connectionStatus: "FAILED",
        lastCheckedAt: input.nowIso,
        lastErrorMessage: msg.slice(0, 500),
      },
    };
  }
}

export async function testPlatformManagedPostgresAdminConnection(): Promise<Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly canCreateDatabase?: boolean;
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
      database: config.adminDatabase,
      user: config.adminUsername,
      password: config.adminPassword,
      ssl: pgSsl(config),
      connectionTimeoutMillis: 12000,
    });
    await client.connect();
    await client.query("SELECT 1");
    let canCreateDatabase = false;
    try {
      const priv = await client.query(
        "SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user",
      );
      canCreateDatabase = Boolean(priv.rows[0]?.rolcreatedb);
    } catch {
      canCreateDatabase = false;
    }
    await client.end();
    return {
      ok: true,
      message: canCreateDatabase
        ? "PostgreSQL 관리자 접속 및 CREATE DATABASE 권한을 확인했습니다."
        : "PostgreSQL 관리자 접속은 가능하지만 CREATE DATABASE 권한이 없을 수 있습니다.",
      canCreateDatabase,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: msg.slice(0, 500) };
  }
}
