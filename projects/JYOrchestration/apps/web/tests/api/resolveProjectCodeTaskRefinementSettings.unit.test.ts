import { describe, expect, it, vi } from "vitest";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { buildImplementationPlanningReadinessPatchWithLlm } from "@/lib/prototype/implementationPlanningReadiness";
import {
  buildImplementationCodeTaskLlmRefinementDecisionTimelineEntry,
  resolveLlmRefinementDecision,
} from "@/lib/prototype/resolveProjectCodeTaskRefinementSettings";

const PROJECT_ID = "PROJ-RESOLVE-LLM";
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

vi.mock("@/lib/prototype/resolveProjectCodeTaskRefinementSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prototype/resolveProjectCodeTaskRefinementSettings")>();
  return {
    ...actual,
    resolveProjectCodeTaskRefinementSettings: vi.fn(async () => ({
      enableLlmCodeTaskRefinement: true,
      hasOpenaiPlannerApiKey: true,
      providerSource: "project_execution_setup" as const,
    })),
  };
});

describe("resolveProjectCodeTaskRefinementSettings helpers", () => {
  it("decision=enabled when project toggle on and provider key exists", () => {
    const decision = resolveLlmRefinementDecision({
      settings: {
        enableLlmCodeTaskRefinement: true,
        hasOpenaiPlannerApiKey: true,
        providerSource: "project_execution_setup",
      },
    });
    expect(decision).toEqual({ decision: "enabled", useLlm: true });
  });

  it("decision=skipped when project toggle off", () => {
    const decision = resolveLlmRefinementDecision({
      settings: {
        enableLlmCodeTaskRefinement: false,
        hasOpenaiPlannerApiKey: true,
        providerSource: "project_execution_setup",
      },
    });
    expect(decision).toEqual({
      decision: "skipped",
      skipReason: "disabled_by_project_setting",
      useLlm: false,
    });
  });

  it("decision=fallback when toggle on but provider key missing", () => {
    const decision = resolveLlmRefinementDecision({
      settings: {
        enableLlmCodeTaskRefinement: true,
        hasOpenaiPlannerApiKey: false,
        providerSource: "none",
      },
    });
    expect(decision).toEqual({
      decision: "fallback",
      skipReason: "missing_provider_key",
      useLlm: true,
    });
  });

  it("builds decision timeline without api key values", () => {
    const entry = buildImplementationCodeTaskLlmRefinementDecisionTimelineEntry({
      projectId: PROJECT_ID,
      settings: {
        enableLlmCodeTaskRefinement: true,
        hasOpenaiPlannerApiKey: true,
        providerSource: "project_execution_setup",
      },
      decision: "enabled",
      useLlm: true,
      nowIso: NOW,
    });
    expect(entry.action).toBe("implementation_code_task_llm_refinement_decision");
    expect(String(entry.responseText ?? "")).toContain("decision=enabled");
    expect(String(entry.responseText ?? "")).toContain("hasOpenaiPlannerApiKey=true");
    expect(String(entry.responseText ?? "")).not.toContain("sk-");
  });
});

describe("buildImplementationPlanningReadinessPatchWithLlm server settings", () => {
  it("uses server-resolved enableLlmCodeTaskRefinement when client override is omitted", async () => {
    const patch = await buildImplementationPlanningReadinessPatchWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
      providerContext: { apiKey: "sk-test", model: "gpt-4o-mini", providerSource: "project_execution_setup" },
      llmCaller: async () => ({ ok: true, text: validLlmTaskJson() }),
      forceLlm: true,
    });
    expect(patch.implementationCodeTaskPlanV1.refinementStatus).toBe("llm_refined");
    expect(
      patch.promptTimeline.some((entry) => entry.action === "implementation_code_task_llm_refinement_decision"),
    ).toBe(true);
  });

  it("respects explicit test override when client passes enableLlmCodeTaskRefinement=false", async () => {
    const patch = await buildImplementationPlanningReadinessPatchWithLlm({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
      enableLlmCodeTaskRefinement: false,
      providerContext: { apiKey: "sk-test", model: "gpt-4o-mini", providerSource: "project_execution_setup" },
      llmCaller: async () => ({ ok: true, text: validLlmTaskJson() }),
    });
    expect(patch.implementationCodeTaskPlanV1.refinementStatus).toBe("heuristic_only");
    const decision = patch.promptTimeline.find(
      (entry) => entry.action === "implementation_code_task_llm_refinement_decision",
    );
    expect(String(decision?.responseText ?? "")).toContain("decision=skipped");
  });
});
