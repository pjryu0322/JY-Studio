import { describe, expect, it } from "vitest";
import {
  buildImplementationPlanningReadinessPatch,
  evaluateImplementationPlanningExecutionGate,
} from "@/lib/prototype/implementationPlanningReadiness";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import {
  runQuickDesignConfirmImplementationPrepWithLlm,
} from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-wire-llm";

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

describe("wire llm code task refinement into planning readiness", () => {
  it("blocks execution when validationReport is missing", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const planWithoutValidation = {
      ...readiness.implementationCodeTaskPlanV1,
      validationReport: undefined,
    };
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: planWithoutValidation,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.reason).toBe("missing_code_task_validation");
  });

  it("uses llm refined plan in Quick Design prep when forceLlm and mock caller succeed", async () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: PROJECT_ID,
      projectName: "테스트",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, NOW);
    const prep = await runQuickDesignConfirmImplementationPrepWithLlm({
      projectId: PROJECT_ID,
      orchestration,
      definitions,
      nowIso: NOW,
      envOk: true,
      generatedArtifactCount: 1,
      forceLlm: true,
      llmCaller: async () => ({ ok: true, text: validLlmTaskJson() }),
    });
    if (!prep.prepComplete) {
      expect(prep.implementationCodeTaskPlanV1).toBeNull();
      return;
    }
    expect(prep.implementationCodeTaskPlanV1?.refinementSource).toBe("llm_refined");
    expect(prep.implementationCodeTaskPlanV1?.validationReport?.status).toBe("passed");
    expect(prep.cursorWorkItemsV1?.length).toBeGreaterThan(0);
  });

  it("falls back without breaking Quick Design prep when mock LLM fails", async () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: PROJECT_ID,
      projectName: "테스트",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, NOW);
    const prep = await runQuickDesignConfirmImplementationPrepWithLlm({
      projectId: PROJECT_ID,
      orchestration,
      definitions,
      nowIso: NOW,
      envOk: true,
      generatedArtifactCount: 1,
      forceLlm: true,
      llmCaller: async () => ({ ok: false, message: "LLM unavailable" }),
    });
    if (!prep.prepComplete) return;
    expect(prep.implementationCodeTaskPlanV1?.refinementStatus).toBe("llm_unavailable_fallback");
    expect(prep.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(
      prep.timelineEntries.some(
        (entry) => entry.action === "implementation_code_task_llm_refinement_fallback_used",
      ),
    ).toBe(true);
  });

  it("sync patch keeps heuristic_only with validationReport", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    expect(plan.refinementSource ?? "heuristic").toBeTruthy();
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    expect(readiness.implementationCodeTaskPlanV1.refinementStatus ?? "heuristic_only").toBe(
      "heuristic_only",
    );
    expect(readiness.implementationCodeTaskPlanV1.validationReport?.status).toBe("passed");
  });
});
