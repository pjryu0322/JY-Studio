import { describe, expect, it } from "vitest";
import {
  evaluatePlanningArtifactReadiness,
  hasQuickDesignDraftInState,
} from "@/lib/prototype/planningArtifactReadiness";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const planningArtifact: ProjectArtifact = {
  id: "a1",
  type: "fast_prototype_plan",
  title: "plan",
  content: "# plan",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "ai",
  sourceStage: "IDEATION",
};

const quickDesignDraft: FastPlanDraftStateV1 = {
  status: "proposed",
  generatedAt: "2026-01-01T00:00:00.000Z",
  flowId: "fast_plan_draft",
  memberRuns: [],
  memberDrafts: [{ runId: "r1", role: "planner", content: "draft", confidence: "medium" }],
  assumptions: [],
  source: "current_conversation_and_slots",
  slotCandidatePatch: {
    source: "quick_design",
    runId: "r1",
    patchedSlotKeys: ["slot.planning.servicePurpose"],
    updatedSlotKeys: ["slot.planning.servicePurpose"],
    areaCounts: { planning: 1, analysis: 0, architecture: 0, design: 0 },
    entries: [],
    candidateSlotKeys: ["slot.planning.servicePurpose"],
    assumedSlotKeys: [],
    patchedAt: "2026-01-01T00:00:00.000Z",
  },
};

const quickDesignTimeline: readonly RequirementsPromptTimelineEntry[] = [
  {
    stage: "IDEATION",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_draft_created",
    source: "system",
    responseText: "type=quick_design_draft_created",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    stage: "IDEATION",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_slots_patched",
    source: "system",
    responseText: "type=quick_design_slots_patched",
    createdAt: "2026-01-01T00:00:01.000Z",
  },
];

describe("planningArtifactReadiness", () => {
  it("returns confirmed when implementationSeedV1 exists", () => {
    const readiness = evaluatePlanningArtifactReadiness({
      implementationSeedV1: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        source: "planning_slots_and_artifacts",
        lifecycleStatus: "candidate",
        readiness: { ready: false, score: 0, missing: [], warnings: [] },
        processImplementationItems: [],
        screenImplementationItems: [],
        actorCapabilityMatrix: [],
        commonDetailFeatures: [],
        dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
        assumptions: [],
        gaps: [],
      },
    });
    expect(readiness.status).toBe("confirmed_artifacts_ready");
  });

  it("returns quick_design_draft_unconfirmed when draft exists without seed", () => {
    const readiness = evaluatePlanningArtifactReadiness({
      fastPlanDraftV1: quickDesignDraft,
      promptTimeline: quickDesignTimeline,
      projectArtifacts: [],
    });
    expect(readiness.status).toBe("quick_design_draft_unconfirmed");
    expect(readiness.canPromoteQuickDesign).toBe(true);
  });

  it("returns missing when no seed and no quick design draft", () => {
    const readiness = evaluatePlanningArtifactReadiness({
      projectArtifacts: [],
    });
    expect(readiness.status).toBe("missing_planning_artifacts");
  });

  it("returns confirmed when reference planning artifacts exist", () => {
    const readiness = evaluatePlanningArtifactReadiness({
      projectArtifacts: [planningArtifact],
    });
    expect(readiness.status).toBe("confirmed_artifacts_ready");
  });

  it("returns confirmed when implementationTaskListV1 exists even with quick design draft", () => {
    const readiness = evaluatePlanningArtifactReadiness({
      projectArtifacts: [],
      fastPlanDraftV1: quickDesignDraft,
      promptTimeline: quickDesignTimeline,
      implementationTaskListV1: {
        version: "implementation_task_list_v1",
        projectId: "p1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        source: "implementation_seed",
        seedCreatedAt: "2026-01-01T00:00:00.000Z",
        tasks: [
          {
            taskId: "DEV-001",
            title: "작업",
            ownerRole: "developer",
            priority: "P0",
            status: "ready",
            taskType: "feature",
            description: "d",
            acceptanceCriteria: [],
            sourceRefs: [],
            dependencies: [],
          },
        ],
        roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
      },
    });
    expect(readiness.status).toBe("confirmed_artifacts_ready");
  });

  it("detects quick design draft after planning reset via timeline", () => {
    const readiness = evaluatePlanningArtifactReadiness({
      projectArtifacts: [],
      promptTimeline: quickDesignTimeline,
    });
    expect(readiness.status).toBe("quick_design_draft_unconfirmed");
  });

  it("hasQuickDesignDraftInState detects member drafts", () => {
    expect(hasQuickDesignDraftInState(quickDesignDraft)).toBe(true);
    expect(hasQuickDesignDraftInState(null)).toBe(false);
  });
});
