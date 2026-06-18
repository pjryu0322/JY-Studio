import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { PlanningHandoffForImplementationV1 } from "@/lib/planning/planningDataSlotsV1";
import {
  buildProjectDataStoreNaming,
  type ProjectDataStoreNaming,
} from "@/lib/planning/projectDataStoreNaming";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";

export type PlanningDatabaseReadinessV1 =
  | "READY"
  | "CONFIG_REQUIRED"
  | "CONNECTION_TEST_REQUIRED"
  | "CONNECTION_FAILED"
  | "STORE_NAMING_REQUIRED"
  | "BLOCKED_DATABASE_REQUIRED";

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
  if (handoff.implementationDataPlan?.blocked === true) return true;
  return handoff.implementationDefaults.dataPersistenceMode !== "POSTGRES_SAMPLE_DB";
}

export function resolvePlanningDatabaseReadinessV1(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
  naming: ProjectDataStoreNaming | null | undefined,
): PlanningDatabaseReadinessV1 {
  if (!settings?.enabled) return "CONFIG_REQUIRED";
  if (settings.provider !== "POSTGRESQL") return "CONFIG_REQUIRED";
  if (!String(settings.host ?? "").trim()) return "CONFIG_REQUIRED";
  if (!String(settings.database ?? "").trim()) return "CONFIG_REQUIRED";
  if (!String(settings.username ?? "").trim()) return "CONFIG_REQUIRED";
  if (settings.connectionStatus === "FAILED") return "CONNECTION_FAILED";
  if (settings.connectionStatus !== "READY") return "CONNECTION_TEST_REQUIRED";
  const implSchema =
    String(settings.implementationSchemaName ?? naming?.implementationSchemaName ?? "").trim();
  const reviewSchema = String(settings.reviewSchemaName ?? naming?.reviewSchemaName ?? "").trim();
  if (!implSchema || !reviewSchema) return "STORE_NAMING_REQUIRED";
  return "READY";
}

export function planningDatabaseReadinessUserDisplay(readiness: PlanningDatabaseReadinessV1): Readonly<{
  readonly title: string;
  readonly detail: string;
  readonly level: "filled" | "partial" | "empty";
}> {
  switch (readiness) {
    case "READY":
      return {
        title: "데이터 저장소",
        detail: "PostgreSQL 연결 완료 · 구현단계 샘플 DB를 사용할 수 있습니다.",
        level: "filled",
      };
    case "CONFIG_REQUIRED":
      return {
        title: "데이터 저장소 설정 필요",
        detail: "PostgreSQL 접속 정보를 입력해 주세요.",
        level: "partial",
      };
    case "CONNECTION_TEST_REQUIRED":
      return {
        title: "데이터베이스 연결 테스트 필요",
        detail: "PostgreSQL 연결 테스트를 완료해야 구현단계로 넘어갈 수 있습니다.",
        level: "partial",
      };
    case "CONNECTION_FAILED":
      return {
        title: "데이터베이스 연결 실패",
        detail: "접속 정보를 확인한 뒤 다시 테스트해 주세요.",
        level: "partial",
      };
    case "STORE_NAMING_REQUIRED":
      return {
        title: "프로젝트 데이터 저장소명 필요",
        detail: "Repository 저장소명을 기준으로 데이터 저장소명을 생성해 주세요.",
        level: "partial",
      };
    case "BLOCKED_DATABASE_REQUIRED":
    default:
      return {
        title: "구현단계 진행 불가",
        detail: "PostgreSQL 설정과 연결 테스트를 완료해야 합니다.",
        level: "partial",
      };
  }
}

export function resolvePlanningDatabaseBlockingReasonForReadiness(
  readiness: PlanningDatabaseReadinessV1,
  settings?: PlanningDatabaseSettingsV1 | null,
): string {
  if (readiness === "READY") return "";
  if (readiness === "CONNECTION_FAILED") {
    const err = String(settings?.lastErrorMessage ?? "").trim();
    return err || planningDatabaseReadinessUserDisplay("CONNECTION_FAILED").detail;
  }
  return planningDatabaseReadinessUserDisplay(readiness).detail;
}

export function planningDatabaseSettingsActionLabel(
  readiness: PlanningDatabaseReadinessV1,
): string | null {
  return readiness === "READY" ? null : PLANNING_DATABASE_SETUP_LABEL;
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
