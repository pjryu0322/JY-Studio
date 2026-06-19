import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { ProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";
import {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
  JYPROJECTS_RUNTIME_DATABASE_NAME,
} from "@/lib/planning/platformDatabaseRoles";

/** Canonical DB usage mode (`jyprojects` runtime DB + project schemas). */
export type DatabaseUsageMode =
  | "UNSELECTED"
  | "DISABLED_JSON_SAMPLE"
  | "ENABLED_JYPROJECTS_SCHEMA"
  | "ENABLED_PLATFORM_SCHEMA"
  | "ENABLED_PROJECT_DATABASE"
  | "ENABLED_POSTGRESQL";

export function normalizeDatabaseUsageMode(raw: DatabaseUsageMode): DatabaseUsageMode {
  if (
    raw === "ENABLED_PROJECT_DATABASE" ||
    raw === "ENABLED_POSTGRESQL" ||
    raw === "ENABLED_PLATFORM_SCHEMA"
  ) {
    return "ENABLED_JYPROJECTS_SCHEMA";
  }
  return raw;
}

export function isDatabaseUsageEnabledMode(usage: DatabaseUsageMode): boolean {
  return (
    usage === "ENABLED_JYPROJECTS_SCHEMA" ||
    usage === "ENABLED_PLATFORM_SCHEMA" ||
    usage === "ENABLED_PROJECT_DATABASE" ||
    usage === "ENABLED_POSTGRESQL"
  );
}

export function resolveDatabaseUsageMode(
  settings?: PlanningDatabaseSettingsV1 | null,
): DatabaseUsageMode {
  if (!settings) return "UNSELECTED";
  const explicit = settings.usageMode;
  if (
    explicit === "UNSELECTED" ||
    explicit === "DISABLED_JSON_SAMPLE" ||
    explicit === "ENABLED_JYPROJECTS_SCHEMA" ||
    explicit === "ENABLED_PLATFORM_SCHEMA" ||
    explicit === "ENABLED_PROJECT_DATABASE" ||
    explicit === "ENABLED_POSTGRESQL"
  ) {
    return normalizeDatabaseUsageMode(explicit);
  }
  if (settings.usageSelectionCommitted) {
    return settings.enabled ? "ENABLED_JYPROJECTS_SCHEMA" : "DISABLED_JSON_SAMPLE";
  }
  if (settings.enabled) return "ENABLED_JYPROJECTS_SCHEMA";
  return "UNSELECTED";
}

export function normalizePlanningDatabaseSettingsUsageOnSave(
  settings: PlanningDatabaseSettingsV1,
): PlanningDatabaseSettingsV1 {
  const usageMode: DatabaseUsageMode = settings.enabled
    ? "ENABLED_JYPROJECTS_SCHEMA"
    : "DISABLED_JSON_SAMPLE";
  const connectionStatus =
    usageMode === "DISABLED_JSON_SAMPLE"
      ? "NOT_REQUIRED"
      : settings.connectionStatus === "NOT_REQUIRED"
        ? "NOT_CONFIGURED"
        : settings.connectionStatus;
  const projectDbStatus: ProjectDatabaseLifecycleStatus =
    usageMode === "DISABLED_JSON_SAMPLE"
      ? "NOT_REQUIRED"
      : settings.projectDbStatus === "FAILED"
        ? "FAILED"
        : settings.projectDbStatus === "CREATED"
          ? "CREATED"
          : "PLANNED";
  return {
    ...settings,
    usageMode,
    usageSelectionCommitted: true,
    enabled: usageMode === "ENABLED_JYPROJECTS_SCHEMA",
    connectionStatus,
    projectDbStatus,
    projectDbFailureReason: usageMode === "ENABLED_JYPROJECTS_SCHEMA" ? null : settings.projectDbFailureReason,
    platformManagementDatabaseName:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA"
        ? JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME
        : null,
    generatedProjectDataDatabaseName:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA"
        ? JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME
        : null,
    runtimeDatabaseName:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA"
        ? JYPROJECTS_RUNTIME_DATABASE_NAME
        : null,
  };
}

export {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
  JYPROJECTS_RUNTIME_DATABASE_NAME,
};
