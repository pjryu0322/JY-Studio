import { describe, expect, it } from "vitest";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  buildMvpAiExecutionSettingsPatch,
  llmRefinementStatusLabel,
  openaiPlannerCredentialLooksStored,
  resolvePlannerKeyUiState,
  syncEnableLlmCodeTaskRefinementFromSetup,
} from "@/lib/project/prototypeAiExecutionSettings";
import { buildImplementationPlanningReadinessPatchWithLlm } from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

const PROJECT_ID = "PROJ-AI-SETTINGS";
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

describe("prototypeAiExecutionSettings", () => {
  it("syncs enableLlmCodeTaskRefinement from fetchExecutionSetup result", () => {
    const setup = {
      enableLlmCodeTaskRefinement: true,
      hasOpenaiPlannerApiKey: true,
      openaiPlannerApiKeyMasked: "sk-****abcd",
    } as ExecutionSetupDto;

    expect(syncEnableLlmCodeTaskRefinementFromSetup(setup)).toBe(true);

    const ui = resolvePlannerKeyUiState({ executionSetup: setup, pendingDelete: false });
    expect(ui.statusLabel).toBe("설정됨");
    expect(ui.masked).toBe("sk-****abcd");
    expect(llmRefinementStatusLabel(true)).toBe("사용");
  });

  it("includes enableLlmCodeTaskRefinement in save payload when toggle is ON", () => {
    const patch = buildMvpAiExecutionSettingsPatch({
      enableLlmCodeTaskRefinement: true,
      openaiPlannerApiKeyInput: "",
      openaiPlannerApiKeyPendingDelete: false,
    });
    expect(patch).toEqual({ enableLlmCodeTaskRefinement: true });
  });

  it("includes openaiPlannerApiKey when replacing key", () => {
    const patch = buildMvpAiExecutionSettingsPatch({
      enableLlmCodeTaskRefinement: true,
      openaiPlannerApiKeyInput: "sk-test",
      openaiPlannerApiKeyPendingDelete: false,
    });
    expect(patch).toEqual({
      enableLlmCodeTaskRefinement: true,
      openaiPlannerApiKey: "sk-test",
    });
  });

  it("sends null when planner key pending delete", () => {
    const patch = buildMvpAiExecutionSettingsPatch({
      enableLlmCodeTaskRefinement: false,
      openaiPlannerApiKeyInput: "",
      openaiPlannerApiKeyPendingDelete: true,
    });
    expect(patch).toEqual({
      enableLlmCodeTaskRefinement: false,
      openaiPlannerApiKey: null,
    });
  });

  it("does not expose planner key plaintext in masked UI state after stored", () => {
    const setup = {
      hasOpenaiPlannerApiKey: true,
      openaiPlannerApiKeyMasked: "sk-****abcd",
    } as ExecutionSetupDto;
    expect(openaiPlannerCredentialLooksStored(setup)).toBe(true);
    const ui = resolvePlannerKeyUiState({ executionSetup: setup, pendingDelete: false });
    expect(ui.masked).not.toContain("sk-test");
    expect(ui.masked).toBe("sk-****abcd");
  });

  it("passes injected refinementSettings into LLM readiness path", async () => {
    const prev = process.env.ENABLE_LLM_CODE_TASK_REFINEMENT;
    delete process.env.ENABLE_LLM_CODE_TASK_REFINEMENT;
    try {
      const patch = await buildImplementationPlanningReadinessPatchWithLlm({
        projectId: PROJECT_ID,
        taskList: sampleTaskList(),
        envOk: true,
        designOk: true,
        nowIso: NOW,
        refinementSettings: {
          enableLlmCodeTaskRefinement: true,
          hasOpenaiPlannerApiKey: true,
          providerSource: "project_execution_setup",
        },
        providerContext: { apiKey: "sk-test", model: "gpt-4o-mini", providerSource: "project_execution_setup" },
        llmCaller: async () => ({ ok: true, text: validLlmTaskJson() }),
        forceLlm: true,
      });
      expect(patch.implementationCodeTaskPlanV1.refinementStatus).toBe("llm_refined");
      expect(patch.implementationCodeTaskPlanV1.refinementSource).toBe("llm_refined");
    } finally {
      if (prev === undefined) delete process.env.ENABLE_LLM_CODE_TASK_REFINEMENT;
      else process.env.ENABLE_LLM_CODE_TASK_REFINEMENT = prev;
    }
  });
});
