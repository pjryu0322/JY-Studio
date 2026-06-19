import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type { ProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";

export type DatabaseUsageMode =
  | "UNSELECTED"
  | "DISABLED_JSON_SAMPLE"
  | "ENABLED_PROJECT_DATABASE"
  | "ENABLED_POSTGRESQL";

export function isDatabaseUsageEnabledMode(usage: DatabaseUsageMode): boolean {
  return usage === "ENABLED_PROJECT_DATABASE" || usage === "ENABLED_POSTGRESQL";
}

export function resolveDatabaseUsageMode(
  settings?: PlanningDatabaseSettingsV1 | null,
): DatabaseUsageMode {
  if (!settings) return "UNSELECTED";
  const explicit = settings.usageMode;
  if (
    explicit === "UNSELECTED" ||
    explicit === "DISABLED_JSON_SAMPLE" ||
    explicit === "ENABLED_PROJECT_DATABASE" ||
    explicit === "ENABLED_POSTGRESQL"
  ) {
    if (explicit === "ENABLED_POSTGRESQL") return "ENABLED_PROJECT_DATABASE";
    return explicit;
  }
  if (settings.usageSelectionCommitted) {
    return settings.enabled ? "ENABLED_PROJECT_DATABASE" : "DISABLED_JSON_SAMPLE";
  }
  if (settings.enabled) return "ENABLED_PROJECT_DATABASE";
  return "UNSELECTED";
}

export function normalizePlanningDatabaseSettingsUsageOnSave(
  settings: PlanningDatabaseSettingsV1,
): PlanningDatabaseSettingsV1 {
  const usageMode: DatabaseUsageMode = settings.enabled
    ? "ENABLED_PROJECT_DATABASE"
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
      : settings.projectDbStatus === "CREATED"
        ? "CREATED"
        : (settings.projectDbStatus ?? "PLANNED");
  return {
    ...settings,
    usageMode,
    usageSelectionCommitted: true,
    enabled: usageMode === "ENABLED_PROJECT_DATABASE",
    connectionStatus,
    projectDbStatus,
  };
}
