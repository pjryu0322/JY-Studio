import type { ProjectSchemaStoreFailureReason } from "@/lib/planning/projectSchemaStoreFailure";

/** @alias ProjectSchemaStoreFailureReason */
export type ProjectSchemaFailureReason = ProjectSchemaStoreFailureReason;

export type SchemaLifecycleStatus =
  | "NOT_REQUIRED"
  | "PLANNED"
  | "CREATING"
  | "CREATED"
  | "FAILED";

export type PlanningSchemaRecordV1 = Readonly<{
  readonly name: string | null;
  readonly status: SchemaLifecycleStatus;
  readonly failureReason?: ProjectSchemaFailureReason | null;
  readonly errorMessage?: string | null;
  readonly createdAt?: string | null;
}>;

export function readSchemaLifecycleStatus(raw: unknown): SchemaLifecycleStatus | null {
  const s = String(raw ?? "").trim();
  if (
    s === "NOT_REQUIRED" ||
    s === "PLANNED" ||
    s === "CREATING" ||
    s === "CREATED" ||
    s === "FAILED"
  ) {
    return s;
  }
  return null;
}

export function readProjectSchemaFailureReason(raw: unknown): ProjectSchemaFailureReason | null {
  const s = String(raw ?? "").trim();
  const reasons: readonly ProjectSchemaFailureReason[] = [
    "JYPROJECTS_CONFIG_MISSING",
    "JYPROJECTS_CONNECTION_FAILED",
    "CREATE_SCHEMA_PERMISSION_DENIED",
    "CREATE_TABLE_FAILED",
    "SEED_INSERT_FAILED",
    "INVALID_SCHEMA_NAME",
    "UNKNOWN",
  ];
  if (reasons.includes(s as ProjectSchemaFailureReason)) {
    return s as ProjectSchemaFailureReason;
  }
  return null;
}
