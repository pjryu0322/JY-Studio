import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  provisionImplementationSampleStore,
  provisionReviewTestStore,
} from "@/lib/planning/provisionProjectStageDataStores";
import * as stagePostgresSchemaProvisioning from "@/lib/planning/stagePostgresSchemaProvisioning";

vi.mock("@/lib/planning/stagePostgresSchemaProvisioning", async (importOriginal) => {
  const actual = await importOriginal<typeof stagePostgresSchemaProvisioning>();
  return {
    ...actual,
    createPostgresSchemaIfNotExists: vi.fn(),
  };
});

function readyPostgresSettings() {
  return parsePlanningDatabaseSettingsV1({
    version: 1,
    usageSelectionCommitted: true,
    usageMode: "ENABLED_POSTGRESQL",
    enabled: true,
    provider: "POSTGRESQL",
    host: "db",
    port: 5432,
    database: "app",
    username: "app",
    password: "",
    connectionStatus: "READY",
    repositoryName: "doitmeet",
    databaseStoreName: "doitmeet",
    implementationSchemaName: "doitmeet_impl_sample",
    reviewSchemaName: "doitmeet_review_test",
  })!;
}

describe("provisionProjectStageDataStores", () => {
  beforeEach(() => {
    vi.mocked(stagePostgresSchemaProvisioning.createPostgresSchemaIfNotExists).mockReset();
  });

  it("creates implementation schema when PLANNED and leaves review PLANNED", async () => {
    vi.mocked(stagePostgresSchemaProvisioning.createPostgresSchemaIfNotExists).mockResolvedValue({
      ok: true,
      message: "ok",
    });
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doitmeet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: readyPostgresSettings(),
    });
    expect(draft.dataStoreSlot.implementationStore.lifecycleStatus).toBe("PLANNED");
    expect(draft.dataStoreSlot.reviewStore.lifecycleStatus).toBe("PLANNED");

    const nowIso = "2026-06-03T00:00:00.000Z";
    const result = await provisionImplementationSampleStore({
      projectId: "p1",
      planningDataSlotsV1: draft,
      settings: readyPostgresSettings(),
      password: "secret",
      nowIso,
    });

    expect(result.ok).toBe(true);
    expect(stagePostgresSchemaProvisioning.createPostgresSchemaIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ schemaName: "doitmeet_impl_sample" }),
    );
    expect(result.planningDataSlotsV1?.dataStoreSlot.implementationStore.lifecycleStatus).toBe("CREATED");
    expect(result.planningDataSlotsV1?.dataStoreSlot.reviewStore.lifecycleStatus).toBe("PLANNED");
    expect(result.timelineEntry?.action).toBe("implementation_sample_store_created");
  });

  it("creates review schema on review provision without changing impl CREATED", async () => {
    vi.mocked(stagePostgresSchemaProvisioning.createPostgresSchemaIfNotExists).mockResolvedValue({
      ok: true,
      message: "ok",
    });
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doitmeet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: readyPostgresSettings(),
    });
    const implDone = await provisionImplementationSampleStore({
      projectId: "p1",
      planningDataSlotsV1: draft,
      settings: readyPostgresSettings(),
      password: "secret",
      nowIso: "2026-06-03T00:00:00.000Z",
    });
    const reviewResult = await provisionReviewTestStore({
      projectId: "p1",
      planningDataSlotsV1: implDone.planningDataSlotsV1,
      settings: readyPostgresSettings(),
      password: "secret",
      nowIso: "2026-06-03T00:01:00.000Z",
    });
    expect(reviewResult.ok).toBe(true);
    expect(stagePostgresSchemaProvisioning.createPostgresSchemaIfNotExists).toHaveBeenLastCalledWith(
      expect.objectContaining({ schemaName: "doitmeet_review_test" }),
    );
    expect(reviewResult.planningDataSlotsV1?.dataStoreSlot.reviewStore.lifecycleStatus).toBe("CREATED");
    expect(reviewResult.planningDataSlotsV1?.dataStoreSlot.implementationStore.lifecycleStatus).toBe(
      "CREATED",
    );
  });

  it("skips CREATE SCHEMA for JSON sample mode stores", async () => {
    const jsonSettings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageSelectionCommitted: true,
      usageMode: "DISABLED_JSON_SAMPLE",
      enabled: false,
      provider: "POSTGRESQL",
      host: "",
      port: 5432,
      database: "",
      username: "",
      password: "",
      connectionStatus: "NOT_CONFIGURED",
      repositoryName: "doitmeet",
    })!;
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doitmeet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: jsonSettings,
    });
    expect(draft.dataStoreSlot.implementationStore.lifecycleStatus).toBe("NOT_REQUIRED");
    expect(draft.dataStoreSlot.reviewStore.lifecycleStatus).toBe("NOT_REQUIRED");

    const result = await provisionImplementationSampleStore({
      projectId: "p1",
      planningDataSlotsV1: draft,
      settings: jsonSettings,
      password: null,
      nowIso: "2026-06-03T00:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(stagePostgresSchemaProvisioning.createPostgresSchemaIfNotExists).not.toHaveBeenCalled();
  });
});
