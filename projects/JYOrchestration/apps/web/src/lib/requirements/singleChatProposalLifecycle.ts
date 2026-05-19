/**
 * Proposal 승인/선택 → orchestration state transition (question-first 재합성 방지).
 */

import { hasProposalFirstStructure } from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import type { ProposalDecision } from "@/lib/requirements/singleChatQuickAction";

export type SingleChatProposalLifecyclePhase =
  | "WAITING_PROPOSAL_DECISION"
  | "PROPOSAL_ACCEPTED"
  | "NEXT_STAGE_READY";

export type SingleChatProposalLifecycleV1 = Readonly<{
  phase: SingleChatProposalLifecyclePhase;
  proposalId: string;
  stageGroup: string;
  responseHash: string;
  pendingProposalPreview: string | null;
  acceptedProposalSnapshot: string | null;
  acceptedAt: string | null;
  lastDecision: ProposalDecision | null;
}>;

const PHASES = new Set<SingleChatProposalLifecyclePhase>([
  "WAITING_PROPOSAL_DECISION",
  "PROPOSAL_ACCEPTED",
  "NEXT_STAGE_READY",
]);

export function hashProposalResponse(text: string): string {
  const s = String(text ?? "").trim();
  if (!s) return "";
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return `h${(h >>> 0).toString(16)}`;
}

export function buildProposalId(stageGroup: string, responseHash: string): string {
  const sg = String(stageGroup ?? "").trim() || "default";
  const rh = String(responseHash ?? "").trim() || "empty";
  return `${sg}::${rh}`;
}

export function parseSingleChatProposalLifecycleV1(raw: unknown): SingleChatProposalLifecycleV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const phase = String(o.phase ?? "").trim() as SingleChatProposalLifecyclePhase;
  if (!PHASES.has(phase)) return null;
  const proposalId = String(o.proposalId ?? "").trim();
  const stageGroup = String(o.stageGroup ?? "").trim();
  const responseHash = String(o.responseHash ?? "").trim();
  if (!proposalId || !stageGroup) return null;
  const pendingProposalPreview =
    o.pendingProposalPreview === null || o.pendingProposalPreview === undefined
      ? null
      : String(o.pendingProposalPreview).slice(0, 8000);
  const acceptedProposalSnapshot =
    o.acceptedProposalSnapshot === null || o.acceptedProposalSnapshot === undefined
      ? null
      : String(o.acceptedProposalSnapshot).slice(0, 8000);
  const acceptedAt = typeof o.acceptedAt === "string" ? o.acceptedAt.trim() : null;
  const lastDecisionRaw = String(o.lastDecision ?? "").trim();
  const lastDecision = lastDecisionRaw ? (lastDecisionRaw as ProposalDecision) : null;
  return {
    phase,
    proposalId,
    stageGroup,
    responseHash: responseHash || hashProposalResponse(pendingProposalPreview ?? ""),
    pendingProposalPreview,
    acceptedProposalSnapshot,
    acceptedAt,
    lastDecision,
  };
}

export function transitionLifecycleOnPendingProposal(input: {
  readonly lifecycle: SingleChatProposalLifecycleV1 | null | undefined;
  readonly stageGroup: string;
  readonly proposalMessage: string;
  readonly nowIso: string;
}): SingleChatProposalLifecycleV1 {
  const preview = String(input.proposalMessage ?? "").trim().slice(0, 8000);
  const responseHash = hashProposalResponse(preview);
  const proposalId = buildProposalId(input.stageGroup, responseHash);
  return {
    phase: "WAITING_PROPOSAL_DECISION",
    proposalId,
    stageGroup: input.stageGroup,
    responseHash,
    pendingProposalPreview: preview || null,
    acceptedProposalSnapshot: input.lifecycle?.acceptedProposalSnapshot ?? null,
    acceptedAt: input.lifecycle?.acceptedAt ?? null,
    lastDecision: null,
  };
}

export function transitionLifecycleOnDecision(input: {
  readonly lifecycle: SingleChatProposalLifecycleV1 | null | undefined;
  readonly decision: ProposalDecision;
  readonly stageGroup: string;
  readonly acceptedSnapshot: string;
  readonly nowIso: string;
}): SingleChatProposalLifecycleV1 {
  const snapshot = String(input.acceptedSnapshot ?? "").trim().slice(0, 8000);
  const responseHash = hashProposalResponse(snapshot);
  const proposalId =
    input.lifecycle?.proposalId && input.lifecycle.stageGroup === input.stageGroup
      ? input.lifecycle.proposalId
      : buildProposalId(input.stageGroup, responseHash);

  if (input.decision === "APPLY") {
    return {
      phase: "NEXT_STAGE_READY",
      proposalId,
      stageGroup: input.stageGroup,
      responseHash,
      pendingProposalPreview: (input.lifecycle?.pendingProposalPreview ?? snapshot) || null,
      acceptedProposalSnapshot: snapshot || input.lifecycle?.pendingProposalPreview || null,
      acceptedAt: input.nowIso,
      lastDecision: "APPLY",
    };
  }

  if (input.decision === "HOLD" || input.decision === "ALTERNATIVE" || input.decision === "PARTIAL_EDIT") {
    return {
      phase: "WAITING_PROPOSAL_DECISION",
      proposalId,
      stageGroup: input.stageGroup,
      responseHash: input.lifecycle?.responseHash ?? responseHash,
      pendingProposalPreview: (input.lifecycle?.pendingProposalPreview ?? snapshot) || null,
      acceptedProposalSnapshot: input.lifecycle?.acceptedProposalSnapshot ?? null,
      acceptedAt: input.lifecycle?.acceptedAt ?? null,
      lastDecision: input.decision,
    };
  }

  return {
    phase: "PROPOSAL_ACCEPTED",
    proposalId,
    stageGroup: input.stageGroup,
    responseHash,
    pendingProposalPreview: (input.lifecycle?.pendingProposalPreview ?? snapshot) || null,
    acceptedProposalSnapshot: snapshot || input.lifecycle?.pendingProposalPreview || null,
    acceptedAt: input.nowIso,
    lastDecision: input.decision,
  };
}

/** 동일 proposal 재출력 차단 */
export function shouldBlockProposalReplay(input: {
  readonly lifecycle: SingleChatProposalLifecycleV1 | null | undefined;
  readonly stageGroup: string;
  readonly candidateMessageHash: string;
  readonly proposalDecision: ProposalDecision | null;
}): boolean {
  if (input.proposalDecision === "APPLY") return false;
  const lc = input.lifecycle;
  if (!lc || lc.stageGroup !== input.stageGroup) return false;
  const hash = String(input.candidateMessageHash ?? "").trim();
  if (!hash || !lc.responseHash || hash !== lc.responseHash) return false;
  if (lc.phase === "NEXT_STAGE_READY") return true;
  if (lc.phase === "PROPOSAL_ACCEPTED" && !input.proposalDecision) return true;
  if (lc.phase === "WAITING_PROPOSAL_DECISION" && !input.proposalDecision) return true;
  return false;
}

export function shouldRegisterPendingProposal(message: string): boolean {
  const t = String(message ?? "").trim();
  return Boolean(t) && hasProposalFirstStructure(t);
}

export function buildProposalDecisionUserSignal(decision: ProposalDecision, label: string | null): string {
  const chip = String(label ?? "").trim();
  const lines = [`[ProposalDecision]`, `action: ${decision}`];
  if (decision === "APPLY") {
    lines.push(
      "instruction: 사용자가 추천안을 승인함. 동일 proposal 재합성·coordinator synthesis·validation fallback 금지.",
      "instruction: acceptedProposalSnapshot을 확정하고 다음 단계 기획(세부 요구·기능·액터·데이터 흐름)으로만 진행.",
    );
  } else if (decision === "PARTIAL_EDIT") {
    lines.push("instruction: 직전 proposal을 기본안으로 두고 수정 지점 1가지만 구체화.");
  } else if (decision === "ALTERNATIVE") {
    lines.push("instruction: 이전과 겹치지 않는 새 대안 2~3개 제시.");
  } else if (decision === "DIRECT_INPUT") {
    lines.push("instruction: 사용자 자유 입력을 최우선 반영.");
  } else if (decision === "HOLD") {
    lines.push("instruction: 결정 강요 없이 보류. 변경 최소.");
  }
  if (chip) lines.push(`chipLabel: ${chip}`);
  return lines.join("\n");
}
