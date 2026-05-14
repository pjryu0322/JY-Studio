import { describe, expect, it } from "vitest";

import {
  emptyRecentMemoryRuntimeSummary,
  summarizeRecentMemoryRuntimePlans,
} from "@/lib/harness/memoryRuntime/memoryRuntimeRecentSummary";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";

function plan(partial: Partial<MemoryRuntimePlan>): MemoryRuntimePlan {
  return {
    mode: "dry_run",
    roleKey: null,
    references: [],
    findings: [],
    ...partial,
  };
}

import type { MemoryRuntimeReference } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";

const REF: MemoryRuntimeReference = {
  memoryId: "id",
  scope: "project",
  summary: "summary",
  freshness: "fresh",
  selectedReason: "reason",
  selectedBy: "by",
  estimatedImportance: 10,
};

describe("summarizeRecentMemoryRuntimePlans", () => {
  it("returns empty summary for empty input", () => {
    expect(summarizeRecentMemoryRuntimePlans({ plans: [] })).toEqual(
      emptyRecentMemoryRuntimeSummary()
    );
  });

  it("counts sampled entry count even when plans are null", () => {
    const out = summarizeRecentMemoryRuntimePlans({ plans: [null, undefined] });
    expect(out.sampledEntryCount).toBe(2);
    expect(out.planEntryCount).toBe(0);
    expect(out.totalReferences).toBe(0);
  });

  it("computes reference-level rates from multiple plans", () => {
    const out = summarizeRecentMemoryRuntimePlans({
      plans: [
        plan({
          references: [
            { ...REF, memoryId: "a", scope: "role", freshness: "fresh" },
            { ...REF, memoryId: "b", scope: "project", freshness: "stale" },
          ],
        }),
        plan({
          references: [
            { ...REF, memoryId: "c", scope: "working", freshness: "aging" },
            { ...REF, memoryId: "d", scope: "working", freshness: "stale" },
          ],
        }),
      ],
    });
    expect(out.totalReferences).toBe(4);
    expect(out.freshReferenceRate).toBe(0.25);
    expect(out.agingReferenceRate).toBe(0.25);
    expect(out.staleReferenceRate).toBe(0.5);
    expect(out.roleScopedRate).toBe(0.25);
    expect(out.projectScopedRate).toBe(0.25);
    expect(out.workingScopedRate).toBe(0.5);
  });

  it("computes finding rate at the plan level", () => {
    const out = summarizeRecentMemoryRuntimePlans({
      plans: [
        plan({
          references: [{ ...REF, memoryId: "a", scope: "project", freshness: "fresh" }],
          findings: [
            { code: "x", severity: "info", message: "msg" },
          ],
        }),
        plan({
          references: [{ ...REF, memoryId: "b", scope: "working", freshness: "aging" }],
        }),
      ],
    });
    expect(out.planEntryCount).toBe(2);
    expect(out.findingRate).toBe(0.5);
  });

  it("ignores invalid (non-dry_run) plans", () => {
    const invalid = { ...plan({}), mode: "apply" } as unknown as MemoryRuntimePlan;
    const out = summarizeRecentMemoryRuntimePlans({
      plans: [invalid, plan({ references: [{ ...REF, memoryId: "a", scope: "project", freshness: "fresh" }] })],
    });
    expect(out.sampledEntryCount).toBe(2);
    expect(out.planEntryCount).toBe(1);
    expect(out.totalReferences).toBe(1);
  });

  it("returns rate=0 when no references but planEntryCount>0", () => {
    const out = summarizeRecentMemoryRuntimePlans({
      plans: [plan({ references: [] }), plan({ references: [] })],
    });
    expect(out.planEntryCount).toBe(2);
    expect(out.totalReferences).toBe(0);
    expect(out.freshReferenceRate).toBe(0);
    expect(out.staleReferenceRate).toBe(0);
    expect(out.findingRate).toBe(0);
  });
});
