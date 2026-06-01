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
    expect(result.plan.refinementStatus).toBe("llm_validation_failed_fallback");
    const failed = result.timelineEntries.find((e) => e.action === "implementation_code_task_llm_refinement_failed");
    expect(String(failed?.responseText ?? "")).toContain("errorCode=validation_failed");
  });

  it("parses markdown-fenced JSON and refines successfully", async () => {
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
        text: "```json\n" + validLlmTaskJson() + "\n```",
      }),
    });
    expect(result.fallbackUsed).toBe(false);
    expect(result.plan.refinementStatus).toBe("llm_refined");
    expect(
      result.timelineEntries.some((e) => e.action === "implementation_code_task_llm_json_recovered"),
    ).toBe(true);
  });

  it("records parse attempt timeline entries on JSON parse failure", async () => {
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
    const attempts = result.timelineEntries.filter(
      (e) => e.action === "implementation_code_task_llm_parse_attempt",
    );
    expect(attempts.length).toBeGreaterThanOrEqual(3);
    expect(attempts.some((e) => String(e.responseText ?? "").includes("direct_json_parse"))).toBe(true);
  });

  it("uses json_shape_invalid when JSON parses but tasks shape is wrong", async () => {
    const plan = heuristicPlan();
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      heuristicPlan: plan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({ ok: true, text: JSON.stringify({ summary: "no tasks array" }) }),
    });
    expect(result.plan.refinementStatus).toBe("llm_shape_invalid_fallback");
    const failed = result.timelineEntries.find((e) => e.action === "implementation_code_task_llm_refinement_failed");
    expect(String(failed?.responseText ?? "")).toContain("errorCode=json_shape_invalid");
  });

  it("normalizes codeTasks root and refines successfully", async () => {
    const plan = heuristicPlan();
    const payload = JSON.parse(validLlmTaskJson()) as { tasks: unknown[] };
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
        text: JSON.stringify({ codeTasks: payload.tasks }),
      }),
    });
    expect(result.fallbackUsed).toBe(false);
    expect(
      result.timelineEntries.some((e) => e.action === "implementation_code_task_llm_json_normalized"),
    ).toBe(true);
  });

  it("5-4: records safe metadata on parse failure without raw body in timeline", async () => {
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
      providerContext: { apiKey: "sk-test", model: "gpt-4o-mini", providerSource: "project_execution_setup" },
    });
    expect(result.plan.refinementStatus).toBe("llm_parse_failed_fallback");
    const failed = result.timelineEntries.find((e) => e.action === "implementation_code_task_llm_refinement_failed");
    expect(String(failed?.responseText ?? "")).toContain("errorCode=json_parse_failed");
    expect(String(failed?.responseText ?? "")).toContain("responseHash=");
    expect(String(failed?.responseText ?? "")).toContain("extractFailureReason=");
    expect(String(failed?.responseText ?? "")).not.toContain("not-json");
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
