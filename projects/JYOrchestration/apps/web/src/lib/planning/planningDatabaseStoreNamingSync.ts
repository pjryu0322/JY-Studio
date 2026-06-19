import {
  buildProjectDataStoreNaming,
  extractRepositoryBaseNameFromGitRepoName,
  type ProjectDataStoreNaming,
} from "@/lib/planning/projectDataStoreNaming";
import {
  isDatabaseUsageEnabledMode,
  resolveDatabaseUsageMode,
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
  JYPROJECTS_RUNTIME_DATABASE_NAME,
} from "@/lib/planning/planningDatabaseUsageMode";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { readEffectiveImplementationSchemaStatus } from "@/lib/planning/planningDataStoreSettingsAdapter";

export function resolveRepositoryNameForPlanningDbSettings(input: Readonly<{
  readonly gitRepoName?: string | null;
  readonly repositoryName?: string | null;
  readonly projectName?: string | null;
}>): string {
  const fromField = String(input.repositoryName ?? "").trim();
  if (fromField) return fromField;
  const fromGit = extractRepositoryBaseNameFromGitRepoName(input.gitRepoName);
  if (fromGit) return fromGit;
  return String(input.projectName ?? "").trim() || "project";
}

export function applyProjectDataStoreNamingToPlanningDatabaseSettings(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly naming: ProjectDataStoreNaming;
}>): PlanningDatabaseSettingsV1 {
  return {
    ...input.settings,
    repositoryName: input.naming.repositoryName,
    databaseStoreName: input.naming.normalizedBaseName,
    implementationSchemaName: input.naming.implementationSchemaName,
    reviewSchemaName: input.naming.reviewSchemaName,
    schemaStrategy: "PROJECT_STAGE_SCHEMA",
  };
}

export function syncPlanningDatabaseSettingsStoreNames(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly gitRepoName?: string | null;
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly preserveManualStoreName?: boolean;
}>): PlanningDatabaseSettingsV1 {
  const repositoryName = resolveRepositoryNameForPlanningDbSettings({
    gitRepoName: input.gitRepoName,
    repositoryName: input.settings.repositoryName,
    projectName: input.projectName,
  });
  const usage = resolveDatabaseUsageMode(input.settings);
  const naming = buildProjectDataStoreNaming({
    repositoryName,
    projectId: input.projectId,
    includeProjectIdSuffix: false,
  });

  if (isDatabaseUsageEnabledMode(usage)) {
    const priorStatus = readEffectiveImplementationSchemaStatus(input.settings);
    const dataStoreStatus =
      priorStatus === "CREATED" ? "CREATED" : priorStatus === "FAILED" ? "FAILED" : "PLANNED";
    return {
      ...input.settings,
      repositoryName,
      databaseStoreName: naming.normalizedBaseName,
      implementationSchemaName: naming.implementationSchemaName,
      reviewSchemaName: naming.reviewSchemaName,
      schemaStrategy: "PROJECT_STAGE_SCHEMA",
      dataStoreStatus,
      projectStoreName: naming.normalizedBaseName,
      platformManagementDatabaseName: JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
      generatedProjectDataDatabaseName: JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
      runtimeDatabaseName: JYPROJECTS_RUNTIME_DATABASE_NAME,
      connectionStatus: "NOT_CONFIGURED",
    };
  }

  return applyProjectDataStoreNamingToPlanningDatabaseSettings({
    settings: input.settings,
    naming,
  });
}
