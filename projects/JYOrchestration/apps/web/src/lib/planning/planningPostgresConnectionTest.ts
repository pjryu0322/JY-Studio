import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

export type PlanningPostgresConnectionTestResult = Readonly<{
  readonly ok: boolean;
  readonly connectionStatus: PlanningDatabaseSettingsV1["connectionStatus"];
  readonly message: string;
}>;

export async function testPlanningPostgresConnection(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password: string | null;
}>): Promise<PlanningPostgresConnectionTestResult> {
  if (!input.settings.enabled) {
    return {
      ok: true,
      connectionStatus: "NOT_CONFIGURED",
      message: "데이터베이스 사용이 꺼져 있습니다. 필요 시 사용 여부를 켜 주세요.",
    };
  }
  const host = input.settings.host.trim();
  const database = input.settings.database.trim();
  const username = input.settings.username.trim();
  const password = String(input.password ?? "").trim();
  if (!host || !database || !username) {
    return {
      ok: false,
      connectionStatus: "FAILED",
      message: "Host, Database, Username을 입력해 주세요.",
    };
  }
  if (!password) {
    return {
      ok: false,
      connectionStatus: "FAILED",
      message: "연결 테스트를 위해 비밀번호를 입력해 주세요.",
    };
  }

  try {
    const pg = await import("pg");
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) {
      return {
        ok: false,
        connectionStatus: "FAILED",
        message: "서버에서 PostgreSQL 클라이언트를 사용할 수 없습니다.",
      };
    }
    const ssl =
      input.settings.sslMode === "DISABLE"
        ? false
        : input.settings.sslMode === "REQUIRE"
          ? { rejectUnauthorized: false }
          : undefined;
    const client = new Client({
      host,
      port: input.settings.port,
      database,
      user: username,
      password,
      ssl,
      connectionTimeoutMillis: 8000,
    });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return {
      ok: true,
      connectionStatus: "READY",
      message: "데이터베이스 연결에 성공했습니다.",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      connectionStatus: "FAILED",
      message: `연결에 실패했습니다. Host·포트·Database·계정 정보를 확인해 주세요. (${msg.slice(0, 180)})`,
    };
  }
}
