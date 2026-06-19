import { describe, expect, it } from "vitest";
import {
  buildProjectDatabaseStatusNotice,
  buildSaveResultNotice,
  classifyProjectDatabaseCreationFailure,
  projectDatabaseActionGuide,
  projectDatabaseFailureUserMessage,
} from "@/lib/planning/projectDatabaseCreationFailure";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

describe("classifyProjectDatabaseCreationFailure", () => {
  it("maps CREATE DATABASE permission errors", () => {
    expect(
      classifyProjectDatabaseCreationFailure({
        rawError: "permission denied to create database",
      }),
    ).toBe("CREATE_DATABASE_PERMISSION_DENIED");
    expect(
      classifyProjectDatabaseCreationFailure({
        rawError: "must be superuser or have CREATEDB privilege",
      }),
    ).toBe("CREATE_DATABASE_PERMISSION_DENIED");
  });

  it("maps connection errors", () => {
    expect(classifyProjectDatabaseCreationFailure({ rawError: "connect ECONNREFUSED" })).toBe(
      "POSTGRES_CONNECTION_FAILED",
    );
  });
});

describe("project database UI notices", () => {
  it("does not duplicate failure text between status and save notices", () => {
    const settings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageSelectionCommitted: true,
      usageMode: "ENABLED_PROJECT_DATABASE",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      password: "",
      connectionStatus: "FAILED",
      projectDbStatus: "FAILED",
      projectDbFailureReason: "CREATE_DATABASE_PERMISSION_DENIED",
      databaseStoreName: "aiproject",
    })!;
    const status = buildProjectDatabaseStatusNotice(settings)!;
    const save = buildSaveResultNotice({
      saved: true,
      projectDbStatus: "FAILED",
      usageMode: "ENABLED_PROJECT_DATABASE",
    })!;
    expect(status.summary).toContain("schema");
    expect(save).toContain("설정이 저장되었습니다");
    expect(save).not.toContain(status.summary);
    expect(projectDatabaseFailureUserMessage("CREATE_DATABASE_PERMISSION_DENIED")).not.toContain(
      "permission denied",
    );
  });

  it("includes CREATEDB guidance for permission failures", () => {
    const guide = projectDatabaseActionGuide({ failureReason: "CREATE_DATABASE_PERMISSION_DENIED" });
    expect(guide.adminGuide).toContain("CREATE SCHEMA");
  });
});
