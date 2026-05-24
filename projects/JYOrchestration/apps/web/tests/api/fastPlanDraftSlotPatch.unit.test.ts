import { describe, expect, it } from "vitest";
import {
  buildAnalystMemberDraft,
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  buildPlannerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import { QUICK_DESIGN_MIN_AREA_COUNTS } from "@/lib/requirements/quickDesignSlotArea";
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
    projectDescription: "녹취 정리",
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
      buildArchitectMemberDraft({ runId: "run-architect", collected, definitions, orchestration }),
      buildDesignerMemberDraft({ runId: "run-designer", collected, definitions, orchestration }),
    ],
  };
}

describe("fastPlanDraftSlotPatch", () => {
  it("creates candidate patches across planning, analysis, architecture, and design areas", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const { orchestration, memberDrafts } = sampleQuickDesignDrafts(definitions);

    const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts,
      orchestration,
      definitions,
      nowIso,
      runId: "quick-design-1",
    });

    expect(patch.areaCounts.planning).toBeGreaterThanOrEqual(QUICK_DESIGN_MIN_AREA_COUNTS.planning);
    expect(patch.areaCounts.analysis).toBeGreaterThanOrEqual(QUICK_DESIGN_MIN_AREA_COUNTS.analysis);
    expect(patch.areaCounts.architecture).toBeGreaterThanOrEqual(QUICK_DESIGN_MIN_AREA_COUNTS.architecture);
    expect(patch.areaCounts.design).toBeGreaterThanOrEqual(QUICK_DESIGN_MIN_AREA_COUNTS.design);
    expect(patch.slotCandidatePatch?.source).toBe("quick_design");
    expect(patch.slotCandidatePatch?.runId).toBe("quick-design-1");
  });

  it("patches slot keys declared by member draft targetSlotKeys", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const { orchestration, memberDrafts } = sampleQuickDesignDrafts(definitions);

    const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts,
      orchestration,
      definitions,
      nowIso,
    });

    const targetSlotKeys = memberDrafts.flatMap((draft) => draft.targetSlotKeys ?? []);
    for (const key of targetSlotKeys) {
      expect(patch.patchedSlotKeys).toContain(key);
    }
  });

  it("does not overwrite existing confirmed slots", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const { orchestration, memberDrafts, collected } = sampleQuickDesignDrafts(definitions);
    const purposeKey = definitions.find((d) => d.slotKey.includes(".planning.servicePurpose"))?.slotKey;
    expect(purposeKey).toBeTruthy();

    const confirmedOrchestration = mergeOrchestrationSlotPatches({
      base: orchestration,
      patches: [
        {
          slotKey: purposeKey!,
          status: "confirmed",
          value: "기존 확정 목적",
          confidence: 0.95,
        },
      ],
      nowIso,
      definitions,
    });

    const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts,
      orchestration: confirmedOrchestration,
      definitions,
      nowIso,
    });

    expect(patch.patchedSlotKeys).not.toContain(purposeKey);
  });

  it("converts fast plan member drafts into candidate slot patches", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const { orchestration, collected } = sampleQuickDesignDrafts(definitions);
    const draft = buildPlannerMemberDraft({
      runId: "run-1",
      collected,
      definitions,
      orchestration,
    });

    const result = buildSlotCandidatePatchesFromFastPlanDrafts({
      memberDrafts: [draft],
      orchestration,
      definitions,
      nowIso,
    });

    expect(result.patchedSlotKeys.length).toBeGreaterThan(0);
    expect(result.patches.every((p) => p.status !== "confirmed")).toBe(true);
    expect(result.orchestration).not.toBeNull();
  });
});
