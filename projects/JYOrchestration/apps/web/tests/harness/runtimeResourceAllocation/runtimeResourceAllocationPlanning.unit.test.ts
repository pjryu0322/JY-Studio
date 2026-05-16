import { describe, expect, it } from "vitest";

import { buildSemanticPlanningTestFixtures } from "../runtimeSemantic/semanticTestFixtures";
import { buildRuntimeResourceAllocationPlanningReports } from "@/lib/harness/runtimeResourceAllocation/buildRuntimeResourceAllocationPlanningReports";
import { serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports } from "@/lib/harness/runtimeResourceAllocation/serializeRuntimeResourceAllocationDiagnosticBundle";
import { evaluateRuntimeAllocationEligibility } from "@/lib/harness/runtimeResourceAllocation/evaluateRuntimeAllocationEligibility";
import type { RuntimeSemanticPlanningReportsBeforeAllocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";

describe("H21.5 runtime resource allocation planning", () => {
  it("exposes read-only flags on all allocation artifacts", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const p = semantic.runtimeResourceAllocationPlan;
    const e = semantic.runtimeAllocationEligibilitySummary;
    const prov = semantic.runtimeProviderSlotPlan;
    const ex = semantic.runtimeExecutionSlotPlan;
    expect(p.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(p.actualResourceAllocationEnabled).toBe(false);
    expect(e.actualRuntimeOrchestrationEnabled).toBe(false);
    expect(e.actualResourceAllocationEnabled).toBe(false);
    expect(prov.actualResourceAllocationEnabled).toBe(false);
    expect(ex.actualResourceAllocationEnabled).toBe(false);
  });

  it("maps governance boundary to eligibility effective mode", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const beforeAlloc = semantic as RuntimeSemanticPlanningReportsBeforeAllocation;
    const e = evaluateRuntimeAllocationEligibility(beforeAlloc);
    const boundary = semantic.runtimeResourceControlBoundary.boundary;
    const expected =
      boundary === "observe_only"
        ? "not_needed"
        : boundary === "planning_only"
          ? "planning_only"
          : boundary === "trial_candidate"
            ? "dry_run_candidate"
            : "blocked_by_governance";
    expect(e.effectiveAllocationMode).toBe(expected);
  });

  it("serializes allocation diagnostic bundle idempotently", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const a = serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports(semantic);
    const b = serializeRuntimeResourceAllocationDiagnosticBundleFromSemanticReports(semantic);
    expect(a).toEqual(b);
  });

  it("does not recompute resource or governance when building allocation reports alone", () => {
    const { semantic } = buildSemanticPlanningTestFixtures();
    const beforeAlloc = semantic as RuntimeSemanticPlanningReportsBeforeAllocation;
    const alloc = buildRuntimeResourceAllocationPlanningReports(beforeAlloc);
    expect(alloc.runtimeResourceAllocationPlan.memberPlans.length).toBe(
      semantic.runtimeMemberWorkload.members.length
    );
  });
});
