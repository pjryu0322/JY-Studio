/**
 * Service-flow proposal quick actions — orchestration signals (not plain chat).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildProposalFingerprintFromFlow,
  buildProposalFingerprintFromText,
  proposalFingerprintsStructurallySimilar,
  proposalTextsStructurallySimilar,
} from "@/lib/requirements/crossStageProposalDedupe";
import {
  classifyProposalDecision,
  type ProposalDecision,
} from "@/lib/requirements/singleChatQuickAction";

export type ServiceFlowProposalDecision = ProposalDecision | "REVIEW_FLOW";

export type ServiceFlowVisibleModeExtended =
  | "visible_proposal"
  | "handoff_state_only"
  | "visible_delta"
  | "state_transition";

const SERVICE_FLOW_DECISIONS = new Set<ServiceFlowProposalDecision>([
  "APPLY",
  "PARTIAL_EDIT",
  "ALTERNATIVE",
  "DIRECT_INPUT",
  "HOLD",
  "REVIEW_FLOW",
]);

export const SERVICE_FLOW_REVIEW_QUICK_REPLIES = ["흐름 승인하기", "단계 수정하기", "액터 추가하기"] as const;

export const SERVICE_FLOW_POST_APPLY_QUICK_REPLIES = [
  "흐름 검토하기",
  "단계 수정하기",
  "세부 기능 정리",
] as const;

export function classifyServiceFlowProposalDecision(
  label: string | null | undefined,
): ServiceFlowProposalDecision | null {
  const s = String(label ?? "").trim();
  if (!s) return null;

  if (/흐름\s*검토/.test(s)) return "REVIEW_FLOW";
  if (/흐름\s*승인|그대로\s*진행/.test(s)) return "APPLY";
  if (/단계\s*수정|액터\s*추가|빠진\s*단계/.test(s)) return "PARTIAL_EDIT";

  return classifyProposalDecision(s);
}

export function resolveServiceFlowProposalDecision(input: {
  readonly quickActionLabel?: string | null;
  readonly userMessage?: string | null;
  readonly proposalDecisionRaw?: string | null;
}): ServiceFlowProposalDecision | null {
  const raw = String(input.proposalDecisionRaw ?? "")
    .trim()
    .toUpperCase();
  if (raw && SERVICE_FLOW_DECISIONS.has(raw as ServiceFlowProposalDecision)) {
    return raw as ServiceFlowProposalDecision;
  }
  const label = String(input.quickActionLabel ?? "").trim() || String(input.userMessage ?? "").trim();
  return classifyServiceFlowProposalDecision(label);
}

export function serviceFlowHasReviewableState(flow: RequirementsServiceFlowV1 | null): boolean {
  if (!flow) return false;
  return (flow.actors?.length ?? 0) >= 1 && (flow.steps?.length ?? 0) >= 1;
}

export function buildServiceFlowStateSummaryMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly heading?: string;
  readonly cta?: string;
}): string {
  const actors = (input.flow.actors ?? [])
    .map((a) => String(a.name ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
  const steps = [...(input.flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean)
    .slice(0, 16);

  const lines: string[] = [String(input.heading ?? "현재 서비스 흐름을 정리했습니다.").trim(), ""];
  if (actors.length) {
    lines.push("액터");
    for (const a of actors) lines.push(`- ${a}`);
    lines.push("");
  }
  if (steps.length) {
    lines.push("흐름");
    steps.forEach((title, i) => lines.push(`${i + 1}. ${title}`));
    lines.push("");
  }
  lines.push(
    String(input.cta ?? "다음: 이 흐름을 승인하거나 일부 수정할 수 있습니다.").trim(),
  );
  return lines.join("\n").trim();
}

export function buildServiceFlowApplyTransitionMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly projectName?: string;
}): string {
  const name = String(input.projectName ?? "").trim();
  const intro = name
    ? `추천안을 서비스 흐름 초안으로 반영했습니다.`
    : "추천안을 서비스 흐름 초안으로 반영했습니다.";
  const summary = buildServiceFlowStateSummaryMessage({
    flow: input.flow,
    heading: intro,
    cta: "다음: 세부 기능을 정리하거나, 흐름을 일부 수정할 수 있습니다.",
  });
  return summary;
}

export function markServiceFlowProposalAccepted(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly snapshot: string;
  readonly decision: ServiceFlowProposalDecision;
  readonly nowIso?: string;
}): RequirementsServiceFlowV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const fp = buildProposalFingerprintFromFlow(input.flow);
  return {
    ...input.flow,
    updatedAt: now,
    acceptedProposalSnapshot: String(input.snapshot ?? "").trim().slice(0, 8000) || null,
    proposalAcceptedAt: now,
    lastProposalDecision: input.decision,
    acceptedProposalFingerprint: fp.normalizedWorkflowHash || undefined,
  };
}

export function shouldBlockServiceFlowProposalReplay(input: {
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly proposalDecision: ServiceFlowProposalDecision | null;
  readonly candidateAssistantMessage: string;
}): boolean {
  if (input.proposalDecision !== "APPLY") return false;
  const flow = input.flow;
  if (!flow) return false;

  const candidate = String(input.candidateAssistantMessage ?? "").trim();
  if (!candidate) return false;

  const accepted = String(flow.acceptedProposalSnapshot ?? "").trim();
  if (accepted && proposalTextsStructurallySimilar(accepted, candidate)) return true;

  const acceptedFp = String(flow.acceptedProposalFingerprint ?? "").trim();
  const candidateFp = buildProposalFingerprintFromText("service-flow", candidate);
  if (
    acceptedFp &&
    candidateFp.normalizedWorkflowHash &&
    acceptedFp === candidateFp.normalizedWorkflowHash
  ) {
    return true;
  }

  const flowFp = buildProposalFingerprintFromFlow(flow);
  if (
    proposalFingerprintsStructurallySimilar(flowFp, candidateFp) &&
    flow.steps.length >= 3
  ) {
    return true;
  }

  return false;
}

export type ServiceFlowDecisionFastPathResult = Readonly<{
  assistantMessage: string;
  updatedFlow: RequirementsServiceFlowV1;
  nextQuestion: null;
  quickReplies: readonly string[];
  intent: string;
  readiness: {
    score: number;
    actorsReady: boolean;
    stepsReady: boolean;
    mappingReady: boolean;
    readyForNext: boolean;
  };
  visibleMode: ServiceFlowVisibleModeExtended;
  routingDecision: string;
  timelineAction: string;
  llmCallSkipped: true;
  proposalDecision: ServiceFlowProposalDecision;
  acceptedProposalSnapshot: string;
}>;

function computeReadiness(flow: RequirementsServiceFlowV1) {
  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  const actorsReady = actors.length >= 2;
  const stepsReady = steps.length >= 3;
  const mappingReady = steps.every(
    (s) => s.primaryActorId && actors.some((a) => a.id === s.primaryActorId),
  );
  const readyForNext = actorsReady && stepsReady && mappingReady;
  const score = readyForNext ? 85 : stepsReady && actorsReady ? 55 : steps.length ? 25 : 10;
  return { score, actorsReady, stepsReady, mappingReady, readyForNext };
}

export function tryServiceFlowProposalDecisionFastPath(input: {
  readonly decision: ServiceFlowProposalDecision;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly projectName?: string;
  readonly nowIso?: string;
}): ServiceFlowDecisionFastPathResult | null {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const baseFlow: RequirementsServiceFlowV1 = input.currentFlow ?? {
    createdAt: nowIso,
    updatedAt: nowIso,
    actors: [],
    steps: [],
  };

  if (input.decision === "REVIEW_FLOW") {
    if (!serviceFlowHasReviewableState(baseFlow)) return null;
    const assistantMessage = buildServiceFlowStateSummaryMessage({ flow: baseFlow });
    return {
      assistantMessage,
      updatedFlow: { ...baseFlow, updatedAt: nowIso },
      nextQuestion: null,
      quickReplies: [...SERVICE_FLOW_REVIEW_QUICK_REPLIES],
      intent: "show_summary",
      readiness: computeReadiness(baseFlow),
      visibleMode: "state_transition",
      routingDecision: "flow_summary_from_state",
      timelineAction: "reviewFlowSummary",
      llmCallSkipped: true,
      proposalDecision: "REVIEW_FLOW",
      acceptedProposalSnapshot: assistantMessage,
    };
  }

  if (input.decision === "APPLY") {
    if (!serviceFlowHasReviewableState(baseFlow)) return null;
    const snapshot = buildServiceFlowStateSummaryMessage({
      flow: baseFlow,
      heading: "",
      cta: "",
    });
    const updatedFlow = markServiceFlowProposalAccepted({
      flow: baseFlow,
      snapshot,
      decision: "APPLY",
      nowIso,
    });
    const assistantMessage = buildServiceFlowApplyTransitionMessage({
      flow: updatedFlow,
      projectName: input.projectName,
    });
    return {
      assistantMessage,
      updatedFlow,
      nextQuestion: null,
      quickReplies: [...SERVICE_FLOW_POST_APPLY_QUICK_REPLIES],
      intent: "unclear",
      readiness: computeReadiness(updatedFlow),
      visibleMode: "state_transition",
      routingDecision: "proposal_decision_apply_fast_path",
      timelineAction: "proposalDecisionApply",
      llmCallSkipped: true,
      proposalDecision: "APPLY",
      acceptedProposalSnapshot: assistantMessage,
    };
  }

  return null;
}
