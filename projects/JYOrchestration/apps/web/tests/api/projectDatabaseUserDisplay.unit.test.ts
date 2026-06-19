import { describe, expect, it } from "vitest";
import {
  projectDatabaseUserCurrentValue,
  projectDatabaseUserStatusLabel,
  projectDatabaseUserDisplayFromSettings,
} from "@/lib/planning/projectDatabaseUserDisplay";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { buildPrototypeEnvModalTableRows } from "@/lib/project/prototypeEnvSettingsModalRows";

describe("projectDatabaseUserDisplay", () => {
  it("shows platform attention labels when project DB creation failed", () => {
    expect(
      projectDatabaseUserStatusLabel("ENABLED_PROJECT_DATABASE", "FAILED"),
    ).toBe("플랫폼 확인 필요");
    expect(
      projectDatabaseUserCurrentValue("ENABLED_PROJECT_DATABASE", "FAILED"),
    ).toBe("관리자 확인 필요");
    expect(projectDatabaseUserStatusLabel("ENABLED_PROJECT_DATABASE", "FAILED")).not.toBe("실패");
  });

  it("maps JSON sample and ready states", () => {
    expect(projectDatabaseUserStatusLabel("DISABLED_JSON_SAMPLE", "NOT_REQUIRED")).toBe("미사용");
    expect(projectDatabaseUserCurrentValue("DISABLED_JSON_SAMPLE", "NOT_REQUIRED")).toBe(
      "JSON 샘플데이터",
    );
    expect(projectDatabaseUserStatusLabel("ENABLED_PROJECT_DATABASE", "CREATED")).toBe("정상");
    expect(projectDatabaseUserCurrentValue("ENABLED_PROJECT_DATABASE", "CREATED")).toBe(
      "프로젝트 DB 준비 완료",
    );
  });
});

describe("prototypeEnvSettingsModalRows database row", () => {
  it("uses user-facing DB status instead of connection failed", () => {
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
      projectDbName: "p_test",
      projectDbStatus: "FAILED",
    })!;
    const rows = buildPrototypeEnvModalTableRows({
      executionSetup: {
        planningDatabaseSettingsJson: settings,
      } as never,
    });
    const dbRow = rows.find((r) => r.key === "database");
    expect(dbRow?.status).toBe("플랫폼 확인 필요");
    expect(dbRow?.currentValue).toBe("관리자 확인 필요");
    expect(dbRow?.status).not.toBe("실패");
    expect(dbRow?.currentValue).not.toBe("PostgreSQL");
  });

  it("display helper matches settings", () => {
    const settings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageSelectionCommitted: true,
      usageMode: "ENABLED_PROJECT_DATABASE",
      enabled: true,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "p_x",
      username: "",
      password: "",
      connectionStatus: "READY",
      projectDbName: "p_x",
      projectDbStatus: "CREATED",
    })!;
    const display = projectDatabaseUserDisplayFromSettings(settings);
    expect(display.status).toBe("정상");
    expect(display.currentValue).toBe("프로젝트 DB 준비 완료");
  });
});
