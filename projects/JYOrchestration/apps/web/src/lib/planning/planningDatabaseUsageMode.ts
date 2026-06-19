import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

export type DatabaseUsageMode = "UNSELECTED" | "DISABLED_JSON_SAMPLE" | "ENABLED_POSTGRESQL";

export function resolveDatabaseUsageMode(
  settings?: PlanningDatabaseSettingsV1 | null,
): DatabaseUsageMode {
  if (!settings) return "UNSELECTED";
  const explicit = settings.usageMode;
  if (
    explicit === "UNSELECTED" ||
    explicit === "DISABLED_JSON_SAMPLE" ||
    explicit === "ENABLED_POSTGRESQL"
  ) {
    return explicit;
  }
  if (settings.usageSelectionCommitted) {
    return settings.enabled ? "ENABLED_POSTGRESQL" : "DISABLED_JSON_SAMPLE";
  }
  // Legacy persisted settings (enabled without usageMode)
  if (settings.enabled) return "ENABLED_POSTGRESQL";
  return "UNSELECTED";
}

export function normalizePlanningDatabaseSettingsUsageOnSave(
  settings: PlanningDatabaseSettingsV1,
): PlanningDatabaseSettingsV1 {
  const usageMode: DatabaseUsageMode = settings.enabled
    ? "ENABLED_POSTGRESQL"
    : "DISABLED_JSON_SAMPLE";
  const connectionStatus =
    usageMode === "DISABLED_JSON_SAMPLE"
      ? "NOT_REQUIRED"
      : settings.connectionStatus === "NOT_REQUIRED"
        ? "NOT_CONFIGURED"
        : settings.connectionStatus;
  return {
    ...settings,
    usageMode,
    usageSelectionCommitted: true,
    enabled: usageMode === "ENABLED_POSTGRESQL",
    connectionStatus,
  };
}
