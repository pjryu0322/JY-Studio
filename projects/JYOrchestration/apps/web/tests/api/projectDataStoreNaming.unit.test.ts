import { describe, expect, it } from "vitest";
import {
  buildProjectDataStoreNaming,
  normalizeRepositoryNameForDb,
  resolveDefaultPostgresDatabaseNameFromGitRepo,
} from "@/lib/planning/projectDataStoreNaming";
import { buildPlanningHandoffForImplementation, buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";

describe("projectDataStoreNaming", () => {
  it("maps doit-meet to impl/review schema names", () => {
    const naming = buildProjectDataStoreNaming({ repositoryName: "doit-meet", projectId: "p1" });
    expect(naming.normalizedBaseName).toMatch(/^doit_meet/);
    expect(naming.implementationSchemaName).toContain("_impl_sample");
    expect(naming.reviewSchemaName).toContain("_review_test");
  });

  it("prefixes numeric-leading repo names", () => {
    expect(normalizeRepositoryNameForDb("123-test")).toMatch(/^p_123_test/);
  });

  it("normalizes spaced repo titles", () => {
    expect(normalizeRepositoryNameForDb("JY Meeting Service")).toBe("jy_meeting_service");
  });

  it("derives default postgres database name from GitHub repo", () => {
    expect(resolveDefaultPostgresDatabaseNameFromGitRepo("pjryu0322/aiproject")).toBe("aiproject");
    expect(resolveDefaultPostgresDatabaseNameFromGitRepo("pjryu0322/doit-meet")).toBe("doit_meet");
  });
});

describe("buildPlanningHandoffForImplementation", () => {
  it("uses POSTGRES_SAMPLE_DB when DB is READY with store names", () => {
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
        repositoryName: "doit-meet",
      },
      gitRepoName: "org/doit-meet",
      projectId: "p1",
      preserveManualStoreName: false,
    });
    const slots = buildPlanningDataSlotsDraft({
      repositoryName: "doit-meet",
      projectId: "p1",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "doit-meet",
      planningDataSlots: slots,
      planningDatabaseSettings: settings,
    });
    expect(handoff.implementationDefaults.dataPersistenceMode).toBe("POSTGRES_SAMPLE_DB");
    expect(handoff.implementationDataPlan.useSampleDb).toBe(true);
    expect(handoff.implementationDataPlan.useRuntimeApi).toBe(true);
    expect(handoff.implementationDataPlan.blockingReason).toBeNull();
    expect(handoff.status).toBe("READY");
    expect(handoff.implementationDataPlan.implementationSchemaName).toContain("_impl_sample");
    expect(handoff.implementationDataPlan.reviewSchemaName).toContain("_review_test");
  });

  it("blocks handoff when DB is disabled after explicit JSON selection", () => {
    const settings = {
      ...defaultPlanningDatabaseSettingsV1(),
      usageMode: "DISABLED_JSON_SAMPLE" as const,
      usageSelectionCommitted: true,
      enabled: false,
      connectionStatus: "NOT_REQUIRED" as const,
    };
    const slots = buildPlanningDataSlotsDraft({
      repositoryName: "doit-meet",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "doit-meet",
      planningDataSlots: slots,
      planningDatabaseSettings: settings,
    });
    expect(handoff.implementationDefaults.dataPersistenceMode).toBe("JSON_SAMPLE_DATA");
    expect(handoff.status).toBe("READY");
    expect(handoff.implementationDataPlan.useSampleDb).toBe(false);
    expect(handoff.implementationDataPlan.useJsonSampleData).toBe(true);
    expect(handoff.implementationDataPlan.blocked).toBe(false);
    expect(handoff.implementationDataPlan.blockingReason).toBeNull();
  });
});
