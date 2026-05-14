import { describe, expect, it } from "vitest";

import { buildExecutionRoutingPlan } from "@/lib/harness/executionRouting/buildExecutionRoutingPlan";
import {
  EXECUTION_ROUTING_PLAN_DISCLAIMER,
  buildExecutionRoutingPlanVM,
  executionRoutingCapabilityLabel,
  executionRoutingProviderLabel,
  executionRoutingProviderTone,
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
});
