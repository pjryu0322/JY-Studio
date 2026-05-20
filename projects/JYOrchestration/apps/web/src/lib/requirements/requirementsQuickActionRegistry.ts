/**
 * QuickAction registry — orchestration transitions use actionId, not display labels.
 */

import type { ServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import type { ServiceFlowConversationState, ServiceFlowQuickReplyProfile } from "@/lib/requirements/serviceFlowConversationState";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { ServiceFlowTransitionSignal } from "@/lib/requirements/serviceFlowStageTransition";
import { classifyProposalDecision, type ProposalDecision } from "@/lib/requirements/singleChatQuickAction";

export type QuickActionId =
  | "APPLY_PROPOSAL"
  | "REVIEW_FLOW"
  | "APPROVE_FLOW"
  | "EDIT_STEPS"
  | "ADD_ACTOR"
  | "GENERATE_ALTERNATIVE"
  | "VIEW_ALTERNATIVE_DETAIL"
  | "APPLY_ALTERNATIVE"
  | "KEEP_PRIMARY"
  | "REGENERATE_ALTERNATIVE"
  | "START_FEATURE_DETAIL"
  | "DOCUMENT_FLOW"
  | "COMPLETE_DOCUMENTATION"
  | "NEXT_STAGE"
  | "PARTIAL_EDIT"
  | "DIRECT_INPUT"
  | "HOLD"
  | "EDIT_FEATURES"
  | "DEFINE_SCREEN"
  | "DEFINE_API"
  | "GENERATE_DOCUMENT";

export type QuickReplyWire =
  | string
  | Readonly<{
      readonly id: QuickActionId;
      readonly label: string;
    }>;

export type QuickAction = Readonly<{
  readonly id: QuickActionId;
  readonly label: string;
  readonly uiIntent?: "primary" | "secondary" | "danger" | "neutral";
}>;

export type QuickActionDefinition = Readonly<{
  readonly id: QuickActionId;
  readonly defaultLabel: string;
  readonly labelAliases?: readonly string[];
  readonly conversationProfiles: readonly ServiceFlowQuickReplyProfile[];
  readonly proposalDecision: ServiceFlowProposalDecision | null;
  readonly transitionSignal: ServiceFlowTransitionSignal | null;
  readonly uiIntent?: QuickAction["uiIntent"];
}>;

const QUICK_ACTION_REGISTRY: Record<QuickActionId, QuickActionDefinition> = {
  APPLY_PROPOSAL: {
    id: "APPLY_PROPOSAL",
    defaultLabel: "추천안 적용",
    conversationProfiles: ["proposal"],
    proposalDecision: "APPLY",
    transitionSignal: null,
    uiIntent: "primary",
  },
  PARTIAL_EDIT: {
    id: "PARTIAL_EDIT",
    defaultLabel: "일부 수정",
    conversationProfiles: ["proposal"],
    proposalDecision: "PARTIAL_EDIT",
    transitionSignal: null,
  },
  GENERATE_ALTERNATIVE: {
    id: "GENERATE_ALTERNATIVE",
    defaultLabel: "다른 대안 보기",
    labelAliases: ["다른 대안 다시 생성"],
    conversationProfiles: ["proposal"],
    proposalDecision: "ALTERNATIVE",
    transitionSignal: null,
  },
  DIRECT_INPUT: {
    id: "DIRECT_INPUT",
    defaultLabel: "직접 입력",
    conversationProfiles: ["proposal"],
    proposalDecision: "DIRECT_INPUT",
    transitionSignal: null,
  },
  HOLD: {
    id: "HOLD",
    defaultLabel: "보류",
    conversationProfiles: ["proposal"],
    proposalDecision: "HOLD",
    transitionSignal: null,
  },
  APPROVE_FLOW: {
    id: "APPROVE_FLOW",
    defaultLabel: "흐름 확정",
    labelAliases: ["흐름 승인하기", "그대로 진행"],
    conversationProfiles: ["review", "approved"],
    proposalDecision: "FLOW_APPROVE",
    transitionSignal: "APPROVE_FLOW",
    uiIntent: "primary",
  },
  EDIT_STEPS: {
    id: "EDIT_STEPS",
    defaultLabel: "단계 수정하기",
    labelAliases: ["단계 수정", "빠진 단계 추가"],
    conversationProfiles: ["review", "approved"],
    proposalDecision: "PARTIAL_EDIT",
    transitionSignal: null,
  },
  ADD_ACTOR: {
    id: "ADD_ACTOR",
    defaultLabel: "액터 추가하기",
    conversationProfiles: ["review"],
    proposalDecision: "PARTIAL_EDIT",
    transitionSignal: null,
  },
  REVIEW_FLOW: {
    id: "REVIEW_FLOW",
    defaultLabel: "흐름 상세 검토",
    labelAliases: ["흐름 검토하기"],
    conversationProfiles: ["review"],
    proposalDecision: "REVIEW_FLOW",
    transitionSignal: null,
  },
  START_FEATURE_DETAIL: {
    id: "START_FEATURE_DETAIL",
    defaultLabel: "세부 기능 정리",
    conversationProfiles: ["review", "approved"],
    proposalDecision: "FEATURE_DETAIL",
    transitionSignal: "FEATURE_DETAIL_START",
  },
  NEXT_STAGE: {
    id: "NEXT_STAGE",
    defaultLabel: "다음 단계 진행",
    conversationProfiles: ["approved"],
    proposalDecision: "NEXT_STAGE",
    transitionSignal: "NEXT_STAGE",
    uiIntent: "primary",
  },
  DOCUMENT_FLOW: {
    id: "DOCUMENT_FLOW",
    defaultLabel: "문서화하기",
    conversationProfiles: ["approved"],
    proposalDecision: null,
    transitionSignal: null,
  },
  COMPLETE_DOCUMENTATION: {
    id: "COMPLETE_DOCUMENTATION",
    defaultLabel: "문서화 완료",
    conversationProfiles: ["approved"],
    proposalDecision: "DOCUMENTATION_COMPLETE",
    transitionSignal: "DOCUMENTATION_COMPLETE",
  },
  VIEW_ALTERNATIVE_DETAIL: {
    id: "VIEW_ALTERNATIVE_DETAIL",
    defaultLabel: "대안 상세",
    conversationProfiles: [],
    proposalDecision: "VIEW_ALTERNATIVE_DETAIL",
    transitionSignal: null,
  },
  APPLY_ALTERNATIVE: {
    id: "APPLY_ALTERNATIVE",
    defaultLabel: "이 대안 적용",
    conversationProfiles: [],
    proposalDecision: "APPLY",
    transitionSignal: null,
    uiIntent: "primary",
  },
  KEEP_PRIMARY: {
    id: "KEEP_PRIMARY",
    defaultLabel: "기존안 유지",
    conversationProfiles: [],
    proposalDecision: "KEEP_PRIMARY",
    transitionSignal: null,
  },
  REGENERATE_ALTERNATIVE: {
    id: "REGENERATE_ALTERNATIVE",
    defaultLabel: "다른 대안 다시 생성",
    conversationProfiles: [],
    proposalDecision: "ALTERNATIVE",
    transitionSignal: null,
  },
  EDIT_FEATURES: {
    id: "EDIT_FEATURES",
    defaultLabel: "기능 수정",
    conversationProfiles: ["feature_detail"],
    proposalDecision: null,
    transitionSignal: null,
  },
  DEFINE_SCREEN: {
    id: "DEFINE_SCREEN",
    defaultLabel: "화면 정의",
    conversationProfiles: ["feature_detail"],
    proposalDecision: null,
    transitionSignal: null,
  },
  DEFINE_API: {
    id: "DEFINE_API",
    defaultLabel: "API 정의",
    conversationProfiles: ["feature_detail"],
    proposalDecision: null,
    transitionSignal: null,
  },
  GENERATE_DOCUMENT: {
    id: "GENERATE_DOCUMENT",
    defaultLabel: "문서 생성",
    conversationProfiles: ["feature_detail"],
    proposalDecision: null,
    transitionSignal: null,
  },
};

const QUICK_ACTION_ID_SET = new Set<string>(Object.keys(QUICK_ACTION_REGISTRY));

const LABEL_TO_ACTION_ID = new Map<string, QuickActionId>();
for (const def of Object.values(QUICK_ACTION_REGISTRY)) {
  LABEL_TO_ACTION_ID.set(def.defaultLabel.trim(), def.id);
  for (const alias of def.labelAliases ?? []) {
    LABEL_TO_ACTION_ID.set(String(alias).trim(), def.id);
  }
}

export function isQuickActionId(raw: string | null | undefined): raw is QuickActionId {
  return QUICK_ACTION_ID_SET.has(String(raw ?? "").trim());
}

export function getQuickActionDefinition(id: QuickActionId): QuickActionDefinition {
  return QUICK_ACTION_REGISTRY[id];
}

export function quickActionToWire(action: QuickAction): QuickReplyWire {
  return { id: action.id, label: action.label };
}

export function quickActionFromDefinition(def: QuickActionDefinition, label?: string): QuickAction {
  return {
    id: def.id,
    label: String(label ?? def.defaultLabel).trim() || def.defaultLabel,
    ...(def.uiIntent ? { uiIntent: def.uiIntent } : {}),
  };
}

export function quickActionsForConversationProfile(
  profile: ServiceFlowQuickReplyProfile,
): readonly QuickAction[] {
  return Object.values(QUICK_ACTION_REGISTRY)
    .filter((d) => d.conversationProfiles.includes(profile))
    .map((d) => quickActionFromDefinition(d));
}

export function quickActionsForConversationState(
  state: ServiceFlowConversationState,
): readonly QuickAction[] {
  const profile =
    state === "REVIEW"
      ? "review"
      : state === "APPROVED"
        ? "approved"
        : state === "FEATURE_DETAIL"
          ? "feature_detail"
          : "proposal";
  return quickActionsForConversationProfile(profile);
}

export function resolveQuickActionIdFromLegacyLabel(label: string | null | undefined): QuickActionId | null {
  const s = String(label ?? "").trim();
  if (!s) return null;
  if (isQuickActionId(s)) return s;
  return LABEL_TO_ACTION_ID.get(s) ?? null;
}

/** Chip click → `{ id, label }` for transition dispatch (label-only chips without registry match return null). */
export function quickActionDispatchFromLegacyLabel(
  label: string | null | undefined,
): QuickAction | null {
  const id = resolveQuickActionIdFromLegacyLabel(label);
  if (!id) return null;
  const trimmed = String(label ?? "").trim();
  return quickActionFromDefinition(getQuickActionDefinition(id), trimmed || undefined);
}

export function normalizeQuickReplyWire(wire: QuickReplyWire): QuickAction | null {
  if (typeof wire === "string") {
    const label = wire.trim();
    if (!label) return null;
    const id = resolveQuickActionIdFromLegacyLabel(label);
    if (!id) return null;
    return quickActionFromDefinition(getQuickActionDefinition(id), label);
  }
  const id = wire.id;
  const label = String(wire.label ?? "").trim() || getQuickActionDefinition(id).defaultLabel;
  return quickActionFromDefinition(getQuickActionDefinition(id), label);
}

export function normalizeQuickRepliesToActions(
  wires: readonly QuickReplyWire[] | readonly string[] | null | undefined,
): readonly QuickAction[] {
  if (!wires?.length) return [];
  const out: QuickAction[] = [];
  const seen = new Set<QuickActionId>();
  for (const wire of wires) {
    const action = normalizeQuickReplyWire(wire as QuickReplyWire);
    if (!action || seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(action);
  }
  return out;
}

export function quickActionIdToProposalDecision(
  id: QuickActionId | string | null | undefined,
): ServiceFlowProposalDecision | null {
  if (!id || !isQuickActionId(id)) return null;
  return QUICK_ACTION_REGISTRY[id].proposalDecision;
}

export function quickActionIdToTransitionSignal(
  id: QuickActionId | string | null | undefined,
): ServiceFlowTransitionSignal | null {
  if (!id || !isQuickActionId(id)) return null;
  return QUICK_ACTION_REGISTRY[id].transitionSignal;
}

const SERVICE_FLOW_DECISION_RAW = new Set<string>([
  "APPLY",
  "PARTIAL_EDIT",
  "ALTERNATIVE",
  "DIRECT_INPUT",
  "HOLD",
  "REVIEW_FLOW",
  "FLOW_APPROVE",
  "FEATURE_DETAIL",
  "NEXT_STAGE",
  "DOCUMENTATION_COMPLETE",
  "VIEW_ALTERNATIVE_DETAIL",
  "KEEP_PRIMARY",
]);

export function resolveProposalDecisionFromQuickActionInput(input: {
  readonly quickActionId?: string | null;
  readonly quickActionLabel?: string | null;
  readonly userMessage?: string | null;
  readonly proposalDecisionRaw?: string | null;
}): ServiceFlowProposalDecision | null {
  const raw = String(input.proposalDecisionRaw ?? "")
    .trim()
    .toUpperCase();
  if (raw && isQuickActionId(raw)) {
    const d = quickActionIdToProposalDecision(raw);
    if (d) return d;
  }
  if (SERVICE_FLOW_DECISION_RAW.has(raw)) {
    return raw as ServiceFlowProposalDecision;
  }

  const fromId = input.quickActionId ? quickActionIdToProposalDecision(input.quickActionId) : null;
  if (fromId) return fromId;

  const legacyId =
    resolveQuickActionIdFromLegacyLabel(input.quickActionLabel) ??
    resolveQuickActionIdFromLegacyLabel(input.userMessage);
  if (legacyId) {
    const mapped = quickActionIdToProposalDecision(legacyId);
    if (mapped) return mapped;
  }

  const label = String(input.quickActionLabel ?? "").trim() || String(input.userMessage ?? "").trim();
  if (!label) return null;
  return classifyProposalDecision(label);
}

export function resolveTransitionSignalFromQuickActionInput(input: {
  readonly quickActionId?: string | null;
  readonly proposalDecision?: ServiceFlowProposalDecision | null;
}): ServiceFlowTransitionSignal | null {
  const fromId = input.quickActionId ? quickActionIdToTransitionSignal(input.quickActionId) : null;
  if (fromId) return fromId;
  if (input.proposalDecision === "NEXT_STAGE") return "NEXT_STAGE";
  if (input.proposalDecision === "DOCUMENTATION_COMPLETE") return "DOCUMENTATION_COMPLETE";
  if (input.proposalDecision === "FLOW_APPROVE") return "APPROVE_FLOW";
  if (input.proposalDecision === "FEATURE_DETAIL") return "FEATURE_DETAIL_START";
  return null;
}

export function quickActionsToLabels(actions: readonly QuickAction[]): readonly string[] {
  return actions.map((a) => a.label);
}

export function quickActionsToWires(actions: readonly QuickAction[]): readonly QuickReplyWire[] {
  return actions.map((a) => quickActionToWire(a));
}

/** Stage-scoped action filter (actionId-based, no RegExp). */
export function filterQuickActionsForOrchestrationStage(
  stage: OrchestrationStage,
  actions: readonly QuickAction[],
  input: {
    readonly allowedActionIds: readonly QuickActionId[];
    readonly obsoleteActionIds: readonly QuickActionId[];
  },
): readonly QuickAction[] {
  const allowed = new Set(input.allowedActionIds);
  const obsolete = new Set(input.obsoleteActionIds);
  return actions.filter((a) => {
    if (obsolete.has(a.id)) return false;
    if (!allowed.size) return true;
    return allowed.has(a.id);
  });
}
