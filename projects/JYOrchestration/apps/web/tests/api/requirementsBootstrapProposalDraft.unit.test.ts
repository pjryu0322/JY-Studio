import { describe, expect, it } from "vitest";
import {
  parseBootstrapProposalDraftFromJson,
  synthesizeBootstrapUserMessageFromProposalDraft,
  validateBootstrapProposalDraft,
} from "@/lib/requirements/requirementsBootstrapProposalDraft";

describe("requirementsBootstrapProposalDraft", () => {
  it("parseBootstrapProposalDraftFromJson는 workflow·actors를 파싱한다", () => {
    const d = parseBootstrapProposalDraftFromJson({
      summary: "회의록 자동화",
      actors: ["작성자", "관리자"],
      workflow: ["업로드", "STT", "초안 생성"],
      stages: [],
      capabilities: [],
    });
    expect(d?.workflow.length).toBe(3);
    expect(d?.actors.length).toBe(2);
  });

  it("proposal 없이 question-first만 있으면 invalid", () => {
    const r = validateBootstrapProposalDraft({
      proposalDraft: null,
      question: "첫 단계는 무엇입니까?",
    });
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("missing_proposal_draft");
  });

  it("synthesize는 흐름·액터 블록을 포함한다", () => {
    const draft = parseBootstrapProposalDraftFromJson({
      summary: "회의록 자동화로 이해했습니다.",
      actors: ["작성자", "참석자"],
      workflow: ["녹취 업로드", "STT", "검토·확정"],
      stages: [],
      capabilities: [],
    })!;
    const msg = synthesizeBootstrapUserMessageFromProposalDraft(draft, "맞는지 확인해 주세요.");
    expect(msg).toContain("예상 서비스 흐름");
    expect(msg).toContain("예상 액터");
    expect(msg).not.toContain("첫 단계는 무엇");
  });

  it("충분한 proposalDraft는 valid", () => {
    const draft = parseBootstrapProposalDraftFromJson({
      summary: "서비스 초안",
      actors: ["사용자", "관리자"],
      workflow: ["입력", "처리", "확정"],
      stages: [],
      capabilities: [],
    })!;
    const r = validateBootstrapProposalDraft({ proposalDraft: draft, question: "수정해 주세요" });
    expect(r.ok).toBe(true);
  });
});
