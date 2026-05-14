import { describe, expect, it } from "vitest";

import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayConflictWarning } from "@/lib/overlay/overlayConflictDetection";
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";
import type { OverlayPruningCandidate } from "@/lib/overlay/overlayContextPruning";

describe("buildOverlayUiViewModel", () => {
  it("returns hasOverlayData=false on null/undefined input", () => {
    const vmNull = buildOverlayUiViewModel(null);
    const vmUndef = buildOverlayUiViewModel(undefined);
    expect(vmNull.hasOverlayData).toBe(false);
    expect(vmUndef.hasOverlayData).toBe(false);
    expect(vmNull.context.hasData).toBe(false);
    expect(vmNull.budget.hasData).toBe(false);
    expect(vmNull.warning.hasData).toBe(false);
    expect(vmNull.assemblyPlan.hasData).toBe(false);
    expect(vmNull.pruning.hasData).toBe(false);
    expect(vmNull.summary.hasData).toBe(false);
    expect(vmNull.sectionDefaults.context).toBe(true);
    expect(vmNull.sectionDefaults.budget).toBe(true);
    expect(vmNull.sectionDefaults.warning).toBe(false);
    expect(vmNull.sectionDefaults.assemblyPlan).toBe(false);
    expect(vmNull.sectionDefaults.pruning).toBe(false);
  });

  it("returns hasOverlayData=false on empty object input", () => {
    const vm = buildOverlayUiViewModel({});
    expect(vm.hasOverlayData).toBe(false);
    expect(vm.context.planningComment).toContain("기록되지");
    expect(vm.budget.overflowRiskLabel).toBe("ㅡ");
  });

  it("converts selected + prioritized refs into rows", () => {
    const refs: readonly OverlaySelectedContextRef[] = [
      { type: "memory", source: "platform", reason: "role_default", priority: 10 },
      { type: "role", source: "planner", reason: "bootstrap", priority: 0 },
      { type: "knowledge", source: "pack1", reason: "knowledge_hint", priority: 20 },
    ];
    const meta: ExtractedOverlayPromptTraceMetadata = {
      overlaySelectedContextRefs: refs,
      overlayPrioritizedContextRefs: [refs[2], refs[0], refs[1]],
    };
    const vm = buildOverlayUiViewModel(meta);
    expect(vm.context.hasData).toBe(true);
    expect(vm.context.selected.length).toBe(3);
    expect(vm.context.prioritized.length).toBe(3);
    const roleRow = vm.context.selected.find((r) => r.source === "planner");
    expect(roleRow?.typeLabel).toBe("역할");
    const memRow = vm.context.selected.find((r) => r.source === "platform");
    expect(memRow?.typeLabel).toBe("기억 컨텍스트");
  });

  it("converts budget metadata into user-facing strings", () => {
    const budget: OverlayContextBudgetMetadata = {
      estimatedInputTokens: 1234,
      estimatedOutputTokens: 256,
      budgetPolicy: "compact",
      overflowRisk: "high",
    };
    const vm = buildOverlayUiViewModel({ overlayContextBudget: budget });
    expect(vm.budget.hasData).toBe(true);
    expect(vm.budget.budgetPolicyLabel).toBe("압축 정책");
    expect(vm.budget.overflowRiskLabel).toBe("높음");
    expect(vm.budget.overflowRiskTone).toBe("warning");
    expect(vm.budget.estimatedInputTokens).toBe(1234);
    expect(vm.summary.hasData).toBe(true);
  });

  it("converts conflict + drift warnings into rows", () => {
    const conflicts: readonly OverlayConflictWarning[] = [
      { code: "OVERLAY_CONFLICT_X", severity: "warning", category: "architecture", message: "충돌 1" },
    ];
    const drift: readonly OverlayPolicyWarning[] = [
      { code: "OVERLAY_DRIFT_Y", severity: "info", message: "정렬 이슈", source: "diagnostic", enforcement: "not_applied", roleKey: null },
    ];
    const vm = buildOverlayUiViewModel({
      overlayConflictWarnings: conflicts,
      overlayPolicyDriftWarnings: drift,
    });
    expect(vm.warning.hasData).toBe(true);
    expect(vm.warning.conflictRows[0].severityLabel).toBe("주의");
    expect(vm.warning.driftRows[0].severityLabel).toBe("정보");
    expect(vm.summary.conflictCount).toBe(1);
    expect(vm.summary.driftCount).toBe(1);
    expect(vm.summary.warningCount).toBe(2);
    expect(vm.sectionDefaults.warning).toBe(true);
  });

  it("aggregates assembly plan by includeMode and surfaces required/excludeCandidate counts", () => {
    const plan: readonly OverlayAssemblyPlanItem[] = [
      {
        type: "memory",
        source: "platform",
        priority: 10,
        includeReason: "role_default",
        estimatedCost: 100,
        pruningCandidate: false,
        includeMode: "required",
      },
      {
        type: "timeline",
        source: "recent",
        priority: 80,
        includeReason: "timeline_default",
        estimatedCost: 120,
        pruningCandidate: true,
        includeMode: "excludeCandidate",
      },
      {
        type: "knowledge",
        source: "pack1",
        priority: 30,
        includeReason: "knowledge_hint",
        estimatedCost: 60,
        pruningCandidate: false,
        includeMode: "recommended",
      },
    ];
    const vm = buildOverlayUiViewModel({ overlayContextAssemblyPlan: plan });
    expect(vm.assemblyPlan.hasData).toBe(true);
    expect(vm.assemblyPlan.totalCount).toBe(3);
    expect(vm.assemblyPlan.byIncludeMode.required).toBe(1);
    expect(vm.assemblyPlan.byIncludeMode.excludeCandidate).toBe(1);
    expect(vm.assemblyPlan.byIncludeMode.recommended).toBe(1);
    expect(vm.assemblyPlan.byIncludeMode.optional).toBe(0);
    expect(vm.summary.assemblyIncludeModeCounts.required).toBe(1);
    expect(vm.summary.assemblyIncludeModeCounts.excludeCandidate).toBe(1);
  });

  it("converts pruning candidates into rows with safe defaults", () => {
    const candidates: readonly OverlayPruningCandidate[] = [
      { source: "timeline:recent", reason: "overflow_high_low_priority_timeline", estimatedReduction: 80 },
      { source: "", reason: "", estimatedReduction: Number.NaN },
    ];
    const vm = buildOverlayUiViewModel({ overlayPruningCandidates: candidates });
    expect(vm.pruning.hasData).toBe(true);
    expect(vm.pruning.rows.length).toBe(2);
    expect(vm.pruning.rows[0].estimatedReduction).toBe(80);
    expect(vm.pruning.rows[1].source).toBe("(미지정)");
    expect(vm.pruning.rows[1].reason).toBe("축소 후보");
    expect(vm.pruning.rows[1].estimatedReduction).toBe(0);
  });

  it("flags hasOverlayData when only one section has data", () => {
    const vm = buildOverlayUiViewModel({
      overlayContextBudget: {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        budgetPolicy: "default",
        overflowRisk: "low",
      },
    });
    expect(vm.hasOverlayData).toBe(true);
    expect(vm.budget.hasData).toBe(true);
    expect(vm.context.hasData).toBe(false);
  });

  it("derives identityRoleLabel from overlayIdentity", () => {
    const vm = buildOverlayUiViewModel({
      overlayIdentity: { roleKey: "planner", perspective: "system", provider: "openai", capabilities: ["plan"] },
    });
    expect(vm.context.identityRoleLabel).toContain("planner");
  });

  it("populates summary header from sections", () => {
    const refs: readonly OverlaySelectedContextRef[] = [
      { type: "memory", source: "platform", reason: "role_default", priority: 10 },
      { type: "role", source: "planner", reason: "bootstrap", priority: 0 },
    ];
    const conflicts: readonly OverlayConflictWarning[] = [
      { code: "C1", severity: "warning", category: "architecture", message: "x" },
    ];
    const drift: readonly OverlayPolicyWarning[] = [
      { code: "D1", severity: "info", message: "y", source: "diagnostic", enforcement: "not_applied", roleKey: null },
    ];
    const plan: readonly OverlayAssemblyPlanItem[] = [
      { type: "memory", source: "platform", priority: 10, includeReason: "r", estimatedCost: 100, pruningCandidate: false, includeMode: "required" },
      { type: "timeline", source: "recent", priority: 80, includeReason: "r", estimatedCost: 100, pruningCandidate: true, includeMode: "excludeCandidate" },
    ];
    const pruning: readonly OverlayPruningCandidate[] = [
      { source: "timeline:recent", reason: "x", estimatedReduction: 40 },
    ];
    const vm = buildOverlayUiViewModel({
      overlaySelectedContextRefs: refs,
      overlayPrioritizedContextRefs: refs,
      overlayConflictWarnings: conflicts,
      overlayPolicyDriftWarnings: drift,
      overlayContextAssemblyPlan: plan,
      overlayPruningCandidates: pruning,
      overlayContextBudget: {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 100,
        budgetPolicy: "compact",
        overflowRisk: "high",
      },
      overlayIdentity: { roleKey: "planner", perspective: "system", provider: "openai", capabilities: ["plan"] },
    });
    expect(vm.summary.hasData).toBe(true);
    expect(vm.summary.roleLabel).toContain("planner");
    expect(vm.summary.selectedContextCount).toBe(2);
    expect(vm.summary.prioritizedContextCount).toBe(2);
    expect(vm.summary.conflictCount).toBe(1);
    expect(vm.summary.driftCount).toBe(1);
    expect(vm.summary.warningCount).toBe(2);
    expect(vm.summary.pruningCandidateCount).toBe(1);
    expect(vm.summary.overflowRiskLabel).toBe("높음");
    expect(vm.summary.overflowRiskTone).toBe("warning");
    expect(vm.summary.assemblyIncludeModeCounts.required).toBe(1);
    expect(vm.summary.assemblyIncludeModeCounts.excludeCandidate).toBe(1);
    expect(vm.sectionDefaults.warning).toBe(true);
    expect(vm.sectionDefaults.pruning).toBe(true);
    expect(vm.sectionDefaults.assemblyPlan).toBe(false);
  });

  it("summary header has hasData=false on empty metadata", () => {
    const vm = buildOverlayUiViewModel(null);
    expect(vm.summary.hasData).toBe(false);
    expect(vm.summary.warningCount).toBe(0);
    expect(vm.summary.selectedContextCount).toBe(0);
    expect(vm.summary.assemblyIncludeModeCounts.required).toBe(0);
  });
});
