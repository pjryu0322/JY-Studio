import { describe, expect, it } from "vitest";
import {
  buildPlanningDataSlotsDraft,
  buildPlanningHandoffForImplementation,
  parsePlanningDataSlotsV1,
  parsePlanningHandoffForImplementationV1,
  planningDataSlotSummaryRows,
} from "@/lib/planning/planningDataSlotsV1";
import {
  buildProjectDataStoreNaming,
  normalizeRepositoryNameForDb,
} from "@/lib/planning/projectDataStoreNaming";
import { defaultPlanningDatabaseSettingsV1, parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";

describe("projectDataStoreNaming", () => {
  it("normalizes repository names for PostgreSQL schemas", () => {
    expect(normalizeRepositoryNameForDb("doit-meet")).toBe("doit_meet");
    expect(normalizeRepositoryNameForDb("123app")).toBe("p_123app");
    const naming = buildProjectDataStoreNaming({ repositoryName: "doit-meet" });
    expect(naming.implementationSchemaName).toBe("doit_meet_impl_sample");
    expect(naming.reviewSchemaName).toBe("doit_meet_review_test");
  });
});

describe("planningDatabaseSettingsV1", () => {
  it("parses defaults without password", () => {
    const parsed = parsePlanningDatabaseSettingsV1(defaultPlanningDatabaseSettingsV1());
    expect(parsed?.provider).toBe("POSTGRESQL");
    expect(parsed?.port).toBe(5432);
  });
});

describe("planningDataSlotsV1", () => {
  it("drafts data slots from repository name", () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "doitmeet",
      orchestration: null,
      definitions: [],
    });
    expect(draft.dataStoreSlot.implementationStore.schemaName).toBe("doitmeet_impl_sample");
    expect(draft.dataStoreSlot.implementationStore.lifecycleStatus).toBe("PLANNED");
    expect(draft.dataStoreSlot.reviewStore.lifecycleStatus).toBe("PLANNED");
    expect(draft.dataStoreSlot.projectDataStoreNameStatus).toBe("PLANNED");
    expect(parsePlanningDataSlotsV1(draft)?.dataStoreSlot.provider).toBe("POSTGRESQL");
    const rows = planningDataSlotSummaryRows(draft);
    expect(rows.length).toBe(4);
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "doitmeet",
      planningDataSlots: draft,
    });
    expect(handoff.implementationDefaults.dataPersistenceMode).toBe("BLOCKED_DATABASE_USAGE_UNSELECTED");
    expect(handoff.status).toBe("BLOCKED_DATABASE_USAGE_UNSELECTED");
    expect(handoff.implementationDataPlan.useRuntimeApi).toBe(false);
    expect(handoff.implementationDataPlan.blocked).toBe(true);
  });

  it("sets dataStoreSlot databaseReadiness when DB is not configured", () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "app",
      orchestration: null,
      definitions: [],
    });
    expect(draft.dataStoreSlot.databaseReadiness).toBe("USAGE_UNSELECTED");
    expect(draft.dataStoreSlot.settingsActionLabel).toBe(PLANNING_DATABASE_SETUP_LABEL);
    expect(draft.dataStoreSlot.blockingReason).toBeTruthy();
  });

  it("sets dataStoreSlot READY when PostgreSQL connection is ready", () => {
    const settings = parsePlanningDatabaseSettingsV1({
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
      repositoryName: "org/app",
      implementationSchemaName: "app_impl_sample",
      reviewSchemaName: "app_review_test",
    })!;
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "org/app",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    expect(draft.dataStoreSlot.databaseReadiness).toBe("READY");
    expect(draft.dataStoreSlot.status).toBe("CONFIRMED");
    expect(draft.dataStoreSlot.blockingReason).toBeUndefined();
  });

  it("marks stage stores NOT_REQUIRED when JSON sample mode is selected", () => {
    const settings = parsePlanningDatabaseSettingsV1({
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
      repositoryName: "app",
    })!;
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "app",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    expect(draft.dataStoreSlot.implementationStore.lifecycleStatus).toBe("NOT_REQUIRED");
    expect(draft.dataStoreSlot.reviewStore.lifecycleStatus).toBe("NOT_REQUIRED");
    expect(draft.dataStoreSlot.projectDataStoreNameStatus).toBe("NOT_REQUIRED");
  });

  it("preserves stored implementationDataPlan on parse", () => {
    const raw = {
      version: 1,
      projectId: "p1",
      status: "READY",
      repositoryName: "app",
      updatedAt: new Date().toISOString(),
      dataStoreSlot: {
        status: "CONFIRMED",
        databaseReadiness: "READY",
        provider: "POSTGRESQL",
        enabled: true,
        implementationStore: { mode: "SAMPLE_DB", displayName: "impl", description: "" },
        reviewStore: { mode: "TEST_DB", displayName: "review", description: "" },
        productionStore: { mode: "NOT_CONFIGURED", displayName: "prod", description: "" },
        runtimeApiRequired: true,
      },
      dataModelSlot: { status: "EMPTY", entities: [] },
      sampleDataSlot: { status: "EMPTY", seedMode: "AI_GENERATED_SAMPLE_DB", resettable: true, entities: [] },
      runtimeApiSlot: { status: "EMPTY", required: true, apiBaseMode: "PLATFORM_DEFAULT", endpoints: [] },
      implementationDataPlan: {
        provider: "POSTGRESQL",
        dataPersistenceMode: "POSTGRES_SAMPLE_DB",
        repositoryBasedStoreName: "app",
        implementationSchemaName: "app_impl_sample",
        reviewSchemaName: "app_review_test",
        useSampleDb: true,
        useRuntimeApi: true,
        blocked: false,
        blockingReason: null,
      },
      implementationDefaults: {
        previewHost: "GITHUB_PAGES",
        dataPersistenceMode: "POSTGRES_SAMPLE_DB",
        runtimeApiRequired: true,
      },
    };
    const parsed = parsePlanningHandoffForImplementationV1(raw);
    expect(parsed?.status).toBe("READY");
    expect(parsed?.implementationDataPlan.dataPersistenceMode).toBe("POSTGRES_SAMPLE_DB");
    expect(parsed?.implementationDataPlan.useSampleDb).toBe(true);
    expect(parsed?.implementationDataPlan.useRuntimeApi).toBe(true);
    expect(parsed?.implementationDataPlan.blocked).toBe(false);
  });

  it("normalizes legacy MOCK_JSON_FALLBACK on parse", () => {
    const raw = {
      version: 1,
      projectId: "p1",
      repositoryName: "app",
      updatedAt: new Date().toISOString(),
      dataStoreSlot: {
        status: "NEEDS_REVIEW",
        databaseReadiness: "BLOCKED_DATABASE_REQUIRED",
        provider: "POSTGRESQL",
        enabled: false,
        implementationStore: { mode: "SAMPLE_DB", displayName: "impl", description: "" },
        reviewStore: { mode: "TEST_DB", displayName: "review", description: "" },
        productionStore: { mode: "NOT_CONFIGURED", displayName: "prod", description: "" },
        runtimeApiRequired: false,
      },
      dataModelSlot: { status: "EMPTY", entities: [] },
      sampleDataSlot: { status: "EMPTY", seedMode: "AI_GENERATED_SAMPLE_DB", resettable: true, entities: [] },
      runtimeApiSlot: { status: "EMPTY", required: false, apiBaseMode: "PLATFORM_DEFAULT", endpoints: [] },
      implementationDataPlan: {
        dataPersistenceMode: "MOCK_JSON_FALLBACK",
      },
    };
    const parsed = parsePlanningHandoffForImplementationV1(raw);
    expect(parsed?.implementationDataPlan.dataPersistenceMode).toBe("BLOCKED_DATABASE_REQUIRED");
    expect(parsed?.status).toBe("BLOCKED_DATABASE_REQUIRED");
    expect(parsed?.implementationDataPlan.blocked).toBe(true);
  });
});
