import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { DataStoreSlotV1 } from "@/lib/planning/planningDataSlotsV1";

export type PlanningDataPersistenceMode = "POSTGRES_SAMPLE_DB" | "MOCK_JSON_FALLBACK";

export function resolvePlanningDataPersistenceMode(input: Readonly<{
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
  readonly dataStoreSlot?: DataStoreSlotV1 | null;
}>): PlanningDataPersistenceMode {
  const settings = input.planningDatabaseSettings;
  if (settings?.enabled && settings.connectionStatus === "READY") {
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
