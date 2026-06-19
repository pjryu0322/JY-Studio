import { describe, expect, it } from "vitest";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  resolvePlanningDataPersistenceMode,
  resolvePlanningDatabaseBlockingReason,
} from "@/lib/planning/planningDbPersistencePolicy";
import {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
} from "@/lib/planning/platformDatabaseRoles";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

export function readyPlatformSchemaSettings(overrides: Record<string, unknown> = {}) {
  return parsePlanningDatabaseSettingsV1({
    version: 1,
    usageSelectionCommitted: true,
    usageMode: "ENABLED_JYPROJECTS_SCHEMA",
    enabled: true,
    provider: "POSTGRESQL",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    connectionStatus: "NOT_CONFIGURED",
    repositoryName: "aiproject",
    databaseStoreName: "aiproject",
    platformManagementDatabaseName: JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
    generatedProjectDataDatabaseName: JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
    runtimeDatabaseName: JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
    dataStoreStatus: "PLANNED",
    implementationSchemaName: "aiproject_impl_sample",
    reviewSchemaName: "aiproject_review_test",
    ...overrides,
  })!;
}

/** @deprecated Use readyPlatformSchemaSettings */
export function readyPlatformProjectDatabaseSettings(overrides: Record<string, unknown> = {}) {
  return readyPlatformSchemaSettings({
    usageMode: "ENABLED_PROJECT_DATABASE",
    ...overrides,
  });
}

describe("planningDatabaseStoreNamingSync", () => {
  it("derives repo-based schema names without projectId suffix (MVP)", () => {
    const synced = syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        enabled: true,
        usageMode: "ENABLED_JYPROJECTS_SCHEMA",
        usageSelectionCommitted: true,
      },
      gitRepoName: "pjryu0322/aiproject",
      projectId: "cmphxk7y10015unj0wjms1uch",
      preserveManualStoreName: false,
    });
    expect(synced.databaseStoreName).toBe("aiproject");
    expect(synced.implementationSchemaName).toBe("aiproject_impl_sample");
    expect(synced.reviewSchemaName).toBe("aiproject_review_test");
    expect(synced.generatedProjectDataDatabaseName).toBe("jyprojects");
    expect(synced.platformManagementDatabaseName).toBe("jyorchestration");
    expect(synced.dataStoreStatus).toBe("PLANNED");
  });
});

describe("jyprojects runtime schema policy", () => {
  it("uses JYPROJECTS_SCHEMA when usage is saved with planned schema names", () => {
    const mode = resolvePlanningDataPersistenceMode({
      planningDatabaseSettings: readyPlatformSchemaSettings(),
    });
    expect(mode).toBe("JYPROJECTS_SCHEMA");
  });

  it("blocks when schema plan failed", () => {
    const mode = resolvePlanningDataPersistenceMode({
      planningDatabaseSettings: readyPlatformSchemaSettings({ dataStoreStatus: "FAILED" }),
    });
    expect(mode).toBe("BLOCKED_SCHEMA_REQUIRED");
  });

  it("does not require database creation before Quick Design", () => {
    expect(resolvePlanningDatabaseBlockingReason(readyPlatformSchemaSettings())).toBe("");
  });

  it("normalizes legacy PLATFORM_SCHEMA usage mode", () => {
    const mode = resolvePlanningDataPersistenceMode({
      planningDatabaseSettings: readyPlatformSchemaSettings({
        usageMode: "ENABLED_PLATFORM_SCHEMA",
      }),
    });
    expect(mode).toBe("JYPROJECTS_SCHEMA");
  });
});
