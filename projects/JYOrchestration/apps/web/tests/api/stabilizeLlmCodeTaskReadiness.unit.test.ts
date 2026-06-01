import { describe, expect, it, vi } from "vitest";
import { refineImplementationCodeTaskPlanWithLlm } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_MISSING_VALIDATION_MESSAGE,
  buildImplementationPlanningReadinessPatch,
} from "@/lib/prototype/implementationPlanningReadiness";
import { shouldRefreshImplementationPlanningReadiness } from "@/lib/prototype/implementationPlanningReadinessReuse";
import { buildGenerateImplementationTaskListFromSeedResultWithLlm } from "@/lib/prototype/implementationTaskListGeneration";
import { buildImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";
import { buildTaskCursorExecutionJobSummaryVm } from "@/lib/prototype/taskCursorExecutionJobUi";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-stabilize-llm";

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

function validLlmTaskJson() {
  return JSON.stringify({
    tasks: [
      {
        codeTaskId: "CODE-DEV-SCREEN-001-001",
        parentTaskId: "DEV-SCREEN-001",
        title: "화면 컴포넌트",
        description: "화면 UI 구현",
        changeType: "component",
        targetHints: ["components"],
        candidateFileHints: ["dir:apps/web/src/components"],
        parentTaskDependencies: [],
        codeTaskDependencies: [],
        acceptanceCriteria: ["화면 렌더링"],
        verificationHints: ["pnpm test"],
        forbiddenPaths: ["package.json"],
        priority: "P1",
        status: "ready",
        llmRationale: "화면 단위",
      },
    ],
  });
}

describe("shouldRefreshImplementationPlanningReadiness", () => {
  it("returns ready_reusable when validation, work items, and preflight passed", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const decision = shouldRefreshImplementationPlanningReadiness({
      existingCodeTaskPlan: readiness.implementationCodeTaskPlanV1,
      existingCursorWorkItems: readiness.cursorWorkItemsV1,
      existingPreflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(decision.refresh).toBe(false);
    expect(decision.reason).toBe("ready_reusable");
  });

  it("returns missing_code_task_validation when validationReport is absent", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const decision = shouldRefreshImplementationPlanningReadiness({
      existingCodeTaskPlan: {
        ...readiness.implementationCodeTaskPlanV1,
        validationReport: undefined,
      },
      existingCursorWorkItems: readiness.cursorWorkItemsV1,
      existingPreflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(decision.refresh).toBe(true);
    expect(decision.reason).toBe("missing_code_task_validation");
  });
});

describe("buildGenerateImplementationTaskListFromSeedResultWithLlm reuse", () => {
  it("skips LLM caller when existing readiness artifacts are reusable", async () => {
    const taskList = sampleTaskList();
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const llmCaller = vi.fn(async () => ({ ok: true as const, text: validLlmTaskJson() }));

    const result = await buildGenerateImplementationTaskListFromSeedResultWithLlm({
      projectId: PROJECT_ID,
      seed: null,
      existingTaskList: taskList,
      existingCodeTaskPlan: readiness.implementationCodeTaskPlanV1,
      existingCursorWorkItems: readiness.cursorWorkItemsV1,
      existingPreflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      llmCaller,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(llmCaller).not.toHaveBeenCalled();
    expect(result.patch.implementationCodeTaskPlanV1?.refinementStatus ?? "heuristic_only").toBe(
      "heuristic_only",
    );
    expect(
      result.patch.promptTimeline?.some(
        (entry) => entry.action === "implementation_planning_readiness_reused",
      ),
    ).toBe(true);
  });
});

describe("evaluateImplementationPlanningExecutionGate missing validation", () => {
  it("blocks with dedicated message when validationReport is missing", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: {
        ...readiness.implementationCodeTaskPlanV1,
        validationReport: undefined,
      },
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.reason).toBe("missing_code_task_validation");
    expect(gate.message).toBe(IMPLEMENTATION_PLANNING_MISSING_VALIDATION_MESSAGE);
  });
});

describe("LLM refinement fingerprint meta", () => {
  it("stores prompt/task fingerprints without raw prompt or api key", async () => {
    const taskList = sampleTaskList();
    const heuristicPlan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const refined = await refineImplementationCodeTaskPlanWithLlm({
      projectId: PROJECT_ID,
      taskList,
      heuristicPlan,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      forceLlm: true,
      llmCaller: async () => ({
        ok: true,
        text: validLlmTaskJson(),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, model: "gpt-4o-mini" },
      }),
    });
    expect(refined.plan.llmPromptFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(refined.plan.sourceTaskListFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(refined.plan.llmUsage?.totalTokens).toBe(150);
    expect(JSON.stringify(refined.plan)).not.toContain("sk-");
    expect(JSON.stringify(refined.plan)).not.toContain("[implementation code task refinement]");
  });
});

describe("planning readiness UI card", () => {
  it("shows fallback label for llm unavailable status", () => {
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
        refinementStatus: "llm_unavailable_fallback",
      },
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(vm?.llmRefinementLabel).toBe("LLM Refinement: heuristic fallback");
  });
});

describe("buildTaskCursorExecutionJobSummaryVm", () => {
  it("shows tracking headline for active server job", () => {
    const vm = buildTaskCursorExecutionJobSummaryVm({
      serverPolling: true,
      now: new Date("2026-05-28T12:10:00.000Z"),
      serverJob: {
        id: "job-1",
        projectId: PROJECT_ID,
        taskId: "DEV-A",
        status: "cursor_running",
        pollCount: 2,
        lastPollAt: "2026-05-28T12:09:00.000Z",
        nextPollAt: "2026-05-28T12:11:00.000Z",
      },
    });
    expect(vm?.headline).toBe("서버 Worker 추적 중");
    expect(vm?.observability.serverPolling).toBe(true);
  });

  it("shows delayed headline when stuck", () => {
    const vm = buildTaskCursorExecutionJobSummaryVm({
      serverPolling: true,
      now: new Date("2026-05-28T12:10:00.000Z"),
      serverJob: {
        id: "job-1",
        projectId: PROJECT_ID,
        taskId: "DEV-A",
        status: "cursor_running",
        pollCount: 3,
        lastPollAt: "2026-05-28T12:00:00.000Z",
        nextPollAt: "2026-05-28T12:05:00.000Z",
      },
    });
    expect(vm?.headline).toBe("서버 Worker 추적 지연");
    expect(vm?.observability.stuck).toBe(true);
  });

  it("marks lockedStale when lock expired", () => {
    const vm = buildTaskCursorExecutionJobSummaryVm({
      serverPolling: true,
      now: new Date("2026-05-28T12:10:00.000Z"),
      serverJob: {
        id: "job-1",
        projectId: PROJECT_ID,
        taskId: "DEV-A",
        status: "cursor_running",
        pollCount: 1,
        lockedBy: "worker-a",
        lockExpiresAt: "2026-05-28T12:08:00.000Z",
      },
    });
    expect(vm?.observability.lockedStale).toBe(true);
  });
});
