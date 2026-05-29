import { describe, expect, it } from "vitest";
import { buildCursorWorkItemsFromImplementationTaskList } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  buildImplementationCursorGateContext,
  evaluateImplementationCursorGate,
  formatImplementationCursorBlockedNotice,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { evaluateImplementationStageActionGate } from "@/lib/prototype/implementationStageActionPipeline";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { evaluateTaskListBoardWipGate } from "@/lib/prototype/implementationTaskListBoardWipGate";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-29T12:00:00.000Z";

const seed: ImplementationSeedV1 = {
  version: "implementation_seed_v1",
  projectId: "p-reg",
  createdAt: NOW,
  updatedAt: NOW,
  source: "planning_slots_and_artifacts",
  lifecycleStatus: "confirmed",
  readiness: { ready: true, score: 1, missing: [], warnings: [] },
  processImplementationItems: [],
  screenImplementationItems: [{ id: "s1", title: "화면", description: "d" }],
  actorCapabilityMatrix: [],
  commonDetailFeatures: [],
  dataModelSeed: { entities: [], relationships: [] },
  assumptions: [],
  gaps: [],
};

function makeTaskList(developerCount = 14): ImplementationTaskListV1 {
  const devTasks = Array.from({ length: developerCount }, (_, i) => ({
    taskId: `DEV-${String(i + 1).padStart(3, "0")}`,
    title: `작업 ${i + 1}`,
    description: "d",
    taskType: "screen" as const,
    ownerRole: "developer" as const,
    priority: "high" as const,
    dependencies: i === 0 ? [] : [`DEV-${String(i).padStart(3, "0")}`],
    acceptanceCriteria: ["ok"],
    status: "ready" as const,
  }));
  const supportTasks = [
    {
      taskId: "rev-1",
      title: "검수",
      description: "d",
      taskType: "validation" as const,
      ownerRole: "reviewer" as const,
      priority: "medium" as const,
      dependencies: [] as string[],
      acceptanceCriteria: ["ok"],
      status: "ready" as const,
    },
    {
      taskId: "sec-1",
      title: "보안",
      description: "d",
      taskType: "security" as const,
      ownerRole: "security" as const,
      priority: "medium" as const,
      dependencies: [] as string[],
      acceptanceCriteria: ["ok"],
      status: "ready" as const,
    },
    {
      taskId: "scm-1",
      title: "scm",
      description: "d",
      taskType: "scm" as const,
      ownerRole: "scm" as const,
      priority: "low" as const,
      dependencies: [] as string[],
      acceptanceCriteria: ["ok"],
      status: "ready" as const,
    },
  ];
  return {
    version: "implementation_task_list_v1",
    projectId: "p-reg",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [...devTasks, ...supportTasks],
    roleSummary: { developer: developerCount, designer: 0, reviewer: 1, security: 1, scm: 1 },
  };
}

describe("implementationTaskListBoardWipGate", () => {
  it("REQUEST_CODE_AGENT_WIP allows task-list-based implementation even when legacy slots are missing", () => {
    const taskList = makeTaskList(14);
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-reg",
      taskList,
      nowIso: NOW,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskList({
      projectId: "p-reg",
      taskList,
      nowIso: NOW,
    });

    const gate = evaluateTaskListBoardWipGate({
      projectId: "p-reg",
      taskList,
      executionState,
      workItems,
      envOk: true,
    });

    expect(gate.allowed).toBe(true);
    expect(gate.selectedTaskId).toBeTruthy();
    expect(gate.selectedWorkItems?.length).toBeGreaterThan(0);
    expect(gate.missing).not.toContain("기획 산출물 completeness");
    expect(gate.missing.some((m) => m.includes("구현 슬롯"))).toBe(false);
    expect(gate.missing.some((m) => m.includes("구현 task 목록"))).toBe(false);

    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: seed,
        implementationTaskListV1: taskList,
        implementationTaskExecutionStateV1: executionState,
        cursorWorkItemsV1: workItems,
      },
      envOk: true,
      designOk: false,
    });
    expect(evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", effective).ok).toBe(true);

    const cursorGate = evaluateImplementationCursorGate(
      buildImplementationCursorGateContext(
        {
          implementationTaskListV1: taskList,
          implementationTaskExecutionStateV1: executionState,
          cursorWorkItemsV1: workItems,
          implementationSlotsV1: null,
          implementationTaskPlanV1: null,
        },
        { envOk: true, designOk: false },
        { projectId: "p-reg" },
      ),
    );
    expect(cursorGate.allowed).toBe(true);
    const notice = formatImplementationCursorBlockedNotice(
      buildImplementationCursorGateContext(
        {
          implementationTaskListV1: taskList,
          implementationTaskExecutionStateV1: executionState,
          cursorWorkItemsV1: workItems,
        },
        { envOk: true, designOk: false },
        { projectId: "p-reg" },
      ),
    );
    expect(notice).not.toContain("기획 산출물 completeness");
    expect(notice).not.toContain("구현 슬롯");
  });

  it("taskList exists + cursorWorkItems missing → blocked without slot messages", () => {
    const taskList = makeTaskList(1);
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-reg",
      taskList,
      nowIso: NOW,
    });
    const gate = evaluateTaskListBoardWipGate({
      projectId: "p-reg",
      taskList,
      executionState,
      workItems: [],
      envOk: true,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.missing).toContain("Cursor WorkItem이 없습니다.");
    expect(gate.missing.some((m) => m.includes("구현 슬롯"))).toBe(false);
  });

  it("missing cursor api still allows task-list WIP gate", () => {
    const taskList = makeTaskList(14);
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-reg",
      taskList,
      nowIso: NOW,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskList({
      projectId: "p-reg",
      taskList,
      nowIso: NOW,
    });

    const gate = evaluateTaskListBoardWipGate({
      projectId: "p-reg",
      taskList,
      executionState,
      workItems,
      envOk: false,
    });

    expect(gate.allowed).toBe(true);
    expect(gate.selectedTaskId).toBeTruthy();
  });

  it("taskList missing → blocked with task list message", () => {
    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: seed },
      envOk: true,
      designOk: true,
    });
    const gate = evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", effective);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.message).toContain("구현 작업목록");
    }
  });
});
