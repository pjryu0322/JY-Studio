import { describe, expect, it } from "vitest";
import { buildPlannerMemberDraft, collectFastPlanDraftContext } from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("fastPlanDraftSlotPatch", () => {
  it("converts fast plan member drafts into candidate slot patches", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
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
    const draft = buildPlannerMemberDraft({
      runId: "run-1",
      collected,
      definitions,
    });

    const result = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts: [draft],
      orchestration,
      definitions,
      nowIso,
    });

    expect(result.updatedSlotKeys.length).toBeGreaterThan(0);
    expect(result.confirmedSlotKeys).toEqual([]);
    expect(result.patches.every((p) => p.status !== "confirmed")).toBe(true);
    expect(
      result.candidateSlotKeys.length + result.assumedSlotKeys.length,
    ).toBeGreaterThan(0);
    expect(result.orchestration).not.toBeNull();
  });
});
