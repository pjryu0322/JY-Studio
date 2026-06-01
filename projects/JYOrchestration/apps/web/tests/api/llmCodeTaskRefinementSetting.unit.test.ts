import { describe, expect, it } from "vitest";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { refineImplementationCodeTaskPlanWithLlm } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";

const PROJECT_ID = "PROJ-LLM-SETTING";
const NOW = "2026-06-01T00:00:00.000Z";

function devTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: taskId,
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: [],
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
    tasks: [devTask("DEV-SCREEN-001")],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("LLM CodeTask refinement project toggle", () => {
  it("enable=false + env unset => heuristic_only with disabled_by_project_setting skip log", async () => {
    const prev = process.env.ENABLE_LLM_CODE_TASK_REFINEMENT;
    delete process.env.ENABLE_LLM_CODE_TASK_REFINEMENT;
    try {
      const taskList = sampleTaskList();
      const heuristicPlan = buildImplementationCodeTaskPlanFromTaskList({
        projectId: PROJECT_ID,
        taskList,
        envOk: true,
        designOk: true,
        nowIso: NOW,
      });

      const result = await refineImplementationCodeTaskPlanWithLlm({
        projectId: PROJECT_ID,
        taskList,
        heuristicPlan,
        envOk: true,
        designOk: true,
        nowIso: NOW,
        enableLlmCodeTaskRefinement: false,
      });

      expect(result.plan.refinementStatus).toBe("heuristic_only");
      expect(result.timelineEntries.some((e) => e.action === "implementation_code_task_llm_refinement_skipped")).toBe(
        true,
      );
      const skipped = result.timelineEntries.find((e) => e.action === "implementation_code_task_llm_refinement_skipped");
      expect(String(skipped?.responseText ?? "")).toContain("disabled_by_project_setting");
    } finally {
      if (prev === undefined) delete process.env.ENABLE_LLM_CODE_TASK_REFINEMENT;
      else process.env.ENABLE_LLM_CODE_TASK_REFINEMENT = prev;
    }
  });

  it("enable=true + providerSource=none + caller fails => fallback reason missing_provider_key", async () => {
    const taskList = sampleTaskList();
    const heuristicPlan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });

    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList,
      heuristicPlan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      enableLlmCodeTaskRefinement: true,
      providerContext: { apiKey: null, model: "gpt-4o-mini", providerSource: "none" },
      llmCaller: async () => ({ ok: false, message: "missing key" }),
      forceLlm: true,
    });

    expect(result.plan.refinementStatus).toBe("llm_unavailable_fallback");
    const fallback = result.timelineEntries.find((e) => e.action === "implementation_code_task_llm_refinement_fallback_used");
    expect(fallback).toBeTruthy();
    expect(String(fallback?.responseText ?? "")).toContain("missing_provider_key");
  });
});

