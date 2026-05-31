import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskPlanV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { refineImplementationCodeTaskPlanWithLlm } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-llm-refine";

function developerTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: "화면",
    description: "화면 구현",
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: ["화면 완료"],
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

function heuristicPlan(): ImplementationCodeTaskPlanV1 {
  return buildImplementationCodeTaskPlanFromTaskList({
    projectId: PROJECT_ID,
    taskList: sampleTaskList(),
    envOk: true,
    designOk: true,
    nowIso: NOW,
  });
}

function validLlmTaskJson(parentTaskId = "DEV-SCREEN-001") {
  return JSON.stringify({
    tasks: [
      {
        codeTaskId: "CODE-DEV-SCREEN-001-001",
        parentTaskId,
        title: "화면 컴포넌트",
        description: "화면 UI 구현",
        changeType: "component",
        targetHints: ["components", "screen"],
        candidateFiles: [],
        candidateFileHints: ["dir:apps/web/src/components"],
        parentTaskDependencies: [],
        codeTaskDependencies: [],
        acceptanceCriteria: ["화면 렌더링"],
        verificationHints: ["pnpm test"],
        forbiddenPaths: ["package.json"],
        priority: "P1",
        status: "ready",
        llmRationale: "화면 단위 컴포넌트로 분리",
      },
    ],
  });
}

describe("refineImplementationCodeTaskPlanWithLlm", () => {
  it("falls back to heuristic when LLM is unavailable", async () => {
    const plan = heuristicPlan();
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: plan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({ ok: false, message: "LLM unavailable" }),
    });

    expect(result.usedLlm).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(result.plan.refinementStatus).toBe("llm_unavailable_fallback");
    expect(result.plan.tasks.length).toBe(plan.tasks.length);
    expect(
      result.timelineEntries.some(
        (entry) => entry.action === "implementation_code_task_llm_refinement_fallback_used",
      ),
    ).toBe(true);
  });

  it("falls back when LLM JSON parse fails", async () => {
    const plan = heuristicPlan();
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: plan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({ ok: true, text: "not-json" }),
    });
    expect(result.fallbackUsed).toBe(true);
    expect(result.plan.refinementStatus).toBe("llm_parse_failed_fallback");
  });

  it("falls back when LLM response fails validation", async () => {
    const plan = heuristicPlan();
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: plan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({
        ok: true,
        text: validLlmTaskJson("UNKNOWN-PARENT"),
      }),
    });

    expect(result.usedLlm).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.plan.refinementSource).toBe("llm_failed_heuristic_fallback");
    expect(result.plan.refinementStatus).toBe("llm_validation_failed");
  });

  it("uses refined plan when LLM response passes validation", async () => {
    const plan = heuristicPlan();
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: plan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({
        ok: true,
        text: validLlmTaskJson(),
      }),
    });

    expect(result.usedLlm).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(result.plan.refinementSource).toBe("llm_refined");
    expect(result.validationReport.status).toBe("passed");
    expect(result.plan.tasks[0]?.llmRationale).toContain("화면");
    expect(
      result.timelineEntries.some(
        (entry) => entry.action === "implementation_code_task_llm_refinement_passed",
      ),
    ).toBe(true);
  });

  it("keeps heuristic only when LLM flag is off", async () => {
    const plan = heuristicPlan();
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: plan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      llmCaller: async () => ({
        ok: true,
        text: validLlmTaskJson(),
      }),
    });

    expect(result.usedLlm).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(result.plan.refinementStatus).toBe("heuristic_only");
  });
});
