import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { applyQuickReplyAwareAssistantPresentation } from "@/lib/requirements/serviceFlowAssistantPresentation";
import {
  isServiceFlowProposalBootstrapTurn,
  mergeServiceFlowUserFacingMessage,
  validateServiceFlowAnalyzeResponse,
} from "@/lib/requirements/serviceFlowAnalyzeValidation";

const now = "2026-05-19T00:00:00.000Z";

function sampleFlow(): RequirementsServiceFlowV1 {
  return {
    createdAt: now,
    updatedAt: now,
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
        updatedAt: now,
      },
      {
        id: "s2",
        title: "발화 정리",
        purpose: "",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s3",
        title: "요약 생성",
        purpose: "",
        order: 3,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowAnalyzeValidation", () => {
  it("isServiceFlowProposalBootstrapTurn — 인터뷰 시작·빈 flow", () => {
    expect(isServiceFlowProposalBootstrapTurn({ userMessage: "서비스 흐름 인터뷰 시작", currentFlow: null })).toBe(
      true,
    );
    expect(
      isServiceFlowProposalBootstrapTurn({
        userMessage: "수정",
        currentFlow: { ...sampleFlow(), actors: [], steps: [] },
      }),
    ).toBe(true);
    expect(
      isServiceFlowProposalBootstrapTurn({ userMessage: "수정", currentFlow: sampleFlow() }),
    ).toBe(false);
  });

  it("mergeServiceFlowUserFacingMessage — 중복 CTA 제거", () => {
    const assistant = `초안입니다.\n\n예상 액터\n- 사용자\n\n다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.`;
    const nextQ = "위 흐름이 맞는지 선택·수정해 주세요?";
    const merged = mergeServiceFlowUserFacingMessage(assistant, nextQ);
    expect(merged).toBe(assistant);
    expect(merged.split("?").length - 1).toBeLessThanOrEqual(1);
  });

  it("applyQuickReplyAwareAssistantPresentation — chip enumeration CTA", () => {
    const assistant = `초안입니다.\n\n다음: 추천안 적용 / 일부 수정 / 다른 대안 보기 중 하나를 골라 주세요.`;
    const out = applyQuickReplyAwareAssistantPresentation(assistant, [
      "추천안 적용",
      "일부 수정",
      "다른 대안 보기",
    ]);
    expect(out.match(/다음:/g)?.length ?? 0).toBe(0);
  });

  it("mergeServiceFlowUserFacingMessage — assistant+nextQuestion 동일 CTA", () => {
    const cta = "다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.";
    const assistant = `초안입니다.\n\n${cta}`;
    const merged = mergeServiceFlowUserFacingMessage(assistant, cta);
    expect(merged).toBe(assistant);
    expect(merged.match(/다음:/g)?.length).toBe(1);
  });

  it("validate — proposal-first 구조·flow 정합성 pass", () => {
    const flow = sampleFlow();
    const assistant = `회의록 자동화 흐름 초안입니다.

예상 액터
- 사용자
- 시스템

예상 흐름
1. 녹취 업로드
2. 발화 정리
3. 요약 생성

다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.`;

    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: assistant,
        updatedFlow: flow,
        intent: "unclear",
        nextQuestion: null,
        quickReplies: ["그대로 진행", "단계 수정", "빠진 단계 추가"],
        readiness: { score: 40, actorsReady: true, stepsReady: true, mappingReady: false, readyForNext: false },
      },
      userMessage: "서비스 흐름 인터뷰 시작",
      currentFlow: null,
    });
    expect(r.ok).toBe(true);
  });

  it("validate — question-first only reject", () => {
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "첫 단계는 무엇입니까?",
        updatedFlow: sampleFlow(),
        intent: "unclear",
        nextQuestion: null,
        quickReplies: null,
        readiness: { score: 0, actorsReady: false, stepsReady: false, mappingReady: false, readyForNext: false },
      },
      userMessage: "서비스 흐름 인터뷰 시작",
      currentFlow: null,
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("question_first_without_proposal");
  });

  it("validate — multi_question_cta reject", () => {
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: `초안입니다.\n\n예상 흐름\n1. A\n2. B\n3. C\n\n누락할 단계가 있습니까?`,
        updatedFlow: sampleFlow(),
        intent: "unclear",
        nextQuestion: "위 흐름이 맞습니까?",
        quickReplies: ["그대로 진행"],
        readiness: { score: 10, actorsReady: true, stepsReady: true, mappingReady: false, readyForNext: false },
      },
      userMessage: "서비스 흐름 인터뷰 시작",
      currentFlow: null,
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("multi_question_cta");
  });
});
