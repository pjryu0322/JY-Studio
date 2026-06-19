import { describe, expect, it } from "vitest";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { resolvePlanningDataPersistenceMode } from "@/lib/planning/planningDbPersistencePolicy";
import { buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { readyPlatformProjectDatabaseSettings } from "./platformManagedProjectDatabase.unit.test";

describe("planningDatabaseStoreNamingSync", () => {
  it("derives platform store names when database usage is enabled", () => {
    const synced = syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        enabled: true,
        usageMode: "ENABLED_PROJECT_DATABASE",
        usageSelectionCommitted: true,
      },
      gitRepoName: "org/meeting-note-2026",
      projectId: "cmq123",
      preserveManualStoreName: false,
    });
    expect(synced.projectDbName).toMatch(/^p_/);
    expect(synced.databaseStoreName).toMatch(/^meeting_note_2026/);
    expect(synced.implementationSchemaName).toBe("impl_sample");
    expect(synced.reviewSchemaName).toBe("review_test");
  });
});

describe("planningDbPersistencePolicy", () => {
  it("uses PROJECT_DATABASE when platform project DB is CREATED", () => {
    const settings = readyPlatformProjectDatabaseSettings();
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: settings,
      }),
    ).toBe("PROJECT_DATABASE");
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: readyPlatformProjectDatabaseSettings({
          projectDbStatus: "PLANNED",
          connectionStatus: "NOT_CONFIGURED",
        }),
      }),
    ).toBe("BLOCKED_PROJECT_DATABASE_REQUIRED");
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
      }),
    ).toBe("BLOCKED_DATABASE_USAGE_UNSELECTED");
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
