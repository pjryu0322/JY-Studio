import { describe, expect, it } from "vitest";
import {
  buildPlanningDataSlotsDraft,
  buildPlanningHandoffForImplementation,
  parsePlanningDataSlotsV1,
  planningDataSlotSummaryRows,
} from "@/lib/planning/planningDataSlotsV1";
import {
  buildProjectDataStoreNaming,
  normalizeRepositoryNameForDb,
} from "@/lib/planning/projectDataStoreNaming";
import { defaultPlanningDatabaseSettingsV1, parsePlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

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
    expect(parsePlanningDataSlotsV1(draft)?.dataStoreSlot.provider).toBe("POSTGRESQL");
    const rows = planningDataSlotSummaryRows(draft);
    expect(rows.length).toBe(4);
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "doitmeet",
      planningDataSlots: draft,
    });
    expect(handoff.implementationDefaults.dataPersistenceMode).toBe("MOCK_JSON_FALLBACK");
    expect(handoff.implementationDataPlan.useRuntimeApi).toBe(false);
  });
});
