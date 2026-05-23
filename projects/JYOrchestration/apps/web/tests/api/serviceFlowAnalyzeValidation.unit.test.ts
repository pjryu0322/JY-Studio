import { describe, expect, it } from "vitest";
import { isWeakAdviceAssistantMessage } from "@/lib/requirements/serviceFlowAdviceMode";
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
    const nextQ = "이 초안을 기준으로 진행할지 선택·수정해 주세요?";
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

  it("validate — advice mode rejects short assistantMessage", () => {
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "검수 절차를 제안합니다.",
        updatedFlow: sampleFlow(),
        intent: "unclear",
        nextQuestion: null,
        quickReplies: null,
        readiness: { score: 0, actorsReady: false, stepsReady: false, mappingReady: false, readyForNext: false },
      },
      userMessage: "검수절차를 제안해줘",
      currentFlow: sampleFlow(),
      responsePolicy: { mode: "advice" },
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("advice_message_too_short");
    expect(isWeakAdviceAssistantMessage("검수 절차를 제안합니다.")).toBe(true);
  });

  it("rejects future-only service flow response with no actors or steps", () => {
    const emptyFlow: RequirementsServiceFlowV1 = {
      createdAt: now,
      updatedAt: now,
      actors: [],
      steps: [],
    };
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "회의록 자동 정리 시스템의 서비스 흐름을 정의해 보겠습니다.",
        updatedFlow: emptyFlow,
        intent: "unclear",
        nextQuestion: null,
        quickReplies: null,
        readiness: { score: 0, actorsReady: false, stepsReady: false, mappingReady: false, readyForNext: false },
      },
      userMessage: "액터부터 정의해줘",
      currentFlow: emptyFlow,
      responsePolicy: { mode: "flow_update", serviceFlowSubIntent: "actor_definition" },
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("assistant_future_only_no_flow");
  });

  it("accepts actor names reflected with markdown bold", () => {
    const flow: RequirementsServiceFlowV1 = {
      createdAt: now,
      updatedAt: now,
      actors: [
        { id: "a1", name: "사용자", kind: "human", description: "업로드" },
        { id: "a2", name: "시스템", kind: "system", description: "정리" },
        { id: "a3", name: "검수자", kind: "human", description: "검수" },
      ],
      steps: [],
    };
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage:
          "1. **사용자**\n- 녹취 파일을 업로드합니다.\n\n2. **시스템**\n- 자동 정리를 수행합니다.\n\n3. **검수자**\n- 최종 확인합니다.",
        updatedFlow: flow,
        intent: "add_actor",
        nextQuestion: null,
        quickReplies: null,
        readiness: { score: 20, actorsReady: true, stepsReady: false, mappingReady: false, readyForNext: false },
      },
      userMessage: "액터부터 정의해줘",
      currentFlow: flow,
      responsePolicy: { mode: "flow_update", serviceFlowSubIntent: "actor_definition" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects fallback-style feature scope text for flow_step_definition when steps are missing", () => {
    const flow: RequirementsServiceFlowV1 = {
      createdAt: now,
      updatedAt: now,
      actors: [
        { id: "a1", name: "사용자", kind: "human", description: "" },
        { id: "a2", name: "시스템", kind: "system", description: "" },
      ],
      steps: [],
    };
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage:
          "회의록 자동 정리 시스템의 기능 범위는 다음과 같습니다:\n- 사용자: 회의록 검수\n\n예상 흐름 번호: 1\n다음: 기능 범위에 대한 추가 의견을 주세요.",
        updatedFlow: flow,
        intent: "add_step",
        nextQuestion: null,
        quickReplies: null,
        readiness: { score: 0, actorsReady: true, stepsReady: false, mappingReady: false, readyForNext: false },
      },
      userMessage: "서비스 흐름 단계 정리",
      currentFlow: flow,
      responsePolicy: { mode: "flow_update", serviceFlowSubIntent: "flow_step_definition" },
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("flow_step_definition_missing_steps");
  });

  it("accepts actor definition response with actors reflected in message", () => {
    const flow: RequirementsServiceFlowV1 = {
      createdAt: now,
      updatedAt: now,
      actors: [
        { id: "a1", name: "사용자", kind: "human", description: "" },
        { id: "a2", name: "시스템", kind: "system", description: "" },
      ],
      steps: [],
    };
    const r = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage:
          "1. 사용자\n- 녹취 파일을 업로드합니다.\n\n2. 시스템\n- 자동 정리를 수행합니다.\n\n다음: 이 액터를 기준으로 서비스 흐름 단계를 정리할 수 있습니다.",
        updatedFlow: flow,
        intent: "add_actor",
        nextQuestion: null,
        quickReplies: null,
        readiness: { score: 20, actorsReady: true, stepsReady: false, mappingReady: false, readyForNext: false },
      },
      userMessage: "액터부터 정의해줘",
      currentFlow: flow,
      responsePolicy: { mode: "flow_update", serviceFlowSubIntent: "actor_definition" },
    });
    expect(r.ok).toBe(true);
  });
});
