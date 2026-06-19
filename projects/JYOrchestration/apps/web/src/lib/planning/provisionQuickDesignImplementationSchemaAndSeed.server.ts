import "server-only";

import type { DataModelEntityV1, PlanningDataFieldType } from "@/lib/planning/planningDataSlotsV1";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { normalizeRepositoryNameForDb } from "@/lib/planning/projectDataStoreNaming";

export type QuickDesignImplementationDbStructureResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly tablesCreated: readonly string[];
  readonly seedRowsInserted: number;
}>;

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

function normalizeEntityTableName(entityName: string): string {
  const base = normalizeRepositoryNameForDb(String(entityName ?? "").trim() || "entity", null);
  return base.slice(0, 48);
}

function normalizeFieldColumnName(fieldName: string): string {
  const base = normalizeRepositoryNameForDb(String(fieldName ?? "").trim() || "field", null);
  return base.slice(0, 48);
}

function pgColumnType(fieldType: PlanningDataFieldType): string {
  switch (fieldType) {
    case "number":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "datetime":
      return "TIMESTAMPTZ";
    case "json":
      return "JSONB";
    case "text":
      return "TEXT";
    case "string":
    default:
      return "VARCHAR(512)";
  }
}

function coerceSampleValue(fieldType: PlanningDataFieldType, raw: string | undefined): unknown {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  switch (fieldType) {
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      if (/^(true|1|yes|y)$/i.test(value)) return true;
      if (/^(false|0|no|n)$/i.test(value)) return false;
      return null;
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

export async function provisionQuickDesignImplementationSchemaAndSeed(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password: string | null;
  readonly schemaName: string;
  readonly entities: readonly DataModelEntityV1[];
}>): Promise<QuickDesignImplementationDbStructureResult> {
  const schemaName = String(input.schemaName ?? "").trim();
  const entities = input.entities.filter((e) => String(e.name ?? "").trim());
  if (!schemaName) {
    return { ok: false, message: "스키마명이 비어 있습니다.", tablesCreated: [], seedRowsInserted: 0 };
  }
  if (!entities.length) {
    return { ok: true, message: "생성할 데이터 엔티티가 없어 테이블 생성을 건너뜁니다.", tablesCreated: [], seedRowsInserted: 0 };
  }

  const host = input.settings.host.trim();
  const database = input.settings.database.trim();
  const username = input.settings.username.trim();
  const password = String(input.password ?? "").trim();
  if (!host || !database || !username || !password) {
    return { ok: false, message: "PostgreSQL 접속 정보가 부족합니다.", tablesCreated: [], seedRowsInserted: 0 };
  }

  const tablesCreated: string[] = [];
  let seedRowsInserted = 0;

  try {
    const pg = await import("pg");
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) {
      return { ok: false, message: "서버에서 PostgreSQL 클라이언트를 사용할 수 없습니다.", tablesCreated: [], seedRowsInserted: 0 };
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
      connectionTimeoutMillis: 12000,
    });
    await client.connect();
    const schemaIdent = quotePgIdent(schemaName);

    for (const entity of entities) {
      const tableName = normalizeEntityTableName(entity.name);
      const tableIdent = `${schemaIdent}.${quotePgIdent(tableName)}`;
      const columns: string[] = [`${quotePgIdent("id")} SERIAL PRIMARY KEY`];
      for (const field of entity.fields) {
        const col = normalizeFieldColumnName(field.name);
        if (col === "id") continue;
        columns.push(`${quotePgIdent(col)} ${pgColumnType(field.type)}`);
      }
      columns.push(`${quotePgIdent("created_at")} TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
      await client.query(`CREATE TABLE IF NOT EXISTS ${tableIdent} (${columns.join(", ")})`);
      tablesCreated.push(tableName);

      const seedFields = entity.fields.filter((f) => String(f.sampleValue ?? "").trim());
      if (seedFields.length) {
        const colNames = seedFields.map((f) => quotePgIdent(normalizeFieldColumnName(f.name)));
        const placeholders = seedFields.map((_, i) => `$${i + 1}`);
        const values = seedFields.map((f) => coerceSampleValue(f.type, f.sampleValue));
        await client.query(
          `INSERT INTO ${tableIdent} (${colNames.join(", ")}) VALUES (${placeholders.join(", ")})`,
          values,
        );
        seedRowsInserted += 1;
      }
    }

    await client.end();
    return {
      ok: true,
      message: `구현단계 테이블 ${tablesCreated.length}개와 샘플 시드 데이터를 준비했습니다.`,
      tablesCreated,
      seedRowsInserted,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: msg.slice(0, 500), tablesCreated, seedRowsInserted };
  }
}
