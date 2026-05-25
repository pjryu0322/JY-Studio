import { describe, expect, it } from "vitest";
import {
  buildAnalystMemberDraft,
  buildArchitectMemberDraft,
  buildDesignerMemberDraft,
  buildPlannerMemberDraft,
  collectFastPlanDraftContext,
} from "@/lib/platform-orchestration/fastPlanMemberDrafts";
import { buildSlotCandidatePatchesFromFastPlanDrafts } from "@/lib/requirements/fastPlanDraftSlotPatch";
import {
  buildQuickDesignImplementationReadyChatMessage,
  generateQuickDesignConfirmArtifacts,
  QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE,
} from "@/lib/requirements/quickDesignConfirmArtifacts";
import { LEGACY_QUICK_DESIGN_AREA_TITLES } from "@/lib/requirements/projectArtifactPlan";
import { PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("quickDesignConfirmArtifacts", () => {
  it("generates standard business artifacts on Quick Design confirm (not area artifacts)", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
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
      runId: "qd-artifacts",
    });

    const result = generateQuickDesignConfirmArtifacts({
      projectId: "p1",
      projectName: "회의록",
      projectDescription: "녹취",
      conversationMessages: [],
      serviceFlow: null,
      orchestration: patch.orchestration ?? orchestration,
      slotDefinitions: definitions,
      featurePlanning: null,
      problemInterview: null,
      sourceStage: "IDEATION",
      nowIso,
      fastPlanDraftV1: {
        status: "confirmed",
        generatedAt: nowIso,
        flowId: "fast_plan_draft",
        memberRuns: [],
        memberDrafts,
        assumptions: collected.assumptions,
        slotCandidatePatch: patch.slotCandidatePatch ?? undefined,
        source: "current_conversation_and_slots",
      },
    });

    expect(result.artifacts.length).toBeGreaterThanOrEqual(2);
    expect(result.artifactOrchestrationV1.requiredTypes.length).toBeGreaterThan(0);
    expect(result.artifacts[0]?.orchestration?.trace?.length).toBeGreaterThan(0);
    const titles = result.artifacts.map((a) => a.title);
    for (const legacy of LEGACY_QUICK_DESIGN_AREA_TITLES) {
      expect(titles).not.toContain(legacy);
    }
    expect(titles).toContain(PROJECT_ARTIFACT_LABELS.summary);
    expect(titles).toContain(PROJECT_ARTIFACT_LABELS["fast_prototype_plan"]);
    expect(titles).not.toContain("빠른 프로토타입 기획안");
    expect(result.deliverables).toHaveLength(result.artifacts.length);
  });

  it("builds implementation-ready message with Artifact 보기 and 구현 시작 chips", () => {
    const message = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1", "a2"],
      artifactTitles: ["프로젝트 요약서", "프로토타입 기획안"],
      nowIso,
    });

    expect(message.content).toContain("구현 준비 완료");
    expect(message.content).not.toContain("기획안 생성");
    expect(message.content).not.toContain("생성 단계 준비");
    expect(message.content).not.toContain("서비스 정의 산출물");
    expect(message.meta?.internalType).toBe(QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE);
    expect(message.meta?.interviewSuggestions).toEqual(
      expect.arrayContaining(["Artifact 보기", "구현 시작", "추가 보완"]),
    );
  });
});
