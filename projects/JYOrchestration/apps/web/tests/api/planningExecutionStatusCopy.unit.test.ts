import { describe, expect, it } from "vitest";
import { planningExecutionStatusCopy, type PlanningOriginatedExecutionStatus } from "@jy-orch/application/public";

describe("planningExecutionStatusCopy", () => {
  const statuses: PlanningOriginatedExecutionStatus[] = [
    "BLOCKED",
    "NEEDS_CONFIRMATION",
    "READY_FOR_EXECUTION",
    "EXECUTION_STARTED",
    "EXECUTION_START_FAILED",
  ];

  it.each(statuses)("status %s has stable non-empty copy", (s) => {
    const c = planningExecutionStatusCopy(s);
    expect(c.headline).toBeTruthy();
    expect(c.explanation).toBeTruthy();
    expect(c.nextStepGuidance).toBeTruthy();
  });

  it("does not use internal bundle terminology", () => {
    const all = statuses.map((s) => planningExecutionStatusCopy(s)).join("\n");
    expect(all).not.toMatch(/bundle|handoff|refinement|seed|bridge|ExecutionPreparationBundle|ExecutionBridgePayload/i);
  });

  it("keeps re-evaluation semantics explicit for EXECUTION_STARTED", () => {
    const c = planningExecutionStatusCopy("EXECUTION_STARTED");
    expect(c.nextStepGuidance).toContain("상태 재평가");
  });
});

