import { describe, expect, it } from "vitest";
import { buildBootstrapProposalFallbackSynthesisUserPrompt } from "@/lib/requirements/bootstrapProposalFallbackSynthesis";
import {
  buildIdeationBootstrapContextualFallbackQuestion,
  buildIdeationBootstrapDescriptionProposalSkeleton,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";

describe("bootstrapProposalFallbackSynthesis", () => {
  it("buildBootstrapProposalFallbackSynthesisUserPrompt는 proposal-first 재생성 지시를 포함한다", () => {
    const p = buildBootstrapProposalFallbackSynthesisUserPrompt({
      projectName: "회의록 자동화",
      projectDescription: "녹취 업로드 후 요약",
      failureIssues: ["question_first_without_proposal"],
    });
    expect(p).toContain("proposal-first");
    expect(p).toContain("question-first 금지");
    expect(p).toContain("proposalDraft");
  });

  it("description proposal skeleton은 question-only가 아니다", () => {
    const msg = buildIdeationBootstrapDescriptionProposalSkeleton({
      projectName: "회의록 자동화",
      projectDescription: "녹취 업로드 후 STT·요약",
    });
    expect(msg).toContain("예상 서비스 흐름");
    expect(hasProposalFirstStructure(msg)).toBe(true);
    expect(detectQuestionFirstUx(msg) && !hasProposalFirstStructure(msg)).toBe(false);
    expect(msg).not.toContain("작성자만 확인하면 될까요");
  });

  it("contextual fallback은 skeleton에 위임한다", () => {
    const msg = buildIdeationBootstrapContextualFallbackQuestion({
      projectName: "테스트",
      projectDescription: "설명",
    });
    expect(msg).toContain("다음:");
  });
});
