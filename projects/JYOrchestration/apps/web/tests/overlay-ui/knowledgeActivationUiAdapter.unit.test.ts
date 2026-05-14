import { describe, expect, it } from "vitest";

import { buildKnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/buildKnowledgeActivationPlan";
import {
  KNOWLEDGE_ACTIVATION_PLAN_DISCLAIMER,
  buildKnowledgeActivationPlanVM,
  knowledgeActivationFindingSeverityLabel,
  knowledgeActivationPriorityLabel,
  knowledgeActivationPriorityTone,
  knowledgeActivationReasonTypeLabel,
  knowledgeActivationReasonTypeTone,
} from "@/lib/overlay-ui/knowledgeActivationUiAdapter";

describe("knowledgeActivationUiAdapter labels", () => {
  it("exposes Korean priority labels and tones", () => {
    expect(knowledgeActivationPriorityLabel("required")).toBe("필수");
    expect(knowledgeActivationPriorityLabel("recommended")).toBe("추천");
    expect(knowledgeActivationPriorityLabel("optional")).toBe("선택");
    expect(knowledgeActivationPriorityTone("required")).toBe("warning");
    expect(knowledgeActivationPriorityTone("recommended")).toBe("info");
    expect(knowledgeActivationPriorityTone("optional")).toBe("neutral");
  });

  it("exposes Korean reasonType labels and tones", () => {
    expect(knowledgeActivationReasonTypeLabel("role_policy")).toBe("역할 기준");
    expect(knowledgeActivationReasonTypeLabel("stage_policy")).toBe("단계 기준");
    expect(knowledgeActivationReasonTypeLabel("task_type_policy")).toBe("작업 유형 기준");
    expect(knowledgeActivationReasonTypeLabel("existing_hint")).toBe("기존 힌트");
    expect(knowledgeActivationReasonTypeLabel("safety_requirement")).toBe("보안 기준");
    expect(knowledgeActivationReasonTypeTone("safety_requirement")).toBe("warning");
    expect(knowledgeActivationReasonTypeTone("existing_hint")).toBe("positive");
  });

  it("maps finding severity to Korean labels", () => {
    expect(knowledgeActivationFindingSeverityLabel("info")).toBe("안내");
    expect(knowledgeActivationFindingSeverityLabel("warning")).toBe("주의");
  });
});

describe("buildKnowledgeActivationPlanVM", () => {
  it("returns an empty VM when plan is missing", () => {
    const vm = buildKnowledgeActivationPlanVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(KNOWLEDGE_ACTIVATION_PLAN_DISCLAIMER);
    expect(vm.items).toEqual([]);
    expect(vm.findings).toEqual([]);
    expect(vm.totalLabel).toBe("후보 0개");
  });

  it("returns an empty VM when mode is not dry_run", () => {
    const vm = buildKnowledgeActivationPlanVM({
      mode: "apply" as unknown as "dry_run",
      roleKey: null,
      workspaceStage: null,
      taskType: null,
      items: [],
      findings: [],
    });
    expect(vm.hasData).toBe(false);
  });

  it("builds a VM from a real plan with multiple sources", () => {
    const plan = buildKnowledgeActivationPlan({
      roleKey: "developer",
      workspaceStage: "prototype-build",
      taskType: "development",
    });
    const vm = buildKnowledgeActivationPlanVM(plan);
    expect(vm.hasData).toBe(true);
    expect(vm.items.length).toBeGreaterThan(0);
    expect(vm.totalLabel).toMatch(/^후보 \d+개$/);
    expect(vm.reasonBreakdownText).toContain("역할 기준");
  });

  it("renders contextHint with role / stage / task fragments", () => {
    const vm = buildKnowledgeActivationPlanVM(
      buildKnowledgeActivationPlan({
        roleKey: "security",
        workspaceStage: "security-review",
        taskType: "security",
      })
    );
    const first = vm.items[0];
    expect(first).toBeDefined();
    expect(first?.contextHint).toBeTruthy();
  });

  it("uses missing-label fallback when context fields are empty", () => {
    const vm = buildKnowledgeActivationPlanVM(
      buildKnowledgeActivationPlan({ roleKey: null, workspaceStage: null, taskType: null })
    );
    expect(vm.roleLabel.startsWith("역할: ")).toBe(true);
    expect(vm.stageLabel.startsWith("단계: ")).toBe(true);
    expect(vm.taskTypeLabel.startsWith("작업 유형: ")).toBe(true);
  });

  it("preserves findings in VM order", () => {
    const plan = buildKnowledgeActivationPlan({
      roleKey: "unknown",
      workspaceStage: "unknown",
      taskType: "unknown",
    });
    const vm = buildKnowledgeActivationPlanVM(plan);
    expect(vm.findings.length).toBeGreaterThan(0);
    for (const f of vm.findings) {
      expect(f.message).toBeTruthy();
      expect(f.severityLabel.length).toBeGreaterThan(0);
    }
  });
});
