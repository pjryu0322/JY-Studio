import { describe, expect, it } from "vitest";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { resolvePlanningDataPersistenceMode } from "@/lib/planning/planningDbPersistencePolicy";
import { buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { readyPlatformSchemaSettings } from "./platformManagedProjectDatabase.unit.test";

describe("planningDatabaseStoreNamingSync", () => {
  it("derives per-project schema names when database usage is enabled", () => {
    const synced = syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        enabled: true,
        usageMode: "ENABLED_JYPROJECTS_SCHEMA",
        usageSelectionCommitted: true,
      },
      gitRepoName: "org/meeting-note-2026",
      projectId: "cmq123",
      preserveManualStoreName: false,
    });
    expect(synced.databaseStoreName).toBe("meeting_note_2026");
    expect(synced.implementationSchemaName).toBe("meeting_note_2026_impl_sample");
    expect(synced.reviewSchemaName).toBe("meeting_note_2026_review_test");
  });
});

describe("planningDbPersistencePolicy", () => {
  it("uses JYPROJECTS_SCHEMA when schema plan is ready", () => {
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: readyPlatformSchemaSettings(),
      }),
    ).toBe("JYPROJECTS_SCHEMA");
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: readyPlatformSchemaSettings({ projectDbStatus: "FAILED" }),
      }),
    ).toBe("BLOCKED_SCHEMA_REQUIRED");
    expect(
      resolvePlanningDataPersistenceMode({
        planningDatabaseSettings: defaultPlanningDatabaseSettingsV1(),
      }),
    ).toBe("BLOCKED_DATABASE_USAGE_UNSELECTED");
  });
});

describe("planning data slots with DB settings", () => {
  it("marks data store CONFIRMED when jyprojects schema usage is saved", () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "aiproject",
      projectId: "cmq123",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: readyPlatformSchemaSettings(),
    });
    expect(draft.dataStoreSlot.status).toBe("CONFIRMED");
    expect(draft.dataStoreSlot.enabled).toBe(true);
    expect(draft.dataStoreSlot.implementationStore.schemaName).toBe("aiproject_impl_sample");
    expect(draft.dataStoreSlot.implementationStore.lifecycleStatus).toBe("PLANNED");
  });
});
