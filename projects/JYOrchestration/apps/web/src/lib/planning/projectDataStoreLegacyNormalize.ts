import type { DatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { PlanningDataPersistenceMode } from "@/lib/planning/planningDbPersistencePolicy";
import type { SchemaLifecycleStatus } from "@/lib/planning/projectDataStoreTypes";
import type { ProjectSchemaStoreFailureReason } from "@/lib/planning/projectSchemaStoreFailure";
import { readProjectSchemaFailureReason } from "@/lib/planning/projectDataStoreTypes";

/** Legacy usage modes — normalize at parse/adapter boundary only. */
export function normalizeLegacyDatabaseUsageMode(
  value: string | null | undefined,
): DatabaseUsageMode | null {
  const s = String(value ?? "").trim();
  if (s === "UNSELECTED" || s === "DISABLED_JSON_SAMPLE" || s === "ENABLED_JYPROJECTS_SCHEMA") {
    return s;
  }
  if (
    s === "ENABLED_PROJECT_DATABASE" ||
    s === "ENABLED_PLATFORM_SCHEMA" ||
    s === "ENABLED_POSTGRESQL"
  ) {
    return "ENABLED_JYPROJECTS_SCHEMA";
  }
  return null;
}

export function normalizeLegacyDataPersistenceMode(
  value: string | null | undefined,
): PlanningDataPersistenceMode {
  const s = String(value ?? "").trim();
  if (s === "JSON_SAMPLE_DATA") return "JSON_SAMPLE_DATA";
  if (s === "JYPROJECTS_SCHEMA" || s === "PLATFORM_SCHEMA") return "JYPROJECTS_SCHEMA";
  if (s === "PROJECT_DATABASE" || s === "POSTGRES_SAMPLE_DB") return "JYPROJECTS_SCHEMA";
  if (s === "BLOCKED_DATABASE_USAGE_UNSELECTED") return "BLOCKED_DATABASE_USAGE_UNSELECTED";
  if (s === "BLOCKED_SCHEMA_REQUIRED" || s === "BLOCKED_PROJECT_DATABASE_REQUIRED") {
    return "BLOCKED_SCHEMA_REQUIRED";
  }
  if (s === "BLOCKED_DATABASE_REQUIRED" || s === "MOCK_JSON_FALLBACK") {
    return "BLOCKED_DATABASE_REQUIRED";
  }
  return "BLOCKED_DATABASE_USAGE_UNSELECTED";
}

export function normalizeLegacyProjectDbFailureReason(
  value: string | null | undefined,
): ProjectSchemaStoreFailureReason | null {
  const s = String(value ?? "").trim();
  switch (s) {
    case "CREATE_DATABASE_PERMISSION_DENIED":
      return "CREATE_SCHEMA_PERMISSION_DENIED";
    case "POSTGRES_ADMIN_CONFIG_MISSING":
      return "JYPROJECTS_CONFIG_MISSING";
    case "POSTGRES_CONNECTION_FAILED":
      return "JYPROJECTS_CONNECTION_FAILED";
    case "INVALID_DATABASE_NAME":
      return "INVALID_SCHEMA_NAME";
    case "DATABASE_ALREADY_EXISTS_BUT_INACCESSIBLE":
      return "JYPROJECTS_CONNECTION_FAILED";
    default:
      return readProjectSchemaFailureReason(s);
  }
}

export function normalizeLegacySchemaLifecycleStatus(
  value: string | null | undefined,
): SchemaLifecycleStatus | null {
  const s = String(value ?? "").trim();
  if (
    s === "NOT_REQUIRED" ||
    s === "PLANNED" ||
    s === "CREATING" ||
    s === "CREATED" ||
    s === "FAILED"
  ) {
    return s;
  }
  if (s === "DELETING" || s === "DELETED") return "FAILED";
  return null;
}

export function isJyprojectsSchemaPersistenceMode(mode: string | null | undefined): boolean {
  return normalizeLegacyDataPersistenceMode(mode) === "JYPROJECTS_SCHEMA";
}
