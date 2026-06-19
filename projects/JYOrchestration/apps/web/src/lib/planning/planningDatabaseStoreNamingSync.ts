import {
  buildProjectDataStoreNaming,
  extractRepositoryBaseNameFromGitRepoName,
  type ProjectDataStoreNaming,
} from "@/lib/planning/projectDataStoreNaming";
import {
  buildProjectDatabaseName,
  PLATFORM_PROJECT_IMPLEMENTATION_SCHEMA,
  PLATFORM_PROJECT_REVIEW_SCHEMA,
} from "@/lib/planning/projectDatabaseNaming";
import { isDatabaseUsageEnabledMode, resolveDatabaseUsageMode } from "@/lib/planning/planningDatabaseUsageMode";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

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
  const projectDbName =
    String(input.settings.projectDbName ?? "").trim() ||
    buildProjectDatabaseName({ projectId: input.projectId, gitRepoName: input.gitRepoName });

  if (isDatabaseUsageEnabledMode(usage)) {
    const naming = buildProjectDataStoreNaming({
      repositoryName,
      projectId: input.projectId,
    });
    const displayName =
      input.preserveManualStoreName && String(input.settings.databaseStoreName ?? "").trim()
        ? String(input.settings.databaseStoreName).trim()
        : naming.normalizedBaseName;
    return {
      ...input.settings,
      repositoryName,
      projectDbName,
      databaseStoreName: displayName,
      implementationSchemaName: PLATFORM_PROJECT_IMPLEMENTATION_SCHEMA,
      reviewSchemaName: PLATFORM_PROJECT_REVIEW_SCHEMA,
      schemaStrategy: "PROJECT_STAGE_SCHEMA",
      projectDbStatus: input.settings.projectDbStatus ?? "PLANNED",
    };
  }

  const naming = buildProjectDataStoreNaming({
    repositoryName,
    projectId: input.projectId,
  });
  const manualBase = String(input.settings.databaseStoreName ?? "").trim();
  if (input.preserveManualStoreName && manualBase) {
    return {
      ...input.settings,
      repositoryName,
      implementationSchemaName: `${manualBase}_impl_sample`,
      reviewSchemaName: `${manualBase}_review_test`,
      schemaStrategy: "PROJECT_STAGE_SCHEMA",
    };
  }
  return applyProjectDataStoreNamingToPlanningDatabaseSettings({
    settings: input.settings,
    naming,
  });
}
