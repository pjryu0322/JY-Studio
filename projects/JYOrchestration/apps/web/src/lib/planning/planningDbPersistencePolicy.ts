import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { DataStoreSlotV1 } from "@/lib/planning/planningDataSlotsV1";
import { buildProjectDataStoreNaming } from "@/lib/planning/projectDataStoreNaming";

export type PlanningDataPersistenceMode = "POSTGRES_SAMPLE_DB" | "MOCK_JSON_FALLBACK";

function hasPostgresStoreNaming(settings: PlanningDatabaseSettingsV1): boolean {
  const impl = String(settings.implementationSchemaName ?? settings.databaseStoreName ?? "").trim();
  const review = String(settings.reviewSchemaName ?? "").trim();
  if (impl && review) return true;
  const repo = String(settings.repositoryName ?? "").trim();
  if (!repo) return false;
  const naming = buildProjectDataStoreNaming({ repositoryName: repo });
  return Boolean(naming.implementationSchemaName && naming.reviewSchemaName);
}

export function resolvePlanningDataPersistenceFallbackReason(
  settings?: PlanningDatabaseSettingsV1 | null,
): string | null {
  if (!settings?.enabled) {
    return "데이터 저장소 설정이 비활성화되어 있습니다.";
  }
  if (settings.connectionStatus !== "READY") {
    const err = String(settings.lastErrorMessage ?? "").trim();
    return err || "데이터 저장소 연결 테스트가 완료되지 않았습니다.";
  }
  if (!hasPostgresStoreNaming(settings)) {
    return "프로젝트 데이터 저장소명 또는 스키마명이 아직 생성되지 않았습니다.";
  }
  return null;
}

export function resolvePlanningDataPersistenceMode(input: Readonly<{
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
  readonly dataStoreSlot?: DataStoreSlotV1 | null;
}>): PlanningDataPersistenceMode {
  const settings = input.planningDatabaseSettings;
  if (settings?.enabled && settings.connectionStatus === "READY" && hasPostgresStoreNaming(settings)) {
    return "POSTGRES_SAMPLE_DB";
  }
  if (input.dataStoreSlot?.enabled && input.dataStoreSlot.status !== "EMPTY") {
    return "POSTGRES_SAMPLE_DB";
  }
  return "MOCK_JSON_FALLBACK";
}

export function implementationDbSlotOverridesForPlanningPersistence(
  mode: PlanningDataPersistenceMode,
): Readonly<{
  readonly data_persistence_mode: string;
  readonly db_required: boolean;
  readonly storage_strategy: string;
  readonly migration_required: boolean;
}> {
  if (mode === "POSTGRES_SAMPLE_DB") {
    return {
      data_persistence_mode: "db",
      db_required: true,
      storage_strategy: "PostgreSQL sample DB + Platform Runtime API",
      migration_required: true,
    };
  }
  return {
    data_persistence_mode: "mock",
    db_required: false,
    storage_strategy: "Mock JSON fallback (데이터 저장소 미설정)",
    migration_required: false,
  };
}