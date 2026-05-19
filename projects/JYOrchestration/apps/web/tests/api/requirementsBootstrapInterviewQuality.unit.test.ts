import { describe, expect, it } from "vitest";
import {
  analyzeBootstrapQuestionQuality,
  BOOTSTRAP_QUESTION_DOMAIN_LEXEMES,
  detectQuestionFirstUx,
  filterBootstrapInterviewSuggestions,
  hasProposalFirstStructure,
  repairBootstrapQuestionFromContext,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import {
  buildSingleChatPromptTimelineEntry,
  coerceRequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";

describe("requirementsBootstrapInterviewQuality", () => {
  it("slot 라벨을 그대로 넣은 질문은 거절된다", () => {
    const r = analyzeBootstrapQuestionQuality({
      question: "이 프로젝트의 서비스 목적은 무엇인가요?",
      projectDescription: "회의록 자동 정리",
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("slot_label_question");
  });

  it('"핵심 사용자와 기대 효과" 형태는 multi_slot_question 이슈를 포함한다', () => {
    const r = analyzeBootstrapQuestionQuality({
      question: "핵심 사용자와 기대 효과는 무엇인가요?",
      projectDescription: "회의록",
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("multi_slot_question");
  });

  it("도메인 앵커(회의록 등)와 판단축이 있으면 통과할 수 있다", () => {
    const q =
      "회의록 초안은 참가자가 함께 검토·수정한 뒤 확정하는 흐름까지 포함해야 할까요?";
    const r = analyzeBootstrapQuestionQuality({
      question: q,
      projectDescription: "회의록 자동 생성",
    });
    expect(r.ok).toBe(true);
    expect(BOOTSTRAP_QUESTION_DOMAIN_LEXEMES.some((w) => q.includes(w))).toBe(true);
  });

  it("question-first 빈 설계 질문은 거절된다", () => {
    expect(detectQuestionFirstUx("첫 단계는 무엇입니까?")).toBe(true);
    const r = analyzeBootstrapQuestionQuality({
      question: "첫 단계는 무엇입니까?",
      projectDescription: "회의록 자동화",
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("question_first_ux");
  });

  it("proposal-first 구조(흐름·액터 초안)는 통과할 수 있다", () => {
    const q = `회의록 자동화로 이해했습니다.

예상 흐름:
1. 녹취 업로드
2. STT·화자 분리
3. 초안 생성
4. 검토·수정
5. 확정

예상 액터:
- 작성자
- 참석자

맞는지 선택하거나 수정해 주세요.`;
    expect(hasProposalFirstStructure(q)).toBe(true);
    const r = analyzeBootstrapQuestionQuality({
      question: q,
      projectDescription: "회의록 자동화",
    });
    expect(r.ok).toBe(true);
  });

  it("repairBootstrapQuestionFromContext는 proposal-first 초안 구조를 포함한다", () => {
    const q = repairBootstrapQuestionFromContext({
      projectName: "스마트 회의록",
      projectDescription: "회의 내용을 요약합니다.",
      orchestrationBootstrap: { detectedDomain: "협업", recommendedFocus: null },
    });
    expect(hasProposalFirstStructure(q)).toBe(true);
    expect(/예상 흐름|예상 참여/.test(q)).toBe(true);
  });

  it("suggestions에서 메타형 문구를 걸러낸다", () => {
    const r = filterBootstrapInterviewSuggestions({
      question: "회의록 검토는 누가 주도할까요?",
      suggestions: ["기대 효과 설명", "사람이 검토 후 확정", "기타 관련 정보"],
    });
    expect(r.suggestions).not.toContain("기대 효과 설명");
    expect(r.suggestions).not.toContain("기타 관련 정보");
    expect(r.suggestions.some((s) => s.includes("검토"))).toBe(true);
  });

  it("buildSingleChatPromptTimelineEntry → coerce roundtrip에 quality 필드가 유지된다", () => {
    const entry = buildSingleChatPromptTimelineEntry({
      action: "bootstrapInterview",
      source: "llm",
      timelineStage: "ideation",
      stageGroup: "requirements",
      workspaceScreenKey: "requirements_ideation",
      selectedAgents: [],
      questionQualityStatus: "retry_passed",
      questionQualityIssues: ["slot_label_question"],
      questionQualityRetryCount: 1,
      finalQuestionSource: "llm_retry",
      suggestionQualityIssues: ["meta_suggestion:기대"],
    });
    const raw = JSON.parse(JSON.stringify(entry)) as unknown;
    const coerced = coerceRequirementsPromptTimelineEntry(raw);
    expect(coerced?.questionQualityStatus).toBe("retry_passed");
    expect(coerced?.questionQualityIssues).toEqual(["slot_label_question"]);
    expect(coerced?.questionQualityRetryCount).toBe(1);
    expect(coerced?.finalQuestionSource).toBe("llm_retry");
    expect(coerced?.suggestionQualityIssues?.length).toBe(1);
  });
});
