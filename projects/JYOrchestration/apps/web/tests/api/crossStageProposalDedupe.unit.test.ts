import { describe, expect, it } from "vitest";
import {
  buildProposalFingerprintFromText,
  isIdeationCrossStageHandoffContext,
  proposalTextsStructurallySimilar,
  resolveServiceFlowVisiblePresentation,
} from "@/lib/requirements/crossStageProposalDedupe";

const ideationProposal = `회의록 자동화 초안입니다.

예상 액터
- 사용자
- 시스템

예상 서비스 흐름
1. 녹취 업로드
2. 발화 정리
3. 요약 생성

다음: 추천안 적용 / 일부 수정 / 다른 대안 보기 중 하나를 골라 주세요.`;

const serviceFlowDuplicate = `회의록 자동화 흐름 초안입니다.

예상 액터
- 사용자
- 시스템

예상 흐름
1. 녹취 업로드
2. 발화 정리
3. 요약 생성

다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.`;

describe("crossStageProposalDedupe", () => {
  it("isIdeationCrossStageHandoffContext — ideation handoff + 인터뷰 시작", () => {
    expect(
      isIdeationCrossStageHandoffContext({
        priorScreenHandoff: "이전 담당: ideation\n요약:\n" + ideationProposal,
        userMessage: "서비스 흐름 인터뷰 시작",
        currentFlow: null,
      }),
    ).toBe(true);
  });

  it("proposalTextsStructurallySimilar — 구조 기반 유사 판정", () => {
    expect(proposalTextsStructurallySimilar(ideationProposal, serviceFlowDuplicate)).toBe(true);
    const fp = buildProposalFingerprintFromText("ideation", ideationProposal);
    expect(fp.normalizedActorsHash.length).toBeGreaterThan(2);
    expect(fp.normalizedWorkflowHash.length).toBeGreaterThan(2);
  });

  it("resolveServiceFlowVisiblePresentation — handoff bootstrap 시 suppress", () => {
    const r = resolveServiceFlowVisiblePresentation({
      userMessage: "서비스 흐름 인터뷰 시작",
      currentFlow: null,
      priorScreenHandoff: "이전 담당: ideation\n요약:\n" + ideationProposal,
      assistantMessage: serviceFlowDuplicate,
      nextQuestion: null,
      quickReplies: ["추천안 적용", "일부 수정"],
      updatedFlow: {
        createdAt: "2026-05-19T00:00:00.000Z",
        updatedAt: "2026-05-19T00:00:00.000Z",
        actors: [
          { id: "a1", name: "사용자", kind: "human", description: "" },
          { id: "a2", name: "시스템", kind: "system", description: "" },
        ],
        steps: [
          {
            id: "s1",
            title: "녹취 업로드",
            purpose: "",
            order: 1,
            primaryActorId: "a1",
            secondaryActorIds: [],
            approved: false,
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          {
            id: "s2",
            title: "발화 정리",
            purpose: "",
            order: 2,
            primaryActorId: "a2",
            secondaryActorIds: [],
            approved: false,
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          {
            id: "s3",
            title: "요약 생성",
            purpose: "",
            order: 3,
            primaryActorId: "a2",
            secondaryActorIds: [],
            approved: false,
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
        ],
      },
    });
    expect(r.mode).toBe("handoff_state_only");
    expect(r.suppressVisibleMessage).toBe(true);
    expect(r.suppressReason).toBe("duplicate_cross_stage_proposal");
    expect(r.visibleAssistantMessage).toBe("");
  });
});
