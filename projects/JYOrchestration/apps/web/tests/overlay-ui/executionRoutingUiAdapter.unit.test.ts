import { describe, expect, it } from "vitest";

import { buildExecutionRoutingPlan } from "@/lib/harness/executionRouting/buildExecutionRoutingPlan";
import { evaluateExecutionRoutingSafety } from "@/lib/harness/executionRouting/evaluateExecutionRoutingSafety";
import { emptyExecutionRoutingSafetyReport } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import { emptyRecentExecutionRoutingSummary } from "@/lib/harness/executionRouting/executionRoutingRecentSummary";
import {
  EXECUTION_ROUTING_PLAN_DISCLAIMER,
  EXECUTION_ROUTING_SAFETY_DISCLAIMER,
  buildExecutionRoutingPlanVM,
  buildExecutionRoutingRecentTrendVM,
  buildExecutionRoutingSafetyVM,
  executionRoutingCapabilityLabel,
  executionRoutingProviderLabel,
  executionRoutingProviderTone,
  executionRoutingReasonLabel,
  executionRoutingSafetyStatusLabel,
} from "@/lib/overlay-ui/executionRoutingUiAdapter";

describe("executionRoutingUiAdapter", () => {
  it("returns hasData=false for null/undefined plans", () => {
    const vm = buildExecutionRoutingPlanVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(EXECUTION_ROUTING_PLAN_DISCLAIMER);
    expect(vm.items).toEqual([]);
    expect(vm.findings).toEqual([]);
    expect(vm.unsupportedWarning.visible).toBe(false);
    expect(vm.totalLabel).toBe("후보 0개");
  });

  it("builds VM from planner plan", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "planner", workspaceStage: "design" });
    const vm = buildExecutionRoutingPlanVM(plan);
    expect(vm.hasData).toBe(true);
    expect(vm.roleValue).toBe("planner");
    expect(vm.stageValue).toBe("design");
    expect(vm.items.length).toBe(2);
    for (const item of vm.items) {
      expect(item.providerLabel).toBe("OpenAI");
      expect(item.enabledLabel).toBe("가능");
      expect(item.warningLabel).toBeUndefined();
    }
    expect(vm.unsupportedWarning.visible).toBe(false);
  });

  it("shows unsupportedWarning when disabled items exist", () => {
    const plan = buildExecutionRoutingPlan({
      roleKey: "developer",
      providerHints: ["github"],
    });
    const vm = buildExecutionRoutingPlanVM(plan);
    expect(vm.items.some((i) => !i.enabled)).toBe(true);
    expect(vm.unsupportedWarning.visible).toBe(true);
    expect(vm.unsupportedWarning.tone).toBe("warning");
    expect(vm.unsupportedWarning.label).toContain("provider matrix");
  });

  it("capability and provider label helpers return Korean labels", () => {
    expect(executionRoutingCapabilityLabel("planning")).toBe("기획");
    expect(executionRoutingCapabilityLabel("cursor_execution")).toBe("Cursor 실행");
    expect(executionRoutingProviderLabel("openai")).toBe("OpenAI");
    expect(executionRoutingProviderLabel("unknown")).toBe("미지정");
    expect(executionRoutingProviderTone("openai")).toBe("info");
    expect(executionRoutingProviderTone("cursor")).toBe("positive");
    expect(executionRoutingProviderTone("unknown")).toBe("warning");
  });

  it("findings are converted to VM with severity label", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "unknown-role" });
    const vm = buildExecutionRoutingPlanVM(plan);
    expect(vm.findings.length).toBeGreaterThan(0);
    for (const f of vm.findings) {
      expect(f.severityLabel.length).toBeGreaterThan(0);
    }
  });

  it("reason labels are converted to user-friendly text", () => {
    expect(executionRoutingReasonLabel("role_policy_recommended:openai")).toBe(
      "역할 정책상 추천 (OpenAI)"
    );
    expect(executionRoutingReasonLabel("provider_hint_matched:cursor")).toBe(
      "외부 힌트와 일치 (Cursor)"
    );
    expect(executionRoutingReasonLabel("provider_hint_unsupported:github")).toBe(
      "외부 힌트와 capability 불일치 (GitHub)"
    );
    expect(executionRoutingReasonLabel("no_provider_recommendation")).toBe(
      "추천 provider 없음"
    );
    expect(executionRoutingReasonLabel("")).toBe("사유 미지정");
    expect(executionRoutingReasonLabel("custom-fallback")).toBe("custom-fallback");
  });

  it("plan item VM uses friendly reason label", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "planner" });
    const vm = buildExecutionRoutingPlanVM(plan);
    for (const item of vm.items) {
      expect(item.reasonLabel).toContain("역할 정책상 추천");
    }
  });
});

describe("buildExecutionRoutingSafetyVM", () => {
  it("returns safe_dry_run fallback for null input with disclaimers and flags", () => {
    const vm = buildExecutionRoutingSafetyVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.statusLabel).toBe("안전한 미리보기");
    expect(vm.disclaimer).toBe(EXECUTION_ROUTING_SAFETY_DISCLAIMER);
    expect(vm.flags.length).toBe(3);
    for (const flag of vm.flags) {
      expect(flag.stateLabel).toBe("안 함");
      expect(flag.tone).toBe("positive");
    }
  });

  it("uses report data for status label", () => {
    const plan = buildExecutionRoutingPlan({ roleKey: "planner" });
    const report = evaluateExecutionRoutingSafety({ plan });
    const vm = buildExecutionRoutingSafetyVM(report);
    expect(vm.hasData).toBe(true);
    expect(vm.statusLabel).toBe("안전한 미리보기");
    expect(vm.summaryLine).toContain("전체 ");
  });

  it("shows watch label when report status is watch", () => {
    const report = {
      ...emptyExecutionRoutingSafetyReport(),
      status: "watch" as const,
      totalItems: 2,
      unsupportedCapabilityCount: 1,
    };
    const vm = buildExecutionRoutingSafetyVM(report);
    expect(vm.statusLabel).toBe("관찰 필요");
    expect(vm.statusTone).toBe("warning");
  });

  it("shows unsafe_to_apply label when status is unsafe", () => {
    const report = {
      ...emptyExecutionRoutingSafetyReport(),
      status: "unsafe_to_apply" as const,
    };
    const vm = buildExecutionRoutingSafetyVM(report);
    expect(vm.statusLabel).toBe("적용 부적합");
    expect(vm.statusTone).toBe("danger");
    expect(executionRoutingSafetyStatusLabel("unsafe_to_apply")).toBe("적용 부적합");
  });
});

describe("buildExecutionRoutingRecentTrendVM", () => {
  it("returns hasData=false for null/empty summary", () => {
    const vmNull = buildExecutionRoutingRecentTrendVM(null);
    expect(vmNull.hasData).toBe(false);
    expect(vmNull.disabledRateLabel).toBe("미지원 비율 0%");
    const vmEmpty = buildExecutionRoutingRecentTrendVM(emptyRecentExecutionRoutingSummary());
    expect(vmEmpty.hasData).toBe(false);
  });

  it("formats rates as integer percentages", () => {
    const vm = buildExecutionRoutingRecentTrendVM({
      sampledEntryCount: 3,
      planEntryCount: 2,
      totalItems: 4,
      disabledItemRate: 0.25,
      warningItemRate: 0.5,
      unknownProviderRate: 0.1,
      cursorCapabilityRate: 0.75,
      githubCapabilityRate: 0,
      findingRate: 1,
    });
    expect(vm.hasData).toBe(true);
    expect(vm.disabledRateLabel).toBe("미지원 비율 25%");
    expect(vm.warningRateLabel).toBe("경고 비율 50%");
    expect(vm.unknownProviderRateLabel).toBe("미지정 provider 10%");
    expect(vm.cursorCapabilityRateLabel).toBe("Cursor 계열 capability 75%");
    expect(vm.githubCapabilityRateLabel).toBe("GitHub capability 0%");
    expect(vm.findingRateLabel).toBe("진단 발생 plan 100%");
  });
});
