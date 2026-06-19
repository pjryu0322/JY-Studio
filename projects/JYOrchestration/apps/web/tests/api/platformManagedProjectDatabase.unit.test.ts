import { describe, expect, it } from "vitest";
import { buildProjectDatabaseName } from "@/lib/planning/projectDatabaseNaming";
import { resolvePlanningDataPersistenceMode } from "@/lib/planning/planningDbPersistencePolicy";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

export function readyPlatformProjectDatabaseSettings(
  overrides: Record<string, unknown> = {},
) {
  return parsePlanningDatabaseSettingsV1({
    version: 1,
    usageSelectionCommitted: true,
    usageMode: "ENABLED_PROJECT_DATABASE",
    enabled: true,
    provider: "POSTGRESQL",
    host: "db.internal",
    port: 5432,
    database: "p_testproj",
    username: "platform",
    password: "",
    connectionStatus: "READY",
    repositoryName: "doitmeet",
    projectDbName: "p_testproj",
    projectDbStatus: "CREATED",
    databaseStoreName: "p_testproj",
    implementationSchemaName: "impl_sample",
    reviewSchemaName: "review_test",
    ...overrides,
  })!;
}

describe("projectDatabaseNaming", () => {
  it("builds p_ prefix database names from project id", () => {
    expect(buildProjectDatabaseName({ projectId: "cmphxk7y10015unj0wjms1uch" })).toBe("p_cmphxk7y");
  });
});

describe("platform managed project database policy", () => {
  it("uses PROJECT_DATABASE when project DB is CREATED", () => {
    const mode = resolvePlanningDataPersistenceMode({
      planningDatabaseSettings: readyPlatformProjectDatabaseSettings(),
    });
    expect(mode).toBe("PROJECT_DATABASE");
  });

  it("blocks when project DB is not created", () => {
    const mode = resolvePlanningDataPersistenceMode({
      planningDatabaseSettings: readyPlatformProjectDatabaseSettings({
        projectDbStatus: "PLANNED",
        connectionStatus: "NOT_CONFIGURED",
      }),
    });
    expect(mode).toBe("BLOCKED_PROJECT_DATABASE_REQUIRED");
  });
});
