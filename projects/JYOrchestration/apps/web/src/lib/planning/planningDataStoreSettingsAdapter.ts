import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  readProjectDatabaseCreationFailureReason,
  type ProjectDatabaseCreationFailureReason,
} from "@/lib/planning/projectDatabaseCreationFailure";
import {
  readProjectDatabaseLifecycleStatus,
  type ProjectDatabaseLifecycleStatus,
} from "@/lib/planning/projectDatabaseLifecycle";
import type {
  PlanningSchemaRecordV1,
  ProjectSchemaFailureReason,
  SchemaLifecycleStatus,
} from "@/lib/planning/projectDataStoreTypes";
import type { ProjectSchemaStoreFailureReason } from "@/lib/planning/projectSchemaStoreFailure";

export type { PlanningSchemaRecordV1, ProjectSchemaFailureReason, SchemaLifecycleStatus };

function mapLegacyDbStatus(
  legacy: ProjectDatabaseLifecycleStatus | null,
): SchemaLifecycleStatus {
  if (!legacy || legacy === "DELETING" || legacy === "DELETED") {
    return legacy === "NOT_REQUIRED" ? "NOT_REQUIRED" : "FAILED";
  }
  return legacy;
}

export function readProjectStoreName(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): string | null {
  const fromNew = String(settings?.projectStoreName ?? "").trim();
  if (fromNew) return fromNew;
  return (
    String(settings?.databaseStoreName ?? "").trim() ||
    String(settings?.implementationSchemaName ?? "")
      .replace(/_impl_sample$/i, "")
      .trim() ||
    null
  );
}

export function readEffectiveImplementationSchemaStatus(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): SchemaLifecycleStatus {
  const impl = settings?.implementationSchema;
  if (impl?.status) return impl.status;
  const dataStoreStatus = settings?.dataStoreStatus;
  if (dataStoreStatus) return dataStoreStatus;
  const legacy = readProjectDatabaseLifecycleStatus(settings?.projectDbStatus);
  return mapLegacyDbStatus(legacy);
}

export function readEffectiveDataStoreFailureReason(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): ProjectSchemaFailureReason | ProjectDatabaseCreationFailureReason | null {
  const fromSchema = settings?.implementationSchema?.failureReason;
  if (fromSchema) return fromSchema;
  const fromDataStore = settings?.dataStoreFailureReason;
  if (fromDataStore) return fromDataStore;
  return readProjectDatabaseCreationFailureReason(settings?.projectDbFailureReason);
}

function mapSchemaFailureToLegacyReason(
  reason: ProjectSchemaStoreFailureReason,
): ProjectDatabaseCreationFailureReason {
  switch (reason) {
    case "JYPROJECTS_CONFIG_MISSING":
      return "POSTGRES_ADMIN_CONFIG_MISSING";
    case "JYPROJECTS_CONNECTION_FAILED":
      return "POSTGRES_CONNECTION_FAILED";
    case "CREATE_SCHEMA_PERMISSION_DENIED":
      return "CREATE_DATABASE_PERMISSION_DENIED";
    case "INVALID_SCHEMA_NAME":
      return "INVALID_DATABASE_NAME";
    default:
      return "UNKNOWN";
  }
}

export function buildDataStoreFailureSettingsPatch(input: Readonly<{
  readonly prior: PlanningDatabaseSettingsV1;
  readonly implementationSchemaName: string | null;
  readonly failureReason: ProjectSchemaStoreFailureReason;
  readonly adminMessage: string;
  readonly nowIso: string;
}>): Partial<PlanningDatabaseSettingsV1> {
  const legacyReason = mapSchemaFailureToLegacyReason(input.failureReason);
  const projectStoreName = readProjectStoreName(input.prior);
  const implName =
    String(input.implementationSchemaName ?? input.prior.implementationSchemaName ?? "").trim() || null;
  const implementationSchema: PlanningSchemaRecordV1 = {
    name: implName,
    status: "FAILED",
    failureReason: input.failureReason,
    errorMessage: input.adminMessage.slice(0, 500),
    createdAt: input.prior.implementationSchema?.createdAt ?? null,
  };

  return {
    ...input.prior,
    projectStoreName,
    dataStoreStatus: "FAILED",
    dataStoreFailureReason: input.failureReason,
    implementationSchema,
    projectDbStatus: "FAILED",
    projectDbFailureReason: legacyReason,
    connectionStatus: "FAILED",
    lastErrorMessage: input.adminMessage.slice(0, 500),
    lastCheckedAt: input.nowIso,
  };
}

export function buildDataStoreSuccessSettingsPatch(input: Readonly<{
  readonly prior: PlanningDatabaseSettingsV1;
  readonly implementationSchemaName: string;
  readonly nowIso: string;
}>): Partial<PlanningDatabaseSettingsV1> {
  const projectStoreName = readProjectStoreName(input.prior);
  const implementationSchema: PlanningSchemaRecordV1 = {
    name: input.implementationSchemaName,
    status: "CREATED",
    failureReason: null,
    errorMessage: null,
    createdAt: input.nowIso,
  };
  return {
    projectStoreName,
    dataStoreStatus: "CREATED",
    dataStoreFailureReason: null,
    implementationSchema,
    projectDbStatus: "CREATED",
    projectDbFailureReason: null,
    connectionStatus: "READY",
    lastErrorMessage: null,
    lastCheckedAt: input.nowIso,
  };
}
