import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { resolveJyprojectsPgConnectionForProvisioning } from "@/lib/planning/jyprojectsPgConnection.server";
import {
  classifyProjectSchemaStoreFailure,
  projectSchemaStoreFailureUserMessage,
} from "@/lib/planning/projectSchemaStoreFailure";

export type PostgresSchemaProvisionResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
}>;

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

export async function createPostgresSchemaIfNotExists(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly password: string | null;
  readonly schemaName: string;
}>): Promise<PostgresSchemaProvisionResult> {
  const schemaName = String(input.schemaName ?? "").trim();
  if (!schemaName) {
    return { ok: false, message: "스키마명이 비어 있습니다." };
  }
  if (!/^[a-z][a-z0-9_]*$/i.test(schemaName)) {
    return { ok: false, message: projectSchemaStoreFailureUserMessage("INVALID_SCHEMA_NAME") };
  }

  const resolved = resolveJyprojectsPgConnectionForProvisioning({
    planningSettings: input.settings,
    passwordOverride: input.password,
  });
  if (!resolved.ok) {
    return { ok: false, message: resolved.userMessage };
  }
  const settings = resolved.settings;
  const password = resolved.password;

  try {
    const pg = await import("pg");
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) {
      return { ok: false, message: "서버에서 PostgreSQL 클라이언트를 사용할 수 없습니다." };
    }
    const client = new Client({
      host: settings.host,
      port: settings.port,
      database: settings.database,
      user: settings.username,
      password,
      ssl:
        settings.sslMode === "DISABLE"
          ? false
          : settings.sslMode === "REQUIRE"
            ? { rejectUnauthorized: false }
            : undefined,
      connectionTimeoutMillis: 12000,
    });
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotePgIdent(schemaName)}`);
    await client.end();
    return { ok: true, message: "스키마를 생성했습니다." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const reason = classifyProjectSchemaStoreFailure(msg);
    return { ok: false, message: projectSchemaStoreFailureUserMessage(reason) };
  }
}

export function buildImplementationSampleStoreCreatedTimelineEntry(input: Readonly<{
  readonly projectId: string;
  readonly databaseName: string;
  readonly schemaName: string;
  readonly nowIso: string;
}>): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "구현",
    workspaceScreenKey: "execution",
    action: "implementation_sample_store_created",
    source: "system",
    responseText: [
      "type=implementation_sample_store_created",
      "stage=implementation",
      `databaseName=${input.databaseName}`,
      `schemaName=${input.schemaName}`,
      "lifecycleStatus=CREATED",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationSampleStoreCreationFailedTimelineEntry(input: Readonly<{
  readonly projectId: string;
  readonly schemaName: string;
  readonly errorMessage: string;
  readonly nowIso: string;
}>): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "구현",
    workspaceScreenKey: "execution",
    action: "implementation_sample_store_creation_failed",
    source: "system",
    responseText: [
      "type=implementation_sample_store_creation_failed",
      "stage=implementation",
      `schemaName=${input.schemaName}`,
      "lifecycleStatus=FAILED",
      `errorMessage=${input.errorMessage}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildReviewTestStoreCreatedTimelineEntry(input: Readonly<{
  readonly projectId: string;
  readonly sourceSchemaName: string;
  readonly schemaName: string;
  readonly nowIso: string;
}>): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "검토",
    workspaceScreenKey: "execution",
    action: "review_test_store_created",
    source: "system",
    responseText: [
      "type=review_test_store_created",
      "stage=review",
      `sourceSchemaName=${input.sourceSchemaName}`,
      `schemaName=${input.schemaName}`,
      "lifecycleStatus=CREATED",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildReviewTestStoreCreationFailedTimelineEntry(input: Readonly<{
  readonly projectId: string;
  readonly schemaName: string;
  readonly errorMessage: string;
  readonly nowIso: string;
}>): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "검토",
    workspaceScreenKey: "execution",
    action: "review_test_store_creation_failed",
    source: "system",
    responseText: [
      "type=review_test_store_creation_failed",
      "stage=review",
      `schemaName=${input.schemaName}`,
      "lifecycleStatus=FAILED",
      `errorMessage=${input.errorMessage}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
