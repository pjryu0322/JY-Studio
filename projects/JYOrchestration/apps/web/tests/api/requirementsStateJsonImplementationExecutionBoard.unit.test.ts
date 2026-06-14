import { describe, expect, it } from "vitest";
import { buildInitialImplementationIntegratedExecutionState } from "@/lib/prototype/implementationIntegratedExecutionState";
import { parseImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { parseCodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecutionStateWire";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

const NOW = "2026-05-28T12:00:00.000Z";

describe("requirementsStateJson implementation execution board state", () => {
  const integratedState = buildInitialImplementationIntegratedExecutionState({
    projectId: "p1",
    nowIso: NOW,
  });

  const boardState = parseImplementationExecutionBoardStateV1({
    version: "implementation_execution_board_state_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    userConfirmations: [
      {
        taskId: "dev-1",
        status: "required_non_blocking",
        reason: "확인 필요",
      },
    ],
    reworkRequests: [
      {
        requestId: "rw-1",
        taskId: "dev-1",
        targetRole: "developer",
        reason: "재작업",
        status: "requested",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  });

  it("parseRequirementsStateJson parses integrated and board state", () => {
    const state = parseRequirementsStateJson({
      implementationIntegratedExecutionStateV1: integratedState,
      implementationExecutionBoardStateV1: boardState,
    });
    expect(state.implementationIntegratedExecutionStateV1?.projectId).toBe("p1");
    expect(state.implementationExecutionBoardStateV1?.userConfirmations).toHaveLength(1);
    expect(state.implementationExecutionBoardStateV1?.reworkRequests).toHaveLength(1);
  });

  it("mergeRequirementsStateJson preserves integrated and board state", () => {
    const base = parseRequirementsStateJson({});
    const merged = mergeRequirementsStateJson(base, {
      implementationIntegratedExecutionStateV1: integratedState,
      implementationExecutionBoardStateV1: boardState ?? null,
    });
    expect(merged.implementationIntegratedExecutionStateV1?.items).toHaveLength(4);
    expect(merged.implementationExecutionBoardStateV1?.userConfirmations[0]?.taskId).toBe("dev-1");
  });

  it("persist patch includes integrated and board state", () => {
    const patch = buildPrototypeExecutionOrchestrationPersistPatch(
      {},
      {
        implementationIntegratedExecutionStateV1: integratedState,
        implementationExecutionBoardStateV1: boardState ?? null,
      },
    );
    expect(patch.implementationIntegratedExecutionStateV1?.version).toBe(
      "implementation_integrated_execution_state_v1",
    );
    expect(patch.implementationExecutionBoardStateV1?.version).toBe(
      "implementation_execution_board_state_v1",
    );
  });

  it("parseRequirementsStateJson preserves resolved user confirmation", () => {
    const resolvedBoard = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [
        {
          taskId: "dev-1",
          status: "blocking",
          reason: "확인",
          resolvedAt: NOW,
          resolvedByUser: true,
        },
      ],
      reworkRequests: [],
    });
    const state = parseRequirementsStateJson({
      implementationExecutionBoardStateV1: resolvedBoard,
    });
    const confirmation = state.implementationExecutionBoardStateV1?.userConfirmations[0];
    expect(confirmation?.resolvedAt).toBe(NOW);
    expect(confirmation?.resolvedByUser).toBe(true);
  });

  it("mergeRequirementsStateJson updates implementationExecutionBoardStateV1", () => {
    const base = parseRequirementsStateJson({});
    const merged = mergeRequirementsStateJson(base, {
      implementationExecutionBoardStateV1: boardState ?? null,
    });
    expect(merged.implementationExecutionBoardStateV1?.reworkRequests[0]?.requestId).toBe("rw-1");
  });

  it("mergeRequirementsStateJson preserves codeAgentWipExecutionV1 selectedTaskId", () => {
    const plan: ImplementationTaskPlanV1 = {
      version: "implementation_task_plan_v1",
      projectId: "p1",
      createdAt: NOW,
      source: "implementation_orchestration",
      items: [],
      readiness: { ready: true, score: 1, missing: [] },
    };
    const workItems: readonly CursorWorkItem[] = [
      {
        id: "wi-1",
        taskId: "dev-1",
        title: "t",
        prompt: "p",
        requiredFilesHint: [],
        expectedOutput: [],
        testCommands: [],
        forbiddenPaths: [],
        blocked: false,
        blockers: [],
        qualityGate: { score: 1, promptReady: true, missing: [] },
      },
    ];
    const wip = {
      ...buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems }),
      selectedTaskId: "dev-1",
      selectedWorkItemIds: ["wi-1"],
    };
    const merged = mergeRequirementsStateJson(parseRequirementsStateJson({}), {
      codeAgentWipExecutionV1: wip,
    });
    expect(merged.codeAgentWipExecutionV1?.selectedTaskId).toBe("dev-1");
    expect(merged.codeAgentWipExecutionV1?.selectedWorkItemIds).toEqual(["wi-1"]);
    expect(parseCodeAgentWipExecutionV1(merged.codeAgentWipExecutionV1)?.selectedTaskId).toBe("dev-1");
  });
});
