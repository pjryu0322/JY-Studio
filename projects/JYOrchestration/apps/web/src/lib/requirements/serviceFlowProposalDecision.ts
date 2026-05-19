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
import {
  quickRepliesForConversationState,
  quickReplyProfileForState,
  resolveServiceFlowConversationState,
  reviewDepthForDecision,
  withServiceFlowConversationState,
  type ServiceFlowConversationState,
  type ServiceFlowQuickReplyProfile,
  type ServiceFlowReviewDepth,
} from "@/lib/requirements/serviceFlowConversationState";
import { buildServiceFlowReviewPresentation } from "@/lib/requirements/serviceFlowReviewPresentation";
import {
  hydrateServiceFlowStepsFromAlternativePayload,
  mergeQuickRepliesWithAlternativeCanvasReopen,
  REOPEN_ALTERNATIVE_CANVAS_LABEL,
} from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import { markFlowAsPrimaryProposalVariant } from "@/lib/requirements/serviceFlowProposalVariant";

export type ServiceFlowProposalDecision =
  | ProposalDecision
  | "REVIEW_FLOW"
  | "FLOW_APPROVE"
  | "FEATURE_DETAIL"
  | "VIEW_ALTERNATIVE_DETAIL"
  | "KEEP_PRIMARY";

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
  "FLOW_APPROVE",
  "FEATURE_DETAIL",
  "VIEW_ALTERNATIVE_DETAIL",
  "KEEP_PRIMARY",
]);

export function classifyServiceFlowProposalDecision(
  label: string | null | undefined,
): ServiceFlowProposalDecision | null {
  const s = String(label ?? "").trim();
  if (!s) return null;

  if (/대안\s*상세/.test(s)) return "VIEW_ALTERNATIVE_DETAIL";
  if (/기존안\s*유지/.test(s)) return "KEEP_PRIMARY";
  if (/이\s*대안\s*적용/.test(s)) return "APPLY";
  if (/다른\s*대안\s*(다시\s*)?생성|다른\s*대안\s*보기/.test(s)) return "ALTERNATIVE";
  if (/흐름\s*상세\s*검토|흐름\s*검토/.test(s)) return "REVIEW_FLOW";
  if (/흐름\s*승인/.test(s)) return "FLOW_APPROVE";
  if (/세부\s*기능\s*정리/.test(s)) return "FEATURE_DETAIL";
  if (/그대로\s*진행/.test(s)) {
    return "FLOW_APPROVE";
  }
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
  if (raw === "FLOW_APPROVE" || raw === "FEATURE_DETAIL") {
    return raw as ServiceFlowProposalDecision;
  }
  if (raw && SERVICE_FLOW_DECISIONS.has(raw as ServiceFlowProposalDecision)) {
    return raw as ServiceFlowProposalDecision;
  }
  const label = String(input.quickActionLabel ?? "").trim() || String(input.userMessage ?? "").trim();
  return classifyServiceFlowProposalDecision(label);
}

export function serviceFlowHasReviewableState(flow: RequirementsServiceFlowV1 | null): boolean {
  if (!flow) return false;
  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
  return (hydrated.actors?.length ?? 0) >= 1 && (hydrated.steps?.length ?? 0) >= 1;
}

export function buildServiceFlowStateSummaryMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly heading?: string;
  readonly cta?: string;
}): string {
  return buildServiceFlowReviewPresentation({
    flow: input.flow,
    depth: "summary",
    heading: input.heading,
    cta: input.cta,
  });
}

export function buildServiceFlowEnterReviewMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly applySyncSummary?: string | null;
}): string {
  const flow = hydrateServiceFlowStepsFromAlternativePayload(input.flow);
  const syncSummary = String(input.applySyncSummary ?? "").trim();
  if (syncSummary) {
    const canvasHint = flow.alternativeProposalPayload
      ? `\n\n**${REOPEN_ALTERNATIVE_CANVAS_LABEL}**에서 기존안과의 비교를 다시 확인할 수 있습니다.`
      : "";
    return `${syncSummary}${canvasHint}`;
  }
  const body = buildServiceFlowReviewPresentation({
    flow,
    depth: "summary",
    heading: "추천안을 서비스 흐름 검토 단계로 반영했습니다.",
    cta: "다음: 흐름 상세 검토 후 승인하거나 일부 수정할 수 있습니다.",
  });
  if (!flow.alternativeProposalPayload) return body;
  return `${body}\n\n**${REOPEN_ALTERNATIVE_CANVAS_LABEL}**에서 기존안과의 비교를 다시 확인할 수 있습니다.`;
}

export function buildServiceFlowApprovedTransitionMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
}): string {
  const steps = [...(input.flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean);

  const lines = [
    "서비스 흐름 초안을 승인 상태로 반영했습니다.",
    "",
    "확정된 흐름",
    ...steps.map((t, i) => `${i + 1}. ${t}`),
    "",
    "다음 단계에서는 각 흐름별 세부 기능과 화면/API를 정리할 수 있습니다.",
  ];
  return lines.join("\n").trim();
}

export function buildServiceFlowFeatureDetailTransitionMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
}): string {
  const steps = [...(input.flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const lines = [
    "서비스 흐름을 기준으로 세부 기능 정리 단계로 이동합니다.",
    "",
    "기능 정리 대상 흐름",
    ...steps.map((t, i) => `${i + 1}. ${t}`),
    "",
    "다음: 각 흐름별 기능·화면·API를 구체화하거나 수정할 수 있습니다.",
  ];
  return lines.join("\n").trim();
}

/** @deprecated use buildServiceFlowApprovedTransitionMessage — kept for replay guard callers */
export function buildServiceFlowApplyTransitionMessage(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly projectName?: string;
}): string {
  void input.projectName;
  return buildServiceFlowApprovedTransitionMessage({ flow: input.flow });
}

export function markServiceFlowProposalAccepted(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly snapshot: string;
  readonly decision: ServiceFlowProposalDecision;
  readonly nowIso?: string;
}): RequirementsServiceFlowV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const fp = buildProposalFingerprintFromFlow(input.flow);
  return withServiceFlowConversationState(
    {
      ...input.flow,
      updatedAt: now,
      acceptedProposalSnapshot: String(input.snapshot ?? "").trim().slice(0, 8000) || null,
      proposalAcceptedAt: now,
      lastProposalDecision: input.decision,
      acceptedProposalFingerprint: fp.normalizedWorkflowHash || undefined,
    },
    "APPROVED",
    now,
  );
}

export function shouldBlockServiceFlowProposalReplay(input: {
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly proposalDecision: ServiceFlowProposalDecision | null;
  readonly candidateAssistantMessage: string;
}): boolean {
  if (input.proposalDecision !== "FLOW_APPROVE" && input.proposalDecision !== "APPLY") {
    return false;
  }
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

export function shouldUseApprovedReviewReplayCompact(input: {
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly decision: ServiceFlowProposalDecision;
}): boolean {
  if (input.decision !== "REVIEW_FLOW") return false;
  return resolveServiceFlowConversationState(input.flow) === "APPROVED";
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
  conversationStateBefore: ServiceFlowConversationState;
  conversationStateAfter: ServiceFlowConversationState;
  reviewDepth: ServiceFlowReviewDepth;
  quickReplyProfile: ServiceFlowQuickReplyProfile;
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

function buildFastPathResult(input: {
  readonly assistantMessage: string;
  readonly updatedFlow: RequirementsServiceFlowV1;
  readonly quickReplies: readonly string[];
  readonly intent: string;
  readonly routingDecision: string;
  readonly timelineAction: string;
  readonly proposalDecision: ServiceFlowProposalDecision;
  readonly conversationStateBefore: ServiceFlowConversationState;
  readonly conversationStateAfter: ServiceFlowConversationState;
  readonly reviewDepth: ServiceFlowReviewDepth;
}): ServiceFlowDecisionFastPathResult {
  return {
    assistantMessage: input.assistantMessage,
    updatedFlow: input.updatedFlow,
    nextQuestion: null,
    quickReplies: input.quickReplies,
    intent: input.intent,
    readiness: computeReadiness(input.updatedFlow),
    visibleMode: "state_transition",
    routingDecision: input.routingDecision,
    timelineAction: input.timelineAction,
    llmCallSkipped: true,
    proposalDecision: input.proposalDecision,
    acceptedProposalSnapshot: input.assistantMessage.slice(0, 8000),
    conversationStateBefore: input.conversationStateBefore,
    conversationStateAfter: input.conversationStateAfter,
    reviewDepth: input.reviewDepth,
    quickReplyProfile: quickReplyProfileForState(input.conversationStateAfter),
  };
}

export function tryServiceFlowProposalDecisionFastPath(input: {
  readonly decision: ServiceFlowProposalDecision;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly projectName?: string;
  readonly nowIso?: string;
}): ServiceFlowDecisionFastPathResult | null {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const baseFlow: RequirementsServiceFlowV1 = hydrateServiceFlowStepsFromAlternativePayload(
    input.currentFlow ?? {
      createdAt: nowIso,
      updatedAt: nowIso,
      actors: [],
      steps: [],
    },
  );
  const stateBefore = resolveServiceFlowConversationState(baseFlow);

  if (input.decision === "REVIEW_FLOW") {
    if (!serviceFlowHasReviewableState(baseFlow)) return null;

    if (shouldUseApprovedReviewReplayCompact({ flow: baseFlow, decision: "REVIEW_FLOW" })) {
      const assistantMessage = buildServiceFlowReviewPresentation({
        flow: baseFlow,
        depth: "compact",
        heading: "현재 흐름은 이미 승인 상태입니다.",
      });
      return buildFastPathResult({
        assistantMessage,
        updatedFlow: { ...baseFlow, updatedAt: nowIso },
        quickReplies: quickRepliesForConversationState("APPROVED"),
        intent: "show_summary",
        routingDecision: "approved_review_replay_compact",
        timelineAction: "reviewFlowSummary",
        proposalDecision: "REVIEW_FLOW",
        conversationStateBefore: stateBefore,
        conversationStateAfter: "APPROVED",
        reviewDepth: "compact",
      });
    }

    const reviewDepth = reviewDepthForDecision({
      decision: "REVIEW_FLOW",
      conversationState: stateBefore === "PROPOSAL" ? "REVIEW" : stateBefore,
    });
    const nextState: ServiceFlowConversationState =
      stateBefore === "PROPOSAL" ? "REVIEW" : stateBefore === "APPROVED" ? "APPROVED" : "REVIEW";
    const flowForReview = withServiceFlowConversationState(baseFlow, nextState, nowIso);
    const assistantMessage = buildServiceFlowReviewPresentation({
      flow: flowForReview,
      depth: reviewDepth === "compact" ? "detailed" : reviewDepth,
      heading: "현재 서비스 흐름 상세 검토",
      cta: "다음: 흐름을 승인하거나 단계·액터를 수정할 수 있습니다.",
    });

    return buildFastPathResult({
      assistantMessage,
      updatedFlow: flowForReview,
      quickReplies: quickRepliesForConversationState(nextState === "APPROVED" ? "APPROVED" : "REVIEW"),
      intent: "show_summary",
      routingDecision: "flow_detailed_review_from_state",
      timelineAction: "reviewFlowSummary",
      proposalDecision: "REVIEW_FLOW",
      conversationStateBefore: stateBefore,
      conversationStateAfter: nextState,
      reviewDepth: "detailed",
    });
  }

  if (input.decision === "APPLY") {
    if (!serviceFlowHasReviewableState(baseFlow)) return null;
    const snapshot = buildServiceFlowStateSummaryMessage({ flow: baseFlow, heading: "", cta: "" });
    const flowReview = withServiceFlowConversationState(
      markFlowAsPrimaryProposalVariant(
        {
          ...baseFlow,
          acceptedProposalSnapshot: snapshot.slice(0, 8000) || null,
          lastProposalDecision: "APPLY",
          ...(baseFlow.alternativeProposalPayload
            ? { alternativeProposalPayload: baseFlow.alternativeProposalPayload }
            : {}),
        },
        nowIso,
      ),
      "REVIEW",
      nowIso,
    );
    const assistantMessage = buildServiceFlowEnterReviewMessage({ flow: flowReview });
    return buildFastPathResult({
      assistantMessage,
      updatedFlow: flowReview,
      quickReplies: mergeQuickRepliesWithAlternativeCanvasReopen(
        quickRepliesForConversationState("REVIEW"),
        Boolean(flowReview.alternativeProposalPayload),
      ),
      intent: "unclear",
      routingDecision: "proposal_apply_enter_review",
      timelineAction: "proposalDecisionApply",
      proposalDecision: "APPLY",
      conversationStateBefore: stateBefore,
      conversationStateAfter: "REVIEW",
      reviewDepth: "summary",
    });
  }

  if (input.decision === "FLOW_APPROVE") {
    if (!serviceFlowHasReviewableState(baseFlow)) return null;
    const snapshot = buildServiceFlowStateSummaryMessage({ flow: baseFlow, heading: "", cta: "" });
    const updatedFlow = markServiceFlowProposalAccepted({
      flow: baseFlow,
      snapshot,
      decision: "FLOW_APPROVE",
      nowIso,
    });
    const assistantMessage = buildServiceFlowApprovedTransitionMessage({ flow: updatedFlow });
    return buildFastPathResult({
      assistantMessage,
      updatedFlow,
      quickReplies: quickRepliesForConversationState("APPROVED"),
      intent: "unclear",
      routingDecision: "flow_approve_transition",
      timelineAction: "flowApprove",
      proposalDecision: "FLOW_APPROVE",
      conversationStateBefore: stateBefore,
      conversationStateAfter: "APPROVED",
      reviewDepth: "compact",
    });
  }

  if (input.decision === "FEATURE_DETAIL") {
    if (!serviceFlowHasReviewableState(baseFlow)) return null;
    const updatedFlow = withServiceFlowConversationState(baseFlow, "FEATURE_DETAIL", nowIso);
    const assistantMessage = buildServiceFlowFeatureDetailTransitionMessage({ flow: updatedFlow });
    return buildFastPathResult({
      assistantMessage,
      updatedFlow,
      quickReplies: quickRepliesForConversationState("FEATURE_DETAIL"),
      intent: "unclear",
      routingDecision: "feature_detail_transition",
      timelineAction: "featureDetailTransition",
      proposalDecision: "FEATURE_DETAIL",
      conversationStateBefore: stateBefore,
      conversationStateAfter: "FEATURE_DETAIL",
      reviewDepth: "compact",
    });
  }

  return null;
}
