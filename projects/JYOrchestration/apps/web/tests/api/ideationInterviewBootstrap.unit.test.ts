import { describe, expect, it } from "vitest";
import {
  normalizeIdeationBootstrapDisplayMessage,
  preserveIdeationBootstrapProposalMessage,
  sanitizeIdeationInterviewFirstQuestion,
} from "@/lib/requirements/ideationInterviewBootstrap";

const PROPOSAL_SAMPLE = `회의록 자동화 시스템은 녹취된 파일에서 발화자별로 발화내용을 정리하고 요약까지 해주는 웹 서비스입니다.

예상 서비스 흐름:
1. 녹취 파일 업로드
2. 발화 내용 정리
3. 자동 요약 생성

예상 액터:
- 사용자
- AI 시스템

다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.`;

describe("ideationInterviewBootstrap display", () => {
  it("preserveIdeationBootstrapProposalMessage는 전체 본문을 유지한다", () => {
    const out = preserveIdeationBootstrapProposalMessage(PROPOSAL_SAMPLE);
    expect(out).toContain("예상 서비스 흐름");
    expect(out).toContain("예상 액터");
    expect(out).toContain("다음:");
    expect(out).not.toMatch(/\?$/);
  });

  it("normalizeIdeationBootstrapDisplayMessage는 proposal-first를 축약하지 않는다", () => {
    const out = normalizeIdeationBootstrapDisplayMessage(PROPOSAL_SAMPLE);
    expect(out).toContain("예상 서비스 흐름");
    expect(out).toContain("예상 액터");
    expect(out.split("\n").length).toBeGreaterThan(4);
  });

  it("sanitizeIdeationInterviewFirstQuestion은 legacy question-only만 한 문장으로 축약한다", () => {
    const q = "첫 단계는 무엇입니까? 그 다음은 어떻게 할까요?";
    const out = sanitizeIdeationInterviewFirstQuestion(q);
    expect(out).toBe("첫 단계는 무엇입니까?");
  });

  it("sanitize는 proposal-first 입력 시 전체 구조를 유지한다", () => {
    const out = sanitizeIdeationInterviewFirstQuestion(PROPOSAL_SAMPLE);
    expect(out).toContain("예상 서비스 흐름");
  });
});
