import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
  JYPROJECTS_RUNTIME_DATABASE_NAME,
} from "@/lib/planning/platformDatabaseRoles";
import { readEffectiveImplementationSchemaStatus } from "@/lib/planning/planningDataStoreSettingsAdapter";
import type { SchemaLifecycleStatus } from "@/lib/planning/projectDataStoreTypes";

/** Canonical DB usage mode (`jyprojects` runtime DB + project schemas). */
export type DatabaseUsageMode =
  | "UNSELECTED"
  | "DISABLED_JSON_SAMPLE"
  | "ENABLED_JYPROJECTS_SCHEMA";

/** @deprecated Legacy persisted values — normalized at parse boundary. */
export type LegacyDatabaseUsageMode =
  | "ENABLED_PLATFORM_SCHEMA"
  | "ENABLED_PROJECT_DATABASE"
  | "ENABLED_POSTGRESQL";

export function normalizeDatabaseUsageMode(raw: string): DatabaseUsageMode {
  if (raw === "UNSELECTED" || raw === "DISABLED_JSON_SAMPLE" || raw === "ENABLED_JYPROJECTS_SCHEMA") {
    return raw;
  }
  if (
    raw === "ENABLED_PROJECT_DATABASE" ||
    raw === "ENABLED_POSTGRESQL" ||
    raw === "ENABLED_PLATFORM_SCHEMA"
  ) {
    return "ENABLED_JYPROJECTS_SCHEMA";
  }
  return "UNSELECTED";
}

export function isDatabaseUsageEnabledMode(usage: DatabaseUsageMode): boolean {
  return usage === "ENABLED_JYPROJECTS_SCHEMA";
}

export function resolveDatabaseUsageMode(
  settings?: PlanningDatabaseSettingsV1 | null,
): DatabaseUsageMode {
  if (!settings) return "UNSELECTED";
  const explicit = settings.usageMode;
  if (
    explicit === "UNSELECTED" ||
    explicit === "DISABLED_JSON_SAMPLE" ||
    explicit === "ENABLED_JYPROJECTS_SCHEMA"
  ) {
    return explicit;
  }
  if (explicit) {
    return normalizeDatabaseUsageMode(String(explicit));
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
  const priorStatus = readEffectiveImplementationSchemaStatus(settings);
  const dataStoreStatus: SchemaLifecycleStatus =
    usageMode === "DISABLED_JSON_SAMPLE"
      ? "NOT_REQUIRED"
      : priorStatus === "FAILED"
        ? "FAILED"
        : priorStatus === "CREATED"
          ? "CREATED"
          : "PLANNED";
  return {
    ...settings,
    usageMode,
    usageSelectionCommitted: true,
    enabled: usageMode === "ENABLED_JYPROJECTS_SCHEMA",
    connectionStatus,
    dataStoreStatus,
    dataStoreFailureReason:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA" ? null : settings.dataStoreFailureReason,
    platformManagementDatabaseName:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA"
        ? JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME
        : null,
    generatedProjectDataDatabaseName:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA"
        ? JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME
        : null,
    runtimeDatabaseName:
      usageMode === "ENABLED_JYPROJECTS_SCHEMA" ? JYPROJECTS_RUNTIME_DATABASE_NAME : null,
  };
}

export {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
  JYPROJECTS_RUNTIME_DATABASE_NAME,
};
