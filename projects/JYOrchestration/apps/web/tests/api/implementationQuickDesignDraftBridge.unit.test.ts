import { describe, expect, it } from "vitest";
import {
  buildCreateImplementationSeedFromQuickDesignDraftResult,
  annotateSeedAsQuickDesignDraftBased,
} from "@/lib/prototype/implementationQuickDesignDraftBridge";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  buildAnalystMemberDraft,
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  buildPlannerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";

const nowIso = "2026-05-29T12:00:00.000Z";

function buildQuickDesignDraftFixture() {
  const definitions = buildDynamicServicePlanningSlotDefinitions({
    projectId: "p-bridge",
    projectName: "회의록",
  });
  const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
  const collected = collectFastPlanDraftContext({
    projectId: "p-bridge",
    projectName: "회의록",
    projectDescription: "녹취",
    conversationMessages: [],
    serviceFlow: null,
    orchestration,
    slotDefinitions: definitions,
    featurePlanning: null,
    problemInterview: null,
  });
  const memberDrafts = [
    buildPlannerMemberDraft({ runId: "run-p", collected, definitions, orchestration }),
    buildAnalystMemberDraft({ runId: "run-a", collected, definitions, orchestration }),
    buildArchitectMemberDraft({ runId: "run-arch", collected, definitions, orchestration }),
    buildDesignerMemberDraft({ runId: "run-d", collected, definitions, orchestration }),
  ];
  const patch = buildSlotCandidatePatchesFromFastPlanDrafts({
    memberDrafts,
    orchestration,
    definitions,
    nowIso,
    runId: "qd-bridge",
  });
  const fastPlanDraftV1 = {
    status: "proposed" as const,
    generatedAt: nowIso,
    flowId: "fast_plan_draft" as const,
    memberRuns: [],
    memberDrafts,
    assumptions: collected.assumptions,
    slotCandidatePatch: patch.slotCandidatePatch ?? undefined,
    source: "current_conversation_and_slots" as const,
  };
  return { definitions, fastPlanDraftV1, orchestration: patch.orchestration ?? orchestration };
}

describe("implementationQuickDesignDraftBridge", () => {
  it("creates implementationSeedV1 from quick design draft", () => {
    const { definitions, fastPlanDraftV1, orchestration } = buildQuickDesignDraftFixture();
    const result = buildCreateImplementationSeedFromQuickDesignDraftResult({
      projectId: "p-bridge",
      projectName: "회의록",
      fastPlanDraftV1,
      orchestration,
      slotDefinitions: definitions,
      nowIso,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.implementationSeedV1.projectId).toBe("p-bridge");
    expect(result.implementationSeedV1.lifecycleStatus).not.toBe("confirmed");
    expect(result.implementationSeedV1.assumptions.some((a) => a.includes("초안 기반"))).toBe(true);
    expect(result.orchestrationPatch.promptTimeline.some((e) => e.action === "implementation_seed_created_from_quick_design_draft")).toBe(
      true,
    );
    expect(result.messages[0]?.meta?.interviewSuggestions).toContain("구현 작업목록 생성");
  });

  it("annotateSeedAsQuickDesignDraftBased marks draft-based seed", () => {
    const seed = annotateSeedAsQuickDesignDraftBased({
      version: "implementation_seed_v1",
      projectId: "p1",
      createdAt: nowIso,
      updatedAt: nowIso,
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
    });
    expect(seed.lifecycleStatus).toBe("partial");
    expect(seed.assumptions.some((a) => a.includes("초안 기반"))).toBe(true);
  });

  it("blocks when no quick design draft exists", () => {
    const result = buildCreateImplementationSeedFromQuickDesignDraftResult({
      projectId: "p1",
      fastPlanDraftV1: null,
      orchestration: null,
      slotDefinitions: [],
    });
    expect(result.kind).toBe("blocked");
  });
});
