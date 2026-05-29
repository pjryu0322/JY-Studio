import { describe, expect, it } from "vitest";
import {
  buildImplementationEntryCursorWorkItemsRecovery,
  deriveImplementationEntryState,
} from "@/lib/prototype/implementationEntryState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";

const taskList: ImplementationTaskListV1 = {
  version: "implementation_task_list_v1",
  projectId: "p1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  source: "implementation_seed",
  seedCreatedAt: "2026-01-01T00:00:00.000Z",
  tasks: [
    {
      taskId: "DEV-001",
      title: "첫 작업",
      ownerRole: "developer",
      priority: "P0",
      status: "ready",
      taskType: "feature",
      description: "desc",
      acceptanceCriteria: ["ok"],
      sourceRefs: [],
      dependencies: [],
    },
  ],
  roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
};

const quickDesignDraft: FastPlanDraftStateV1 = {
  status: "proposed",
  generatedAt: "2026-01-01T00:00:00.000Z",
  flowId: "fast_plan_draft",
  memberRuns: [],
  memberDrafts: [{ runId: "r1", role: "planner", content: "draft", confidence: "medium" }],
  assumptions: [],
  source: "current_conversation_and_slots",
};

describe("implementationEntryState", () => {
  it("returns board_ready when implementationTaskListV1 exists", () => {
    const state = deriveImplementationEntryState({
      implementationTaskListV1: taskList,
      fastPlanDraftV1: quickDesignDraft,
      promptTimeline: [
        {
          stage: "IDEATION",
          stageGroup: "기획",
          workspaceScreenKey: "requirements",
          action: "quick_design_draft_created",
          source: "system",
          responseText: "type=quick_design_draft_created",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(state.status).toBe("board_ready");
    expect(state.primaryAction).toBe("REQUEST_CODE_AGENT_WIP");
    expect(state.needsCursorWorkItemsRegeneration).toBe(true);
  });

  it("does not show quick design draft path when taskList exists", () => {
    const state = deriveImplementationEntryState({
      implementationTaskListV1: taskList,
      fastPlanDraftV1: quickDesignDraft,
    });
    expect(state.status).not.toBe("quick_design_draft_unconfirmed");
  });

  it("returns seed_only when only implementationSeedV1 exists", () => {
    const state = deriveImplementationEntryState({
      implementationSeedV1: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        source: "planning_slots_and_artifacts",
        lifecycleStatus: "confirmed",
        readiness: { ready: true, score: 1, missing: [], warnings: [] },
        processImplementationItems: [],
        screenImplementationItems: [],
        actorCapabilityMatrix: [],
        commonDetailFeatures: [],
        dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
        assumptions: [],
        gaps: [],
      },
    });
    expect(state.status).toBe("seed_only");
    expect(state.primaryAction).toBe("GENERATE_IMPLEMENTATION_TASK_LIST");
  });

  it("regenerates cursorWorkItems when taskList exists but cursorWorkItems missing", () => {
    const recovery = buildImplementationEntryCursorWorkItemsRecovery({
      projectId: "p1",
      taskList,
      existingCursorWorkItems: [],
    });
    expect(recovery.regenerated).toBe(true);
    expect(recovery.cursorWorkItems.length).toBeGreaterThan(0);
  });
});
