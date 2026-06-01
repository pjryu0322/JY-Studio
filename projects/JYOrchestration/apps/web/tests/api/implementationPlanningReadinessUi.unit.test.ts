import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskPlanV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { buildImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";
import { buildImplementationPlanningReadinessPatch } from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-planning-ui";

function developerTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: taskId,
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: [`${taskId} 완료`],
    sourceRefs: [],
  };
}

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [developerTask("DEV-SCREEN-001")],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("buildImplementationPlanningReadinessCardVM", () => {
  it("returns null when no planning readiness artifacts exist", () => {
    expect(buildImplementationPlanningReadinessCardVM({})).toBeNull();
  });

  it("shows ready state with counts and heuristic label", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      taskList: sampleTaskList(),
    });
    expect(vm).not.toBeNull();
    if (!vm) return;
    expect(vm.overallLabel).toBe("준비됨");
    expect(vm.codeTaskCount).toBeGreaterThan(0);
    expect(vm.workItemCount).toBeGreaterThan(0);
    expect(vm.llmRefinementLabel).toContain("heuristic only");
    expect(vm.executionReady).toBe(true);
    expect(vm.advancedTasks.length).toBeGreaterThan(0);
  });

  it("shows failed state when validation report failed", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const failedPlan: ImplementationCodeTaskPlanV1 = {
      ...readiness.implementationCodeTaskPlanV1,
      validationReport: {
        status: "failed",
        checkedAt: NOW,
        errors: ["invalid plan"],
        warnings: [],
      },
    };
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: failedPlan,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(vm?.overallLabel).toBe("보완 필요");
    expect(vm?.executionReady).toBe(false);
    expect(vm?.supplementReasons.some((reason) => reason.includes("invalid plan"))).toBe(true);
  });

  it("shows llm refinement label when plan is llm refined", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: {
        ...readiness.implementationCodeTaskPlanV1,
        refinementStatus: "llm_refined",
      },
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(vm?.llmRefinementLabel).toContain("적용됨");
  });
});
