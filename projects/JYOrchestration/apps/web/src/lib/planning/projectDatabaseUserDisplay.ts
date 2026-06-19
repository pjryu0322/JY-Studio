import type { DatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  readProjectDatabaseLifecycleStatus,
  type ProjectDatabaseLifecycleStatus,
} from "@/lib/planning/projectDatabaseLifecycle";
import {
  buildProjectDatabaseStatusNotice,
  buildSaveResultNotice,
  readProjectDatabaseCreationFailureReason,
} from "@/lib/planning/projectDatabaseCreationFailure";

export function projectDatabaseUserStatusLabel(
  usageMode: DatabaseUsageMode,
  projectDbStatus: ProjectDatabaseLifecycleStatus | null | undefined,
): string {
  if (usageMode === "UNSELECTED") return "선택 필요";
  if (usageMode === "DISABLED_JSON_SAMPLE") return "미사용";

  if (isDatabaseUsageEnabledMode(usageMode)) {
    if (projectDbStatus === "CREATED") return "정상";
    if (projectDbStatus === "FAILED") return "플랫폼 확인 필요";
    return "준비 예정";
  }

  return "선택 필요";
}

export function projectDatabaseUserCurrentValue(
  usageMode: DatabaseUsageMode,
  projectDbStatus: ProjectDatabaseLifecycleStatus | null | undefined,
  failureReason?: import("@/lib/planning/projectDatabaseCreationFailure").ProjectDatabaseCreationFailureReason | null,
): string {
  if (usageMode === "DISABLED_JSON_SAMPLE") return "JSON 샘플데이터";
  if (usageMode === "UNSELECTED") return "사용 여부 미선택";

  if (isDatabaseUsageEnabledMode(usageMode)) {
    if (projectDbStatus === "CREATED") return "프로젝트 저장소 준비 완료";
    if (projectDbStatus === "FAILED") return "관리자 확인 필요";
    return "프로젝트 저장소 자동 준비";
  }

  return "사용 여부 미선택";
}

export function projectDatabaseUserStatusTone(
  usageMode: DatabaseUsageMode,
  projectDbStatus: ProjectDatabaseLifecycleStatus | null | undefined,
): "ok" | "warn" | "fail" | "neutral" {
  if (usageMode === "DISABLED_JSON_SAMPLE") return "neutral";
  if (usageMode === "UNSELECTED") return "warn";
  if (isDatabaseUsageEnabledMode(usageMode)) {
    if (projectDbStatus === "CREATED") return "ok";
    if (projectDbStatus === "FAILED") return "warn";
    return "neutral";
  }
  return "warn";
}

export function projectDatabaseUserDisplayFromSettings(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): Readonly<{ readonly status: string; readonly currentValue: string; readonly statusTone: "ok" | "warn" | "fail" | "neutral" }> {
  const usage = resolveDatabaseUsageMode(settings);
  const projectDbStatus = readProjectDatabaseLifecycleStatus(settings?.projectDbStatus);
  const failureReason = readProjectDatabaseCreationFailureReason(settings?.projectDbFailureReason);
  return {
    status: projectDatabaseUserStatusLabel(usage, projectDbStatus),
    currentValue: projectDatabaseUserCurrentValue(usage, projectDbStatus, failureReason),
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
  if (isDatabaseUsageEnabledMode(usage)) {
    if (projectDbStatus === "CREATED") return "프로젝트 저장소 준비 완료";
    if (projectDbStatus === "FAILED") return "플랫폼 확인 필요";
    return "프로젝트 저장소 자동 준비";
  }
  return "프로젝트 저장소 자동 준비";
}

export function projectDatabaseUserInlineStatusCopy(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): string | null {
  const usage = resolveDatabaseUsageMode(settings);
  if (usage === "DISABLED_JSON_SAMPLE") {
    return "데이터베이스를 사용하지 않습니다. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.";
  }
  const notice = buildProjectDatabaseStatusNotice(settings);
  if (notice) return notice.summary;
  return null;
}

/** Message shown after save (settings vs project DB provisioning separated). */
export function projectDatabaseSaveOutcomeMessage(settings: PlanningDatabaseSettingsV1): string {
  return (
    buildSaveResultNotice({
      saved: true,
      projectDbStatus: settings.projectDbStatus,
      usageMode: resolveDatabaseUsageMode(settings),
    }) ?? "설정이 저장되었습니다."
  );
}

/** @deprecated Prefer projectDatabaseSaveOutcomeMessage after save. */
export function projectDatabaseSaveAckMessage(settings: PlanningDatabaseSettingsV1): string {
  return projectDatabaseSaveOutcomeMessage(settings);
}

/** @deprecated Use projectDatabaseSaveAckMessage after save; use projectDatabaseUserInlineStatusCopy for status area. */
export function projectDatabaseUserSaveResultMessage(settings: PlanningDatabaseSettingsV1): string {
  return projectDatabaseSaveAckMessage(settings);
}
