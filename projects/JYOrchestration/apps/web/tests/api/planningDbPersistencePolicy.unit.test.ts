import { describe, expect, it } from "vitest";
import {
  isPlanningDatabaseReady,
  isPlanningHandoffBlockedByDatabase,
  normalizePlanningDataPersistenceMode,
  resolvePlanningDataPersistenceMode,
} from "@/lib/planning/planningDbPersistencePolicy";
import { buildPlanningHandoffForImplementation, buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";

describe("planningDbPersistencePolicy blocked mode", () => {
  it("maps legacy MOCK_JSON_FALLBACK to BLOCKED_DATABASE_REQUIRED", () => {
    expect(normalizePlanningDataPersistenceMode("MOCK_JSON_FALLBACK")).toBe("BLOCKED_DATABASE_REQUIRED");
  });

  it("returns BLOCKED when database is not ready", () => {
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
      }),
    ).toBe("BLOCKED_DATABASE_REQUIRED");
    expect(isPlanningDatabaseReady(defaultPlanningDatabaseSettingsV1())).toBe(false);
  });

  it("builds blocked handoff without mock fallback", () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doit-meet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "doit-meet",
      planningDataSlots: draft,
      planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
    });
    expect(handoff.implementationDefaults.dataPersistenceMode).toBe("BLOCKED_DATABASE_REQUIRED");
    expect(isPlanningHandoffBlockedByDatabase(handoff)).toBe(true);
  });

  it("allows handoff when database is READY", () => {
    const settings = syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        enabled: true,
        connectionStatus: "READY",
        host: "localhost",
        database: "app",
        username: "app",
        hasPassword: true,
        repositoryName: "doit-meet",
      },
      gitRepoName: "org/doit-meet",
      projectId: "p1",
      preserveManualStoreName: false,
    });
    expect(isPlanningDatabaseReady(settings)).toBe(true);
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doit-meet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "doit-meet",
      planningDataSlots: draft,
      planningDatabaseSettings: settings,
    });
    expect(handoff.status).toBe("READY");
    expect(isPlanningHandoffBlockedByDatabase(handoff)).toBe(false);
  });
});
