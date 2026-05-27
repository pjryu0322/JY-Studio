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
import { runQuickDesignConfirmImplementationPrep } from "@/lib/requirements/quickDesignConfirmImplementationPrep";
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

  it("builds implementation-ready message with simplified post-confirm chips", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p-msg",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: "p-msg",
      orchestration,
      definitions,
      nowIso,
    });
    const message = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1", "a2"],
      artifactTitles: ["프로젝트 요약서", "프로토타입 기획안"],
      nowIso,
      prep,
    });

    expect(message.content).toMatch(/구현 준비/);
    expect(message.content).not.toContain("기획안 생성");
    expect(message.content).not.toContain("생성 단계 준비");
    expect(message.content).not.toContain("서비스 정의 산출물");
    expect(message.meta?.internalType).toBe(QUICK_DESIGN_IMPLEMENTATION_READY_INTERNAL_TYPE);
    if (prep.prepComplete) {
      expect(message.meta?.interviewSuggestions).toEqual(
        expect.arrayContaining([
          "구현단계로 이동",
          "구현 작업안 초안 생성",
          "산출물 보기",
          "환경설정 열기",
        ]),
      );
      expect(message.meta?.interviewSuggestions).not.toContain("기획정보 보완");
    } else {
      expect(message.meta?.interviewSuggestions).toEqual(
        expect.arrayContaining(["구현단계로 이동", "기획정보 보완", "산출물 보기"]),
      );
    }
    expect(message.meta?.interviewSuggestions).not.toContain("구현 시작");
    expect(message.meta?.interviewSuggestions).not.toContain("추가 보완");
  });
});
