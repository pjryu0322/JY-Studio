import { describe, expect, it } from "vitest";
import {
  buildAnalystMemberDraft,
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  buildPlannerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import {
  confirmFastPlanDraftSlots,
  QUICK_DESIGN_CONFIRM_BLOCKED_MESSAGE,
} from "@/lib/requirements/fastPlanDraftConfirmation";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import { buildQuickDesignSlotsPatchedTimelineEntry } from "@/lib/requirements/quickDesignLabels";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  mergeOrchestrationSlotPatches,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

function sampleQuickDesignDrafts(definitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>) {
  const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const collected = collectFastPlanDraftContext({
    projectId: "p1",
    projectName: "회의록",
    projectDescription: "녹취",
    conversationMessages: [],
    serviceFlow: null,
    orchestration,
    slotDefinitions: definitions,
    featurePlanning: null,
    problemInterview: null,
  });
  return {
    orchestration,
    collected,
    memberDrafts: [
      buildPlannerMemberDraft({ runId: "run-planner", collected, definitions, orchestration }),
      buildAnalystMemberDraft({ runId: "run-analyst", collected, definitions, orchestration }),
      buildArchitectMemberDraft({ runId: "run-arch", collected, definitions, orchestration }),
      buildDesignerMemberDraft({ runId: "run-design", collected, definitions, orchestration }),
    ],
  };
}

describe("fastPlanDraftConfirmation", () => {
  it("promotes draft candidate slots to confirmed when user confirms draft", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    let orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const collected = collectFastPlanDraftContext({
      projectId: "p1",
      projectName: "회의록",
      projectDescription: "녹취 정리",
      conversationMessages: [],
      serviceFlow: null,
      orchestration,
      slotDefinitions: definitions,
      featurePlanning: null,
      problemInterview: null,
    });
    const memberDrafts = [
      buildPlannerMemberDraft({ runId: "run-1", collected, definitions, orchestration }),
    ];
    const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts,
      orchestration,
      definitions,
      nowIso,
      runId: "qd-1",
    });
    orchestration = patch.orchestration ?? orchestration;

    const fastPlanDraftV1: FastPlanDraftStateV1 = {
      status: "proposed",
      generatedAt: nowIso,
      flowId: "fast_plan_draft",
      memberRuns: [],
      memberDrafts,
      assumptions: collected.assumptions,
      slotCandidatePatch: patch.slotCandidatePatch ?? undefined,
      source: "current_conversation_and_slots",
    };

    const result = confirmFastPlanDraftSlots({
      fastPlanDraftV1,
      orchestration,
      definitions,
      nowIso,
    });

    expect(result.blocked).toBe(false);
    expect(result.confirmedSlotKeys.length).toBeGreaterThan(0);
    expect(result.fastPlanDraftV1.status).toBe("confirmed");
    expect(result.chatMessage.meta?.internalType).toBe("fast_plan_draft_confirmed");
    expect(result.timelineEntry.action).toBe("quick_design_confirmed");
  });

  it("confirms only slots patched by the current Quick Design run", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    let orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const collected = collectFastPlanDraftContext({
      projectId: "p1",
      projectName: "회의록",
      projectDescription: "녹취",
      conversationMessages: [],
      serviceFlow: null,
      orchestration,
      slotDefinitions: definitions,
      featurePlanning: null,
      problemInterview: null,
    });
    const unrelatedKey =
      definitions.find((d) => d.slotKey.includes(".design.prototypeScope"))?.slotKey ?? "p.design.prototypeScope";

    orchestration = mergeOrchestrationSlotPatches({
      base: orchestration,
      patches: [
        {
          slotKey: unrelatedKey,
          status: "candidate",
          value: "기존 unrelated 후보",
          confidence: 0.6,
        },
      ],
      nowIso,
      definitions,
    });

    const memberDrafts = [
      buildPlannerMemberDraft({ runId: "run-p", collected, definitions, orchestration }),
      buildAnalystMemberDraft({ runId: "run-a", collected, definitions, orchestration }),
    ];
    const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts,
      orchestration,
      definitions,
      nowIso,
      runId: "qd-scope",
    });
    orchestration = patch.orchestration ?? orchestration;

    const patchedKeys = patch.patchedSlotKeys.filter((k) => k.includes(".planning.") || k.includes(".flow."));
    expect(patchedKeys.length).toBeGreaterThan(0);

    const fastPlanDraftV1: FastPlanDraftStateV1 = {
      status: "proposed",
      generatedAt: nowIso,
      flowId: "fast_plan_draft",
      memberRuns: [],
      memberDrafts,
      assumptions: collected.assumptions,
      slotCandidatePatch: patch.slotCandidatePatch ?? undefined,
      source: "current_conversation_and_slots",
    };

    const result = confirmFastPlanDraftSlots({
      fastPlanDraftV1,
      orchestration,
      definitions,
      nowIso,
      onlyPatchedSlotKeys: true,
    });

    for (const key of patchedKeys) {
      expect(result.confirmedSlotKeys).toContain(key);
    }
    expect(result.confirmedSlotKeys).not.toContain(unrelatedKey);
  });

  it("rebuilds patch scope from member drafts when slotCandidatePatch metadata is missing", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const { orchestration, collected, memberDrafts } = sampleQuickDesignDrafts(definitions);
    const fastPlanDraftV1: FastPlanDraftStateV1 = {
      status: "proposed",
      generatedAt: nowIso,
      flowId: "fast_plan_draft",
      memberRuns: [],
      memberDrafts,
      assumptions: collected.assumptions,
      source: "current_conversation_and_slots",
    };

    const result = confirmFastPlanDraftSlots({
      fastPlanDraftV1,
      orchestration,
      definitions,
      nowIso,
    });

    expect(result.blocked).toBe(false);
    expect(result.confirmedSlotKeys.length).toBeGreaterThan(0);
    expect(result.fastPlanDraftV1.slotCandidatePatch?.patchedSlotKeys.length).toBeGreaterThan(0);
  });

  it("does not confirm all candidates when patchedSlotKeys are missing", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const screenKey =
      definitions.find((d) => d.slotKey.includes(".design.requiredScreens"))?.slotKey ?? "p.design.requiredScreens";

    const withCandidate = mergeOrchestrationSlotPatches({
      base: orchestration,
      patches: [
        {
          slotKey: screenKey,
          status: "candidate",
          value: "후보 화면",
          confidence: 0.6,
        },
      ],
      nowIso,
      definitions,
    });

    const fastPlanDraftV1: FastPlanDraftStateV1 = {
      status: "proposed",
      generatedAt: nowIso,
      flowId: "fast_plan_draft",
      memberRuns: [],
      memberDrafts: [],
      assumptions: [],
      source: "current_conversation_and_slots",
    };

    const result = confirmFastPlanDraftSlots({
      fastPlanDraftV1,
      orchestration: withCandidate,
      definitions,
      nowIso,
    });

    expect(result.confirmedSlotKeys).toEqual([]);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe(QUICK_DESIGN_CONFIRM_BLOCKED_MESSAGE);
  });

  it("records Quick Design slot patch area counts in timeline", () => {
    const entry = buildQuickDesignSlotsPatchedTimelineEntry({
      projectId: "p1",
      nowIso,
      patchedSlotKeys: ["p.planning.servicePurpose"],
      areaCounts: { planning: 5, analysis: 3, architecture: 2, design: 2 },
      runId: "quick-design-1",
    });

    expect(entry.action).toBe("quick_design_slots_patched");
    expect(String(entry.responseText ?? "")).toContain("analysisCandidateCount");
    expect(String(entry.responseText ?? "")).toContain("quick-design-1");
    expect(String(entry.responseText ?? "")).toContain("planningCandidateCount");
  });
});
