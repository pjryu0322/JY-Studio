import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { normalizeLegacyDatabaseUsageMode } from "@/lib/planning/projectDataStoreLegacyNormalize";
import {
  normalizeLegacyProjectDbFailureReason,
  normalizeLegacySchemaLifecycleStatus,
} from "@/lib/planning/projectDataStoreLegacyNormalize";
import type { SchemaLifecycleStatus } from "@/lib/planning/projectDataStoreTypes";
import type { ProjectSchemaStoreFailureReason } from "@/lib/planning/projectSchemaStoreFailure";

type LegacyPlanningDatabaseSettings = PlanningDatabaseSettingsV1 & {
  readonly projectDbName?: string | null;
  readonly projectDbStatus?: string | null;
  readonly projectDbFailureReason?: string | null;
};

export function stripLegacyProjectDbFieldsFromSettings(
  settings: LegacyPlanningDatabaseSettings,
): PlanningDatabaseSettingsV1 {
  const copy = { ...settings } as Record<string, unknown>;
  delete copy.projectDbName;
  delete copy.projectDbStatus;
  delete copy.projectDbFailureReason;
  return copy as PlanningDatabaseSettingsV1;
}

export function canonicalizePlanningDatabaseSettingsV1(
  settings: LegacyPlanningDatabaseSettings,
): PlanningDatabaseSettingsV1 {
  const legacyStatus = normalizeLegacySchemaLifecycleStatus(settings.projectDbStatus);
  const dataStoreStatus: SchemaLifecycleStatus | undefined =
    settings.dataStoreStatus ?? legacyStatus ?? undefined;
  const dataStoreFailureReason: ProjectSchemaStoreFailureReason | null | undefined =
    settings.dataStoreFailureReason ??
    normalizeLegacyProjectDbFailureReason(settings.projectDbFailureReason) ??
    undefined;
  const projectStoreName =
    String(settings.projectStoreName ?? "").trim() ||
    String(settings.databaseStoreName ?? "").trim() ||
    String(settings.projectDbName ?? "").trim() ||
    null;
  const usageMode =
    normalizeLegacyDatabaseUsageMode(String(settings.usageMode ?? "")) ?? settings.usageMode;

  return stripLegacyProjectDbFieldsFromSettings({
    ...settings,
    usageMode,
    dataStoreStatus,
    dataStoreFailureReason: dataStoreFailureReason ?? null,
    projectStoreName: projectStoreName || settings.projectStoreName || null,
  });
}

/** Removes legacy projectDb* keys before persisting to jyorchestration. */
export function planningDatabaseSettingsForPersistence(
  settings: PlanningDatabaseSettingsV1,
): PlanningDatabaseSettingsV1 {
  return stripLegacyProjectDbFieldsFromSettings(
    canonicalizePlanningDatabaseSettingsV1(settings as LegacyPlanningDatabaseSettings),
  );
}
