import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import type {
  PlanningSchemaRecordV1,
  ProjectSchemaFailureReason,
  SchemaLifecycleStatus,
} from "@/lib/planning/projectDataStoreTypes";
import type { ProjectSchemaStoreFailureReason } from "@/lib/planning/projectSchemaStoreFailure";

export type { PlanningSchemaRecordV1, ProjectSchemaFailureReason, SchemaLifecycleStatus };

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
  if (settings?.dataStoreStatus) return settings.dataStoreStatus;
  return "PLANNED";
}

export function readEffectiveDataStoreFailureReason(
  settings: PlanningDatabaseSettingsV1 | null | undefined,
): ProjectSchemaStoreFailureReason | null {
  const fromSchema = settings?.implementationSchema?.failureReason;
  if (fromSchema) return fromSchema;
  if (settings?.dataStoreFailureReason) return settings.dataStoreFailureReason;
  return null;
}

export function buildDataStoreFailureSettingsPatch(input: Readonly<{
  readonly prior: PlanningDatabaseSettingsV1;
  readonly implementationSchemaName: string | null;
  readonly failureReason: ProjectSchemaStoreFailureReason;
  readonly adminMessage: string;
  readonly nowIso: string;
}>): Partial<PlanningDatabaseSettingsV1> {
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
    projectStoreName,
    dataStoreStatus: "FAILED",
    dataStoreFailureReason: input.failureReason,
    implementationSchema,
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
    connectionStatus: "READY",
    lastErrorMessage: null,
    lastCheckedAt: input.nowIso,
  };
}
