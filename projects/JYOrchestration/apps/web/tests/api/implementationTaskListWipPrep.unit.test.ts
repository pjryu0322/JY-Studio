import { describe, expect, it } from "vitest";
import {
  buildImplementationCursorGateContext,
  evaluateImplementationCursorGate,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import {
  buildTaskListDerivedWipOrchestration,
  mergeTaskListWipRuntimeState,
} from "@/lib/prototype/implementationTaskListWipPrep";
import { evaluateImplementationStageActionGate } from "@/lib/prototype/implementationStageActionPipeline";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const nowIso = "2026-05-28T12:00:00.000Z";

const seed = {
  version: "implementation_seed_v1",
  projectId: "p-wip",
  createdAt: nowIso,
  updatedAt: nowIso,
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
} as ImplementationSeedV1;

const taskList: ImplementationTaskListV1 = {
  version: "implementation_task_list_v1",
  projectId: "p-wip",
  createdAt: nowIso,
  updatedAt: nowIso,
  source: "implementation_seed",
  tasks: [
    {
      taskId: "dev-1",
      title: "화면",
      description: "d",
      taskType: "screen",
      ownerRole: "developer",
      priority: "high",
      dependencies: [],
      acceptanceCriteria: ["a"],
      status: "ready",
    },
    {
      taskId: "rev-1",
      title: "검수",
      description: "d",
      taskType: "validation",
      ownerRole: "reviewer",
      priority: "medium",
      dependencies: [],
      acceptanceCriteria: [],
      status: "ready",
    },
    {
      taskId: "sec-1",
      title: "보안",
      description: "d",
      taskType: "security",
      ownerRole: "security",
      priority: "medium",
      dependencies: [],
      acceptanceCriteria: [],
      status: "ready",
    },
    {
      taskId: "scm-1",
      title: "scm",
      description: "d",
      taskType: "scm",
      ownerRole: "scm",
      priority: "low",
      dependencies: [],
      acceptanceCriteria: [],
      status: "ready",
    },
  ],
  roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 1 },
};

describe("implementationTaskListWipPrep", () => {
  it("mergeTaskListWipRuntimeState allows immediate cursor gate re-evaluation", () => {
    const derived = buildTaskListDerivedWipOrchestration({
      projectId: "p-wip",
      taskList,
      projectArtifacts: [],
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    const merged = mergeTaskListWipRuntimeState({}, derived);
    const gate = evaluateImplementationCursorGate(
      buildImplementationCursorGateContext(merged, { envOk: true, designOk: true }),
    );
    expect(gate.allowed).toBe(true);
    expect(merged.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(merged.implementationTaskExecutionStateV1?.items.length).toBe(taskList.tasks.length);
  });

  it("REQUEST_CODE_AGENT_WIP gate ok when task list ready without work plan draft", () => {
    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: seed,
        implementationTaskListV1: taskList,
      },
      envOk: true,
      designOk: true,
    });
    const gate = evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", effective);
    expect(gate.ok).toBe(true);
  });

  it("REVIEW_DB_INTEGRATION gate ok when task list ready", () => {
    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: seed,
        implementationTaskListV1: taskList,
      },
      envOk: true,
      designOk: true,
    });
    const gate = evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", effective);
    expect(gate.ok).toBe(true);
    if (!gate.ok) expect(gate.message).not.toContain("구현 작업안 초안 생성");
  });
});
