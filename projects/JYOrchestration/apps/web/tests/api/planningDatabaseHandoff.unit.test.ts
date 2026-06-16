import { describe, expect, it } from "vitest";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { resolvePlanningDataPersistenceMode } from "@/lib/planning/planningDbPersistencePolicy";
import { buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";

describe("planningDatabaseStoreNamingSync", () => {
  it("derives store names from git repository name", () => {
    const synced = syncPlanningDatabaseSettingsStoreNames({
      settings: defaultPlanningDatabaseSettingsV1(),
      gitRepoName: "org/meeting-note-2026",
      projectId: "cmq123",
      preserveManualStoreName: false,
    });
    expect(synced.databaseStoreName).toMatch(/^meeting_note_2026/);
    expect(synced.implementationSchemaName).toContain("_impl_sample");
    expect(synced.reviewSchemaName).toContain("_review_test");
  });
});

describe("planningDbPersistencePolicy", () => {
  it("uses POSTGRES_SAMPLE_DB only when connection is READY with store naming", () => {
    const settings = syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        enabled: true,
        connectionStatus: "READY",
        repositoryName: "meeting-note",
      },
      gitRepoName: "org/meeting-note-2026",
      projectId: "cmq123",
      preserveManualStoreName: false,
    });
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: settings,
      }),
    ).toBe("POSTGRES_SAMPLE_DB");
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: {
          ...defaultPlanningDatabaseSettingsV1(),
          enabled: false,
          connectionStatus: "NOT_CONFIGURED",
        },
      }),
    ).toBe("MOCK_JSON_FALLBACK");
  });
});

describe("planning data slots with DB settings", () => {
  it("marks data store NEEDS_REVIEW when DB is not ready", () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doit-meet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
    });
    expect(draft.dataStoreSlot.status).toBe("NEEDS_REVIEW");
    expect(draft.dataStoreSlot.enabled).toBe(false);
  });
});
