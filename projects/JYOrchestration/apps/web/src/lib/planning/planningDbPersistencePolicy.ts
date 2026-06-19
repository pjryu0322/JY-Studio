import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { PlanningHandoffForImplementationV1 } from "@/lib/planning/planningDataSlotsV1";
import {
  resolveDatabaseUsageMode,
  type DatabaseUsageMode,
} from "@/lib/planning/planningDatabaseUsageMode";
import {
  buildProjectDataStoreNaming,
  type ProjectDataStoreNaming,
} from "@/lib/planning/projectDataStoreNaming";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";

export type PlanningDatabaseReadinessV1 =
  | "USAGE_UNSELECTED"
  | "DISABLED_JSON_SAMPLE"
  | "READY"
  | "CONFIG_REQUIRED"
  | "CONNECTION_TEST_REQUIRED"
  | "CONNECTION_FAILED"
  | "STORE_NAMING_REQUIRED"
  | "BLOCKED_DATABASE_REQUIRED";

export type PlanningDataPersistenceMode =
  | "JSON_SAMPLE_DATA"
  | "POSTGRES_SAMPLE_DB"
  | "BLOCKED_DATABASE_USAGE_UNSELECTED"
  | "BLOCKED_DATABASE_REQUIRED";

/**
 * @deprecated 사용자 플로우에서는 사용하지 않는다.
 */
export type DeprecatedPlanningDataPersistenceMode = "MOCK_JSON_FALLBACK";

export type PlanningHandoffStatus =
  | "READY"
  | "BLOCKED_DATABASE_USAGE_UNSELECTED"
  | "BLOCKED_DATABASE_REQUIRED";

export type ImplementationPrepDatabaseBlockKind =
  | "none"
  | "usage_unselected"
  | "database_required";

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
  if (resolveDatabaseUsageMode(settings) !== "ENABLED_POSTGRESQL") return false;
  if (settings?.provider !== "POSTGRESQL") return false;
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
  const usage = resolveDatabaseUsageMode(settings);
  if (usage === "UNSELECTED") {
    return "데이터베이스 사용 여부를 선택해 주세요.";
  }
  if (usage === "DISABLED_JSON_SAMPLE") {
    return "";
  }
  if (!settings?.enabled) {
    return "PostgreSQL 설정과 연결 테스트가 필요합니다.";
  }
  if (settings.connectionStatus === "FAILED") {
    const err = String(settings.lastErrorMessage ?? "").trim();
    return err || "데이터 저장소 연결 테스트에 실패했습니다. 설정을 확인한 뒤 다시 테스트해 주세요.";
  }
  if (settings.connectionStatus !== "READY") {
    return "데이터 저장소 연결 테스트를 완료해야 PostgreSQL 샘플 DB를 사용할 수 있습니다.";
  }
  if (!hasPostgresStoreNaming(settings)) {
    return "프로젝트 데이터 저장소명 또는 스키마명이 아직 생성되지 않았습니다.";
  }
  return "PostgreSQL 설정과 연결 테스트가 필요합니다.";
}

/** @deprecated Renamed to resolvePlanningDatabaseBlockingReason */
export function resolvePlanningDataPersistenceFallbackReason(
  settings?: PlanningDatabaseSettingsV1 | null,
): string | null {
  const usage = resolveDatabaseUsageMode(settings);
  if (usage === "DISABLED_JSON_SAMPLE") return null;
  if (isPlanningDatabaseReady(settings)) return null;
  return resolvePlanningDatabaseBlockingReason(settings);
}

export function normalizePlanningDataPersistenceMode(
  raw: string | null | undefined,
): PlanningDataPersistenceMode {
  if (raw === "JSON_SAMPLE_DATA") return "JSON_SAMPLE_DATA";
  if (raw === "POSTGRES_SAMPLE_DB") return "POSTGRES_SAMPLE_DB";
  if (raw === "BLOCKED_DATABASE_USAGE_UNSELECTED") return "BLOCKED_DATABASE_USAGE_UNSELECTED";
  if (raw === "MOCK_JSON_FALLBACK") return "BLOCKED_DATABASE_REQUIRED";
  if (raw === "BLOCKED_DATABASE_REQUIRED") return "BLOCKED_DATABASE_REQUIRED";
  return "BLOCKED_DATABASE_USAGE_UNSELECTED";
}

export function resolvePlanningDataPersistenceMode(input: Readonly<{
  readonly planningDatabaseSettings?: PlanningDatabaseSettingsV1 | null;
}>): PlanningDataPersistenceMode {
  const usage = resolveDatabaseUsageMode(input.planningDatabaseSettings);
  if (usage === "UNSELECTED") return "BLOCKED_DATABASE_USAGE_UNSELECTED";
  if (usage === "DISABLED_JSON_SAMPLE") return "JSON_SAMPLE_DATA";
  if (isPlanningDatabaseReady(input.planningDatabaseSettings)) return "POSTGRES_SAMPLE_DB";
  return "BLOCKED_DATABASE_REQUIRED";
}

export function resolvePlanningHandoffStatus(
  mode: PlanningDataPersistenceMode,
): PlanningHandoffStatus {
  if (mode === "POSTGRES_SAMPLE_DB" || mode === "JSON_SAMPLE_DATA") return "READY";
  if (mode === "BLOCKED_DATABASE_USAGE_UNSELECTED") return "BLOCKED_DATABASE_USAGE_UNSELECTED";
  return "BLOCKED_DATABASE_REQUIRED";
}

export function isPlanningDataPersistenceModeBlocked(
  mode: PlanningDataPersistenceMode | string | null | undefined,
): boolean {
  const normalized = normalizePlanningDataPersistenceMode(String(mode ?? ""));
  return (
    normalized === "BLOCKED_DATABASE_USAGE_UNSELECTED" || normalized === "BLOCKED_DATABASE_REQUIRED"
  );
}

export function isPlanningHandoffBlockedByDatabase(
  handoff?: PlanningHandoffForImplementationV1 | null,
): boolean {
  if (!handoff) return true;
  if (handoff.status === "BLOCKED_DATABASE_USAGE_UNSELECTED") return true;
  if (handoff.status === "BLOCKED_DATABASE_REQUIRED") return true;
  if (handoff.implementationDataPlan?.blocked === true) return true;
  const mode = handoff.implementationDataPlan?.dataPersistenceMode ?? handoff.implementationDefaults.dataPersistenceMode;
  return isPlanningDataPersistenceModeBlocked(mode);
}

export function isPlanningHandoffReadyForImplementationPrep(
  handoff?: PlanningHandoffForImplementationV1 | null,
): boolean {
  if (!handoff || handoff.implementationDataPlan?.blocked) return false;
  const mode = handoff.implementationDataPlan?.dataPersistenceMode;
  return mode === "JSON_SAMPLE_DATA" || mode === "POSTGRES_SAMPLE_DB";
}

export function resolveImplementationPrepDatabaseBlockKind(
  handoff?: PlanningHandoffForImplementationV1 | null,
): ImplementationPrepDatabaseBlockKind {
  if (!handoff) return "usage_unselected";
  const mode = handoff.implementationDataPlan?.dataPersistenceMode;
  if (
    mode === "BLOCKED_DATABASE_USAGE_UNSELECTED" ||
    handoff.status === "BLOCKED_DATABASE_USAGE_UNSELECTED"
  ) {
    return "usage_unselected";
  }
  if (isPlanningHandoffBlockedByDatabase(handoff)) return "database_required";
  return "none";
}

export function resolvePlanningDatabaseReadinessV1(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
  naming: ProjectDataStoreNaming | null | undefined,
): PlanningDatabaseReadinessV1 {
  const usage = resolveDatabaseUsageMode(settings);
  if (usage === "UNSELECTED") return "USAGE_UNSELECTED";
  if (usage === "DISABLED_JSON_SAMPLE") return "DISABLED_JSON_SAMPLE";

  if (!settings) return "CONFIG_REQUIRED";
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
    case "USAGE_UNSELECTED":
      return {
        title: "데이터베이스 사용 여부 선택",
        detail:
          "데이터베이스를 사용하지 않으면 JSON 샘플데이터로 구현단계를 진행합니다. 사용하면 PostgreSQL 연결 설정과 연결 테스트가 필요합니다.",
        level: "empty",
      };
    case "DISABLED_JSON_SAMPLE":
      return {
        title: "데이터베이스 미사용",
        detail: "구현단계에서는 JSON 샘플데이터를 생성하여 화면과 기능 흐름을 확인합니다.",
        level: "filled",
      };
    case "READY":
      return {
        title: "데이터 저장소",
        detail: "PostgreSQL 연결 완료 · 구현단계 샘플 DB를 사용할 수 있습니다.",
        level: "filled",
      };
    case "CONFIG_REQUIRED":
      return {
        title: "PostgreSQL 설정 필요",
        detail:
          "데이터베이스 사용을 선택했기 때문에 Host, Database, Username, Password 입력과 연결 테스트가 필요합니다.",
        level: "partial",
      };
    case "CONNECTION_TEST_REQUIRED":
      return {
        title: "PostgreSQL 연결 테스트 필요",
        detail: "연결 테스트를 완료해야 PostgreSQL 샘플 DB를 사용할 수 있습니다.",
        level: "partial",
      };
    case "CONNECTION_FAILED":
      return {
        title: "PostgreSQL 연결 실패",
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
        title: "PostgreSQL 설정 필요",
        detail: "PostgreSQL 설정과 연결 테스트가 필요합니다.",
        level: "partial",
      };
  }
}

export function resolvePlanningDatabaseBlockingReasonForReadiness(
  readiness: PlanningDatabaseReadinessV1,
  settings?: PlanningDatabaseSettingsV1 | null,
): string {
  if (readiness === "READY" || readiness === "DISABLED_JSON_SAMPLE") return "";
  if (readiness === "CONNECTION_FAILED") {
    const err = String(settings?.lastErrorMessage ?? "").trim();
    return err || planningDatabaseReadinessUserDisplay("CONNECTION_FAILED").detail;
  }
  return planningDatabaseReadinessUserDisplay(readiness).detail;
}

export function planningDatabaseSettingsActionLabel(
  readiness: PlanningDatabaseReadinessV1,
): string | null {
  if (readiness === "READY" || readiness === "DISABLED_JSON_SAMPLE") return null;
  return PLANNING_DATABASE_SETUP_LABEL;
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
  if (mode === "JSON_SAMPLE_DATA") {
    return {
      data_persistence_mode: "json_sample",
      db_required: false,
      storage_strategy: "JSON sample data (planning-selected, no PostgreSQL)",
      migration_required: false,
    };
  }
  return {
    data_persistence_mode: "blocked_database_required",
    db_required: true,
    storage_strategy: "Database usage selection or PostgreSQL setup required before implementation",
    migration_required: false,
  };
}

export { resolveDatabaseUsageMode, type DatabaseUsageMode };
