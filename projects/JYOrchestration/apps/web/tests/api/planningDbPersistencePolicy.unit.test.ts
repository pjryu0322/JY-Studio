import { describe, expect, it } from "vitest";
import {
  isPlanningHandoffBlockedByDatabase,
  isPlanningHandoffReadyForImplementationPrep,
  normalizePlanningDataPersistenceMode,
  resolvePlanningDataPersistenceMode,
  resolvePlanningDatabaseReadinessV1,
} from "@/lib/planning/planningDbPersistencePolicy";
import { buildPlanningHandoffForImplementation, buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";

describe("planningDbPersistencePolicy usage modes", () => {
  it("maps legacy MOCK_JSON_FALLBACK to BLOCKED_DATABASE_REQUIRED", () => {
    expect(normalizePlanningDataPersistenceMode("MOCK_JSON_FALLBACK")).toBe("BLOCKED_DATABASE_REQUIRED");
  });

  it("returns usage unselected when database settings were never committed", () => {
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
      }),
    ).toBe("BLOCKED_DATABASE_USAGE_UNSELECTED");
    expect(resolvePlanningDatabaseReadinessV1(defaultPlanningDatabaseSettingsV1(), null)).toBe("USAGE_UNSELECTED");
  });

  it("allows JSON sample handoff when database usage is disabled", () => {
    const settings = {
      ...defaultPlanningDatabaseSettingsV1(),
      usageMode: "DISABLED_JSON_SAMPLE" as const,
      usageSelectionCommitted: true,
      enabled: false,
      connectionStatus: "NOT_REQUIRED" as const,
    };
    expect(resolvePlanningDataPersistenceMode({ planningDatabaseSettings: settings })).toBe("JSON_SAMPLE_DATA");
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
    expect(handoff.implementationDataPlan.dataPersistenceMode).toBe("JSON_SAMPLE_DATA");
    expect(handoff.implementationDataPlan.useJsonSampleData).toBe(true);
    expect(isPlanningHandoffBlockedByDatabase(handoff)).toBe(false);
    expect(isPlanningHandoffReadyForImplementationPrep(handoff)).toBe(true);
  });

  it("blocks handoff when postgres enabled but not ready", () => {
    const settings = {
      ...defaultPlanningDatabaseSettingsV1(),
      usageMode: "ENABLED_POSTGRESQL" as const,
      usageSelectionCommitted: true,
      enabled: true,
    };
    expect(resolvePlanningDataPersistenceMode({ planningDatabaseSettings: settings })).toBe(
      "BLOCKED_DATABASE_REQUIRED",
    );
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
    expect(handoff.implementationDefaults.dataPersistenceMode).toBe("BLOCKED_DATABASE_REQUIRED");
    expect(isPlanningHandoffBlockedByDatabase(handoff)).toBe(true);
  });

  it("allows handoff when database is READY", () => {
    const settings = syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        usageMode: "ENABLED_POSTGRESQL",
        usageSelectionCommitted: true,
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
