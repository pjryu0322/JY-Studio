import { describe, expect, it } from "vitest";
import {
  evaluateImplementationDatabaseRequiredExecutionBlock,
  IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON,
  isImplementationBlockedByPlanningDatabase,
  implementationDatabaseRequiredBlockMessage,
} from "@/lib/prototype/implementationPlanningDatabaseExecutionGuard";
import { buildPlanningDataSlotsDraft, buildPlanningHandoffForImplementation } from "@/lib/planning/planningDataSlotsV1";
import { PLANNING_DATABASE_SETUP_LABEL } from "@/lib/requirements/implementationUxLabels";
import { parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

describe("implementationPlanningDatabaseExecutionGuard", () => {
  it("isImplementationBlockedByPlanningDatabase treats null as blocked", () => {
    expect(isImplementationBlockedByPlanningDatabase(null)).toBe(true);
  });

  it("implementationDatabaseRequiredBlockMessage uses handoff blockingReason", () => {
    expect(
      implementationDatabaseRequiredBlockMessage({
        version: 1,
        projectId: "p1",
        status: "BLOCKED_DATABASE_REQUIRED",
        repositoryName: "app",
        dataStoreSlot: {} as never,
        dataModelSlot: { status: "EMPTY", entities: [] },
        sampleDataSlot: { status: "EMPTY", seedMode: "AI_GENERATED_SAMPLE_DB", resettable: true, entities: [] },
        runtimeApiSlot: { status: "EMPTY", required: false, apiBaseMode: "PLATFORM_DEFAULT", endpoints: [] },
        implementationDataPlan: {
          provider: "POSTGRESQL",
          dataPersistenceMode: "BLOCKED_DATABASE_REQUIRED",
          repositoryBasedStoreName: "app",
          implementationSchemaName: "a",
          reviewSchemaName: "b",
          useSampleDb: false,
          useRuntimeApi: false,
          blocked: true,
          blockingReason: "custom blocking reason",
        },
        implementationDefaults: {
          previewHost: "GITHUB_PAGES",
          dataPersistenceMode: "BLOCKED_DATABASE_REQUIRED",
          runtimeApiRequired: false,
        },
      }),
    ).toBe("custom blocking reason");
  });

  it("blocks execution when handoff is database-blocked", () => {
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "app",
      orchestration: null,
      definitions: [],
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "app",
      planningDataSlots: draft,
    });
    const block = evaluateImplementationDatabaseRequiredExecutionBlock({
      planningHandoffForImplementationV1: handoff,
    });
    expect(block.blocked).toBe(true);
    if (block.blocked) {
      expect(block.blockReason).toBe(IMPLEMENTATION_DATABASE_REQUIRED_BLOCK_REASON);
      expect(block.actionLabel).toBe(PLANNING_DATABASE_SETUP_LABEL);
      expect(block.message).toMatch(/PostgreSQL|데이터베이스 사용 여부/);
    }
  });

  it("allows execution when handoff is READY", () => {
    const settings = parsePlanningDatabaseSettingsV1({
      version: 1,
      usageSelectionCommitted: true,
      usageMode: "ENABLED_POSTGRESQL",
      enabled: true,
      provider: "POSTGRESQL",
      host: "db.example.com",
      port: 5432,
      database: "app",
      username: "app",
      password: "",
      connectionStatus: "READY",
      repositoryName: "org/app",
      databaseStoreName: "app",
      implementationSchemaName: "app_impl_sample",
      reviewSchemaName: "app_review_test",
    })!;
    const draft = buildPlanningDataSlotsDraft({
      repositoryName: "org/app",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "org/app",
      planningDataSlots: draft,
      planningDatabaseSettings: settings,
    });
    expect(
      evaluateImplementationDatabaseRequiredExecutionBlock({
        planningHandoffForImplementationV1: handoff,
      }).blocked,
    ).toBe(false);
  });
});
