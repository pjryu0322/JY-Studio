import type { DatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { readEffectiveImplementationSchemaStatus } from "@/lib/planning/planningDataStoreSettingsAdapter";
import type { SchemaLifecycleStatus } from "@/lib/planning/projectDataStoreTypes";
import {
  buildSaveResultNotice,
  buildProjectDataStoreStatusNotice,
} from "@/lib/planning/projectSchemaProvisionFailure";

export function projectDatabaseUserStatusLabel(
  usageMode: DatabaseUsageMode,
  schemaStatus: SchemaLifecycleStatus | null | undefined,
): string {
  if (usageMode === "UNSELECTED") return "선택 필요";
  if (usageMode === "DISABLED_JSON_SAMPLE") return "미사용";

  if (isDatabaseUsageEnabledMode(usageMode)) {
    if (schemaStatus === "CREATED") return "정상";
    if (schemaStatus === "FAILED") return "플랫폼 확인 필요";
    return "준비 예정";
  }

  return "선택 필요";
}

export function projectDatabaseUserCurrentValue(
  usageMode: DatabaseUsageMode,
  schemaStatus: SchemaLifecycleStatus | null | undefined,
  failureReason?: import("@/lib/planning/projectSchemaProvisionFailure").ProjectSchemaProvisionFailureReason | null,
): string {
  if (usageMode === "DISABLED_JSON_SAMPLE") return "JSON 샘플데이터";
  if (usageMode === "UNSELECTED") return "사용 여부 미선택";

  if (isDatabaseUsageEnabledMode(usageMode)) {
    if (schemaStatus === "CREATED") return "프로젝트 저장소 준비 완료";
    if (schemaStatus === "FAILED") return "프로젝트 저장소 권한 확인 필요";
    return "프로젝트 데이터 저장소 사용";
  }

  return "사용 여부 미선택";
}

export function projectDatabaseUserStatusTone(
  usageMode: DatabaseUsageMode,
  schemaStatus: SchemaLifecycleStatus | null | undefined,
): "ok" | "warn" | "fail" | "neutral" {
  if (usageMode === "DISABLED_JSON_SAMPLE") return "neutral";
  if (usageMode === "UNSELECTED") return "warn";
  if (isDatabaseUsageEnabledMode(usageMode)) {
    if (schemaStatus === "CREATED") return "ok";
    if (schemaStatus === "FAILED") return "warn";
    return "neutral";
  }
  return "warn";
}

export function projectDatabaseUserDisplayFromSettings(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): Readonly<{ readonly status: string; readonly currentValue: string; readonly statusTone: "ok" | "warn" | "fail" | "neutral" }> {
  const usage = resolveDatabaseUsageMode(settings);
  const schemaStatus = readEffectiveImplementationSchemaStatus(settings);
  const failureReason = settings?.dataStoreFailureReason ?? settings?.implementationSchema?.failureReason ?? null;
  return {
    status: projectDatabaseUserStatusLabel(usage, schemaStatus),
    currentValue: projectDatabaseUserCurrentValue(usage, schemaStatus, failureReason),
    statusTone: projectDatabaseUserStatusTone(usage, schemaStatus),
  };
}

export function projectDatabaseUserSectionHeadline(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): string {
  const usage = resolveDatabaseUsageMode(settings);
  const schemaStatus = readEffectiveImplementationSchemaStatus(settings);
  if (usage === "UNSELECTED") return "선택 필요";
  if (usage === "DISABLED_JSON_SAMPLE") return "데이터베이스 미사용";
  if (isDatabaseUsageEnabledMode(usage)) {
    if (schemaStatus === "CREATED") return "프로젝트 저장소 준비 완료";
    if (schemaStatus === "FAILED") return "플랫폼 확인 필요";
    return "프로젝트 데이터 저장소 사용";
  }
  return "프로젝트 데이터 저장소";
}

export function projectDatabaseUserInlineStatusCopy(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): string | null {
  const usage = resolveDatabaseUsageMode(settings);
  if (usage === "DISABLED_JSON_SAMPLE") {
    return "데이터베이스를 사용하지 않습니다. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.";
  }
  const notice = buildProjectDataStoreStatusNotice(settings);
  if (notice) return notice.summary;
  return null;
}

/** Message shown after save (settings vs project DB provisioning separated). */
export function projectDatabaseSaveOutcomeMessage(settings: PlanningDatabaseSettingsV1): string {
  return (
    buildSaveResultNotice({
      saved: true,
      dataStoreStatus: readEffectiveImplementationSchemaStatus(settings),
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
