import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  applyQuickReplyAwareAssistantPresentation,
  ensureAlternativeProposalIntro,
} from "@/lib/requirements/serviceFlowAssistantPresentation";
import {
  computeProposalFlowDeltaScore,
  isAlternativeProposalInsufficientDelta,
  markFlowAsAlternativeProposalVariant,
} from "@/lib/requirements/serviceFlowProposalVariant";

const now = "2026-05-19T00:00:00.000Z";

function flowA(): RequirementsServiceFlowV1 {
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
        title: "업로드",
        purpose: "p",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "정리",
        purpose: "p",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s3",
        title: "요약",
        purpose: "p",
        order: 3,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
  };
}

function flowB(): RequirementsServiceFlowV1 {
  return {
    ...flowA(),
    actors: [
      { id: "b1", name: "운영자", kind: "human", description: "" },
      { id: "b2", name: "배치엔진", kind: "system", description: "" },
      { id: "b3", name: "검수자", kind: "human", description: "" },
    ],
    steps: [
      {
        id: "t1",
        title: "요청 접수",
        purpose: "p",
        order: 1,
        primaryActorId: "b1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "t2",
        title: "비동기 처리",
        purpose: "p",
        order: 2,
        primaryActorId: "b2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "t3",
        title: "검수 반영",
        purpose: "p",
        order: 3,
        primaryActorId: "b3",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowAlternativeProposal phase11", () => {
  it("computeProposalFlowDeltaScore — 다른 flow면 delta > 0", () => {
    const score = computeProposalFlowDeltaScore(flowA(), flowB());
    expect(score).toBeGreaterThan(0.2);
    expect(isAlternativeProposalInsufficientDelta({ previousFlow: flowA(), candidateFlow: flowB() })).toBe(
      false,
    );
    expect(isAlternativeProposalInsufficientDelta({ previousFlow: flowA(), candidateFlow: flowA() })).toBe(
      true,
    );
  });

  it("markFlowAsAlternativeProposalVariant — metadata", () => {
    const next = markFlowAsAlternativeProposalVariant(flowB(), {
      previousFlow: flowA(),
      deltaScore: 0.71,
    });
    expect(next.proposalVariantMode).toBe("ALTERNATIVE");
    expect(next.reviewMode).toBe("ALTERNATIVE_REVIEW");
    expect(next.primaryProposalFingerprint).toBeTruthy();
    expect(next.alternativeProposalFingerprint).toBeTruthy();
  });

  it("applyQuickReplyAwareAssistantPresentation — enumerated CTA 제거", () => {
    const chips = ["추천안 적용", "일부 수정", "다른 대안 보기"];
    const msg = `초안입니다.\n\n다음: 추천안 적용 / 일부 수정 / 다른 대안 보기 중 하나를 골라 주세요.`;
    const out = applyQuickReplyAwareAssistantPresentation(msg, chips);
    expect(out).not.toMatch(/다음:\s*추천안 적용/);
    expect(out).toContain("초안입니다");
  });

  it("applyQuickReplyAwareAssistantPresentation — comma-separated CTA 제거", () => {
    const chips = ["추천안 적용", "일부 수정", "다른 대안 보기"];
    const msg = "다음: 추천안 적용, 일부 수정, 다른 대안 보기 중 선택해 주세요.";
    const out = applyQuickReplyAwareAssistantPresentation(msg, chips);
    expect(out).not.toMatch(/다음:/);
  });

  it("ensureAlternativeProposalIntro — 대안 맥락", () => {
    const out = ensureAlternativeProposalIntro("예상 흐름\n1. A\n2. B");
    expect(out).toContain("기존 초안과 다른 방향");
  });
});
