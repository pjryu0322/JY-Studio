import { describe, expect, it } from "vitest";
import { buildPlannerMemberDraft, collectFastPlanDraftContext } from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { confirmFastPlanDraftSlots } from "@/lib/requirements/fastPlanDraftConfirmation";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

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
      buildPlannerMemberDraft({ runId: "run-1", collected, definitions }),
    ];
    const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts,
      orchestration,
      definitions,
      nowIso,
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

    expect(result.confirmedSlotKeys.length).toBeGreaterThan(0);
    expect(result.fastPlanDraftV1.status).toBe("confirmed");
    expect(result.chatMessage.content).toContain("Quick Design 초안을 확정했습니다");
    expect(result.timelineEntry.action).toBe("quick_design_confirmed");
  });
});
