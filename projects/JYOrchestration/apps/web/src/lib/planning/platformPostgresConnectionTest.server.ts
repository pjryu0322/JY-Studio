import "server-only";

import {
  loadPlatformManagedPostgresConfig,
  type PlatformManagedPostgresConfig,
} from "@/lib/planning/platformManagedPostgresConfig.server";

function pgSsl(config: PlatformManagedPostgresConfig) {
  if (config.sslMode === "DISABLE") return false;
  if (config.sslMode === "REQUIRE") return { rejectUnauthorized: false };
  return undefined;
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
