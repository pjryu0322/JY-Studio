import type { DatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import { resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  readProjectDatabaseLifecycleStatus,
  type ProjectDatabaseLifecycleStatus,
} from "@/lib/planning/projectDatabaseLifecycle";

export function projectDatabaseUserStatusLabel(
  usageMode: DatabaseUsageMode,
  projectDbStatus: ProjectDatabaseLifecycleStatus | null | undefined,
): string {
  if (usageMode === "UNSELECTED") return "선택 필요";
  if (usageMode === "DISABLED_JSON_SAMPLE") return "미사용";

  if (usageMode === "ENABLED_PROJECT_DATABASE") {
    if (projectDbStatus === "CREATED") return "정상";
    if (projectDbStatus === "CREATING") return "준비 중";
    if (projectDbStatus === "FAILED") return "플랫폼 확인 필요";
    return "준비 예정";
  }

  return "선택 필요";
}

export function projectDatabaseUserCurrentValue(
  usageMode: DatabaseUsageMode,
  projectDbStatus: ProjectDatabaseLifecycleStatus | null | undefined,
): string {
  if (usageMode === "DISABLED_JSON_SAMPLE") return "JSON 샘플데이터";
  if (usageMode === "UNSELECTED") return "사용 여부 미선택";

  if (usageMode === "ENABLED_PROJECT_DATABASE") {
    if (projectDbStatus === "CREATED") return "프로젝트 DB 준비 완료";
    if (projectDbStatus === "CREATING") return "프로젝트 DB 생성 중";
    if (projectDbStatus === "FAILED") return "관리자 확인 필요";
    return "프로젝트 DB 자동 준비";
  }

  return "사용 여부 미선택";
}

export function projectDatabaseUserStatusTone(
  usageMode: DatabaseUsageMode,
  projectDbStatus: ProjectDatabaseLifecycleStatus | null | undefined,
): "ok" | "warn" | "fail" | "neutral" {
  if (usageMode === "DISABLED_JSON_SAMPLE") return "neutral";
  if (usageMode === "UNSELECTED") return "warn";
  if (usageMode === "ENABLED_PROJECT_DATABASE") {
    if (projectDbStatus === "CREATED") return "ok";
    if (projectDbStatus === "FAILED") return "warn";
    if (projectDbStatus === "CREATING") return "warn";
    return "neutral";
  }
  return "warn";
}

export function projectDatabaseUserDisplayFromSettings(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): Readonly<{ readonly status: string; readonly currentValue: string; readonly statusTone: "ok" | "warn" | "fail" | "neutral" }> {
  const usage = resolveDatabaseUsageMode(settings);
  const projectDbStatus = readProjectDatabaseLifecycleStatus(settings?.projectDbStatus);
  return {
    status: projectDatabaseUserStatusLabel(usage, projectDbStatus),
    currentValue: projectDatabaseUserCurrentValue(usage, projectDbStatus),
    statusTone: projectDatabaseUserStatusTone(usage, projectDbStatus),
  };
}

export function projectDatabaseUserSectionHeadline(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): string {
  const usage = resolveDatabaseUsageMode(settings);
  const projectDbStatus = readProjectDatabaseLifecycleStatus(settings?.projectDbStatus);
  if (usage === "UNSELECTED") return "선택 필요";
  if (usage === "DISABLED_JSON_SAMPLE") return "데이터베이스 미사용";
  if (projectDbStatus === "CREATED") return "프로젝트 DB 준비 완료";
  if (projectDbStatus === "CREATING") return "프로젝트 DB 준비 중";
  if (projectDbStatus === "FAILED") return "플랫폼 확인 필요";
  return "프로젝트 DB 자동 준비";
}

export function projectDatabaseUserSaveResultMessage(settings: PlanningDatabaseSettingsV1): string {
  const usage = resolveDatabaseUsageMode(settings);
  const projectDbStatus = readProjectDatabaseLifecycleStatus(settings?.projectDbStatus);
  if (usage === "UNSELECTED") {
    return "데이터베이스 사용 여부를 선택해 주세요. 사용하지 않으면 JSON 샘플데이터로 구현단계를 진행합니다. 사용하면 플랫폼이 프로젝트 DB를 자동으로 준비합니다.";
  }
  if (usage === "DISABLED_JSON_SAMPLE") {
    return "데이터베이스 미사용으로 설정되었습니다. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.";
  }
  if (projectDbStatus === "CREATING") {
    return "프로젝트 데이터베이스를 준비하고 있습니다. 잠시 후 다시 확인해 주세요.";
  }
  if (projectDbStatus === "CREATED") {
    return "프로젝트 데이터베이스가 준비되었습니다. 구현단계 진입 시 샘플 저장소가 자동 생성됩니다.";
  }
  if (projectDbStatus === "FAILED") {
    return "프로젝트 데이터베이스를 준비하지 못했습니다. 플랫폼 관리자 설정 또는 PostgreSQL 권한 확인이 필요합니다.";
  }
  return "설정을 저장했습니다.";
}
