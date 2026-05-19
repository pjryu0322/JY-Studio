import { describe, expect, it } from "vitest";
import {
  buildProposalId,
  hashProposalResponse,
  shouldBlockProposalReplay,
  transitionLifecycleOnDecision,
  transitionLifecycleOnPendingProposal,
} from "@/lib/requirements/singleChatProposalLifecycle";
import { classifyProposalDecision } from "@/lib/requirements/singleChatQuickAction";

describe("singleChatProposalLifecycle", () => {
  it("classifyProposalDecision maps chip labels", () => {
    expect(classifyProposalDecision("추천안 적용")).toBe("APPLY");
    expect(classifyProposalDecision("일부 수정")).toBe("PARTIAL_EDIT");
    expect(classifyProposalDecision("다른 대안 보기")).toBe("ALTERNATIVE");
    expect(classifyProposalDecision("직접 입력")).toBe("DIRECT_INPUT");
    expect(classifyProposalDecision("보류")).toBe("HOLD");
  });

  it("transitionLifecycleOnDecision APPLY → NEXT_STAGE_READY with snapshot", () => {
    const pending = transitionLifecycleOnPendingProposal({
      lifecycle: null,
      stageGroup: "service_planning",
      proposalMessage: "예상 흐름\n1. A\n2. B\n3. C",
      nowIso: "2026-05-19T00:00:00.000Z",
    });
    const accepted = transitionLifecycleOnDecision({
      lifecycle: pending,
      decision: "APPLY",
      stageGroup: "service_planning",
      acceptedSnapshot: pending.pendingProposalPreview ?? "",
      nowIso: "2026-05-19T00:00:01.000Z",
    });
    expect(accepted.phase).toBe("NEXT_STAGE_READY");
    expect(accepted.acceptedProposalSnapshot).toContain("예상 흐름");
    expect(accepted.lastDecision).toBe("APPLY");
    expect(accepted.proposalId).toBe(buildProposalId("service_planning", pending.responseHash));
  });

  it("shouldBlockProposalReplay blocks same hash while waiting", () => {
    const hash = hashProposalResponse("동일 proposal 본문");
    const lc = transitionLifecycleOnPendingProposal({
      lifecycle: null,
      stageGroup: "service_planning",
      proposalMessage: "동일 proposal 본문",
      nowIso: "2026-05-19T00:00:00.000Z",
    });
    expect(
      shouldBlockProposalReplay({
        lifecycle: lc,
        stageGroup: "service_planning",
        candidateMessageHash: hash,
        proposalDecision: null,
      }),
    ).toBe(true);
    expect(
      shouldBlockProposalReplay({
        lifecycle: lc,
        stageGroup: "service_planning",
        candidateMessageHash: hash,
        proposalDecision: "APPLY",
      }),
    ).toBe(false);
  });
});
