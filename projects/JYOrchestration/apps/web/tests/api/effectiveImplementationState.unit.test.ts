import { describe, expect, it } from "vitest";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  mapImplementationChipToAction,
  mergePendingImplementationPatch,
  resolveEffectiveImplementationState,
  shouldClearPendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { evaluateImplementationStageActionGate } from "@/lib/prototype/implementationStageActionPipeline";
import {
  DATA_MODEL_DRAFT_CHIP,
  DB_INTEGRATION_REVIEW_CHIP,
  MOCK_IMPLEMENTATION_CHIP,
} from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import { WORK_PLAN_DRAFT_GENERATE_CHIP } from "@/lib/prototype/implementationWorkPlanDraft";
import { IMPLEMENTATION_GENERATION_REQUEST_CHIP } from "@/lib/requirements/implementationUxLabels";
import {
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";

function makeDraft(id: string): ImplementationWorkPlanDraftV1 {
  return {
    version: "implementation_work_plan_draft_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: id,
    source: "planning_artifacts",
    referenceArtifacts: [],
    implementationScope: ["scope"],
    implementationApproach: [],
    assumptions: [],
    blockers: [],
    status: "draft",
  };
}

describe("resolveEffectiveImplementationState", () => {
  it("prefers pending implementation work plan draft over persisted state", () => {
    const persisted = makeDraft("persisted");
    const pending = makeDraft("pending");

    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: null,
        implementationWorkPlanDraftV1: persisted,
        implementationTaskPlanV1: null,
      },
      pendingPatch: {
        implementationWorkPlanDraftV1: pending,
      },
      envOk: true,
      designOk: true,
    });

    expect(state.implementationWorkPlanDraftV1).toBe(pending);
  });

  it("uses persisted draft when pending patch is empty", () => {
    const persisted = makeDraft("persisted");

    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: null,
        implementationWorkPlanDraftV1: persisted,
        implementationTaskPlanV1: null,
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });

    expect(state.implementationWorkPlanDraftV1).toBe(persisted);
  });
});

describe("shouldClearPendingImplementationPatch", () => {
  it("clears pending patch when persisted draft timestamp changes", () => {
    expect(
      shouldClearPendingImplementationPatch({
        prevPersistedDraftUpdatedAt: null,
        nextPersistedDraftUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("does not clear on initial mount before any persisted snapshot", () => {
    expect(
      shouldClearPendingImplementationPatch({
        nextPersistedDraftUpdatedAt: null,
        nextPersistedTaskPlanCreatedAt: null,
      }),
    ).toBe(false);
  });

  it("does not clear when persisted draft timestamp is unchanged", () => {
    expect(
      shouldClearPendingImplementationPatch({
        prevPersistedDraftUpdatedAt: "2026-01-01T00:00:00.000Z",
        nextPersistedDraftUpdatedAt: "2026-01-01T00:00:00.000Z",
        prevPersistedTaskPlanCreatedAt: null,
        nextPersistedTaskPlanCreatedAt: null,
      }),
    ).toBe(false);
  });

  it("clears when persisted task plan createdAt changes", () => {
    expect(
      shouldClearPendingImplementationPatch({
        prevPersistedTaskPlanCreatedAt: "2026-01-01T00:00:00.000Z",
        nextPersistedTaskPlanCreatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});

describe("canConfirmImplementationWorkPlanFromEffectiveState", () => {
  it("allows confirm when parsed draft is missing but pending draft is ready", () => {
    const pending = makeDraft("pending");
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationWorkPlanDraftV1: null,
        implementationTaskPlanV1: null,
      },
      pendingPatch: { implementationWorkPlanDraftV1: pending },
      envOk: true,
      designOk: true,
    });

    expect(canConfirmImplementationWorkPlanFromEffectiveState(state)).toEqual({ ok: true });
  });

  it("blocks confirm when no draft in effective state", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationWorkPlanDraftV1: null,
        implementationTaskPlanV1: null,
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });

    expect(canConfirmImplementationWorkPlanFromEffectiveState(state).ok).toBe(false);
  });

  it("blocks confirm when designOk is false even with pending draft", () => {
    const pending = makeDraft("pending");
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationWorkPlanDraftV1: null,
        implementationTaskPlanV1: null,
      },
      pendingPatch: { implementationWorkPlanDraftV1: pending },
      envOk: true,
      designOk: false,
    });

    expect(canConfirmImplementationWorkPlanFromEffectiveState(state).ok).toBe(false);
  });
});

describe("mergePendingImplementationPatch", () => {
  it("merges orchestration patch fields into pending patch", () => {
    const draft = makeDraft("new");
    const merged = mergePendingImplementationPatch(
      {},
      { implementationWorkPlanDraftV1: draft },
    );
    expect(merged.implementationWorkPlanDraftV1).toBe(draft);
  });
});

describe("mapImplementationChipToAction", () => {
  it("maps primary implementation stage CTA labels", () => {
    expect(mapImplementationChipToAction(WORK_PLAN_DRAFT_GENERATE_CHIP)).toBe(
      "GENERATE_IMPLEMENTATION_WORK_PLAN",
    );
    expect(mapImplementationChipToAction("구현 작업안 확정")).toBe("CONFIRM_IMPLEMENTATION_WORK_PLAN");
    expect(mapImplementationChipToAction(DB_INTEGRATION_REVIEW_CHIP)).toBe("REVIEW_DB_INTEGRATION");
    expect(mapImplementationChipToAction(DATA_MODEL_DRAFT_CHIP)).toBe("GENERATE_DATA_MODEL_DRAFT");
    expect(mapImplementationChipToAction(MOCK_IMPLEMENTATION_CHIP)).toBe("CONFIRM_MOCK_IMPLEMENTATION");
    expect(mapImplementationChipToAction("환경설정 열기")).toBe("OPEN_ENV_SETTINGS");
    expect(mapImplementationChipToAction(IMPLEMENTATION_GENERATION_REQUEST_CHIP)).toBe(
      "REQUEST_CODE_AGENT_WIP",
    );
    expect(mapImplementationChipToAction("unknown")).toBeNull();
  });

  it("maps Cursor 실행 요청 to REQUEST_CURSOR_BRIDGE_EXECUTION not REQUEST_CODE_AGENT_WIP", () => {
    expect(mapImplementationChipToAction(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP)).toBe(
      "REQUEST_CURSOR_BRIDGE_EXECUTION",
    );
    expect(mapImplementationChipToAction("Cursor 실행 요청")).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(mapImplementationChipToAction(CODE_AGENT_WIP_WORK_REQUEST_CHIP)).toBe("REQUEST_CODE_AGENT_WIP");
    expect(mapImplementationChipToAction(IMPLEMENTATION_GENERATION_REQUEST_CHIP)).toBe(
      "REQUEST_CODE_AGENT_WIP",
    );
    expect(mapImplementationChipToAction("Cursor 실행 요청")).not.toBe("REQUEST_CODE_AGENT_WIP");
  });
});

describe("evaluateImplementationStageActionGate via effective state", () => {
  it("blocks CONFIRM_IMPLEMENTATION_WORK_PLAN when designOk is false", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationWorkPlanDraftV1: makeDraft("d") },
      pendingPatch: {},
      envOk: true,
      designOk: false,
    });
    expect(
      evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", state).ok,
    ).toBe(false);
  });
});
