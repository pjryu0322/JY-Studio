import { describe, expect, it } from "vitest";
import {
  classifyProjectSchemaProvisionFailure,
  projectDataStoreActionGuide,
  projectSchemaProvisionFailureUserMessage,
} from "@/lib/planning/projectSchemaProvisionFailure";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { planningDatabaseSettingsForPersistence } from "@/lib/planning/planningDatabaseSettingsCanonical";

describe("classifyProjectSchemaProvisionFailure", () => {
  it("maps schema permission errors", () => {
    expect(
      classifyProjectSchemaProvisionFailure({
        rawError: "permission denied to create schema",
      }),
    ).toBe("CREATE_SCHEMA_PERMISSION_DENIED");
  });

  it("maps connection errors", () => {
    expect(classifyProjectSchemaProvisionFailure({ rawError: "connect ECONNREFUSED" })).toBe(
      "JYPROJECTS_CONNECTION_FAILED",
    );
  });
});

describe("project data store UI notices", () => {
  it("does not duplicate failure text between status and save notices", () => {
    const settings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageSelectionCommitted: true,
      usageMode: "ENABLED_JYPROJECTS_SCHEMA",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      connectionStatus: "FAILED",
      dataStoreStatus: "FAILED",
      dataStoreFailureReason: "CREATE_SCHEMA_PERMISSION_DENIED",
    })!;
    expect(settings?.dataStoreFailureReason).toBe("CREATE_SCHEMA_PERMISSION_DENIED");
  });

  it("includes schema guidance for permission failures", () => {
    expect(projectSchemaProvisionFailureUserMessage("CREATE_SCHEMA_PERMISSION_DENIED")).not.toContain(
      "CREATE DATABASE",
    );
    const guide = projectDataStoreActionGuide({ failureReason: "CREATE_SCHEMA_PERMISSION_DENIED" });
    expect(guide.adminGuide).toMatch(/CREATE SCHEMA/i);
  });
});

describe("persistence canonical form", () => {
  it("strips legacy projectDb fields on save", () => {
    const parsed = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageMode: "ENABLED_JYPROJECTS_SCHEMA",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      connectionStatus: "NOT_CONFIGURED",
      projectDbStatus: "PLANNED",
      projectDbName: "legacy_name",
    })!;
    const persisted = planningDatabaseSettingsForPersistence(parsed);
    expect(persisted).not.toHaveProperty("projectDbStatus");
    expect(persisted).not.toHaveProperty("projectDbName");
    expect(persisted.dataStoreStatus).toBe("PLANNED");
    expect(persisted.projectStoreName).toBeTruthy();
  });
});
