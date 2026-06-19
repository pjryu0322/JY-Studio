import { describe, expect, it } from "vitest";
import {
  readDataStoreLifecycleStatus,
  resolvePlanningStageStoreLifecycle,
} from "@/lib/planning/stageDataStoreLifecycle";

describe("stageDataStoreLifecycle", () => {
  it("reads known lifecycle statuses", () => {
    expect(readDataStoreLifecycleStatus("PLANNED")).toBe("PLANNED");
    expect(readDataStoreLifecycleStatus(" CREATED ")).toBe("CREATED");
    expect(readDataStoreLifecycleStatus("nope")).toBeNull();
  });

  it("returns NOT_REQUIRED in JSON sample mode", () => {
    expect(resolvePlanningStageStoreLifecycle({ jsonSampleMode: true })).toBe("NOT_REQUIRED");
  });

  it("returns PLANNED for PostgreSQL planning when not yet created", () => {
    expect(resolvePlanningStageStoreLifecycle({ jsonSampleMode: false })).toBe("PLANNED");
    expect(
      resolvePlanningStageStoreLifecycle({ jsonSampleMode: false, priorStatus: "PLANNED" }),
    ).toBe("PLANNED");
  });

  it("preserves CREATED/CREATING/FAILED after planning", () => {
    expect(
      resolvePlanningStageStoreLifecycle({ jsonSampleMode: false, priorStatus: "CREATED" }),
    ).toBe("CREATED");
    expect(
      resolvePlanningStageStoreLifecycle({ jsonSampleMode: false, priorStatus: "CREATING" }),
    ).toBe("CREATING");
    expect(
      resolvePlanningStageStoreLifecycle({ jsonSampleMode: false, priorStatus: "FAILED" }),
    ).toBe("FAILED");
  });
});
