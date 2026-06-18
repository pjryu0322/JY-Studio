import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { PlanningHandoffForImplementationV1 } from "@/lib/planning/planningDataSlotsV1";
import { buildProjectDataStoreNaming } from "@/lib/planning/projectDataStoreNaming";

export type PlanningDataPersistenceMode = "POSTGRES_SAMPLE_DB" | "BLOCKED_DATABASE_REQUIRED";

/**
 * @deprecated 사용자 플로우에서는 사용하지 않는다. PostgreSQL 미준비 시 `BLOCKED_DATABASE_REQUIRED`.
 */
export type DeprecatedPlanningDataPersistenceMode = "MOCK_JSON_FALLBACK";

export type PlanningHandoffStatus = "READY" | "BLOCKED_DATABASE_REQUIRED";

function hasPostgresStoreNaming(settings: PlanningDatabaseSettingsV1): boolean {
  const impl = String(settings.implementationSchemaName ?? settings.databaseStoreName ?? "").trim();
  const review = String(settings.reviewSchemaName ?? "").trim();
  if (impl && review) return true;
  const repo = String(settings.repositoryName ?? "").trim();
  if (!repo) return false;
  const naming = buildProjectDataStoreNaming({ repositoryName: repo });
  return Boolean(naming.implementationSchemaName && naming.reviewSchemaName);
}

export function isPlanningDatabaseReady(settings?: PlanningDatabaseSettingsV1 | null): boolean {
  if (!settings?.enabled) return false;
  if (settings.provider !== "POSTGRESQL") return false;
  if (!String(settings.host ?? "").trim()) return false;
  if (!String(settings.database ?? "").trim()) return false;
  if (!String(settings.username ?? "").trim()) return false;
  if (settings.connectionStatus !== "READY") return false;
  if (!hasPostgresStoreNaming(settings)) return false;
  return true;
}

export function resolvePlanningDatabaseBlockingReason(
  settings?: PlanningDatabaseSettingsV1 | null,
): string {
  if (!settings?.enabled) {
    return "데이터 저장소 설정이 필요합니다. PostgreSQL 연결 설정을 완료해 주세요.";
  }
  if (settings.connectionStatus === "FAILED") {
    const err = String(settings.lastErrorMessage ?? "").trim();
    return err || "데이터 저장소 연결 테스트에 실패했습니다. 설정을 확인한 뒤 다시 테스트해 주세요.";
  }
  if (settings.connectionStatus !== "READY") {
    return "데이터 저장소 연결 테스트를 완료해야 구현단계로 넘어갈 수 있습니다.";
  }
  if (!hasPostgresStoreNaming(settings)) {
    return "프로젝트 데이터 저장소명 또는 스키마명이 아직 생성되지 않았습니다.";
  }
  return "PostgreSQL 데이터베이스 설정과 연결 테스트가 필요합니다.";
}

/** @deprecated Renamed to resolvePlanningDatabaseBlockingReason */
export function resolvePlanningDataPersistenceFallbackReason(
  settings?: PlanningDatabaseSettingsV1 | null,
): string | null {
  if (isPlanningDatabaseReady(settings)) return null;
  return resolvePlanningDatabaseBlockingReason(settings);
}

export function normalizePlanningDataPersistenceMode(
  raw: string | null | undefined,
): PlanningDataPersistenceMode {
  if (raw === "POSTGRES_SAMPLE_DB") return "POSTGRES_SAMPLE_DB";
  if (raw === "MOCK_JSON_FALLBACK") return "BLOCKED_DATABASE_REQUIRED";
  if (raw === "BLOCKED_DATABASE_REQUIRED") return "BLOCKED_DATABASE_REQUIRED";
  return "BLOCKED_DATABASE_REQUIRED";
}

export function resolvePlanningDataPersistenceMode(input: Readonly<{
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
}>): PlanningDataPersistenceMode {
  if (isPlanningDatabaseReady(input.planningDatabaseSettings)) {
    return "POSTGRES_SAMPLE_DB";
  }
  return "BLOCKED_DATABASE_REQUIRED";
}

export function resolvePlanningHandoffStatus(
  mode: PlanningDataPersistenceMode,
): PlanningHandoffStatus {
  return mode === "POSTGRES_SAMPLE_DB" ? "READY" : "BLOCKED_DATABASE_REQUIRED";
}

export function isPlanningHandoffBlockedByDatabase(
  handoff?: PlanningHandoffForImplementationV1 | null,
): boolean {
  if (!handoff) return true;
  if (handoff.status === "BLOCKED_DATABASE_REQUIRED") return true;
  return handoff.implementationDefaults.dataPersistenceMode !== "POSTGRES_SAMPLE_DB";
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
    data_persistence_mode: "blocked_database_required",
    db_required: true,
    storage_strategy: "PostgreSQL database setup required before implementation",
    migration_required: false,
  };
}
