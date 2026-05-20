/**
 * Requirements Intent Router — infers QuickActionId from free text (LLM-shaped output, rule-based v1).
 * Does NOT execute transitions; Registry Guard + transition engine own execution.
 */

import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { RequirementsOrchestrationProjection } from "@/lib/requirements/requirementsOrchestrationProjection";
import {
  resolveQuickActionIdFromLegacyLabel,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import { getQuickActionCategory } from "@/lib/requirements/requirementsQuickActionPolicy";

export type IntentType =
  | "orchestration_action"
  | "artifact_action"
  | "view_action"
  | "edit_request"
  | "question"
  | "unknown";

export type IntentRoutingResult = Readonly<{
  readonly intentType: IntentType;
  readonly suggestedActionId: QuickActionId | null;
  readonly confidence: number;
  readonly reason?: string;
  readonly clarificationQuestion?: string;
  readonly extractedTargets?: Readonly<{
    readonly featureIds?: readonly string[];
    readonly stepIds?: readonly string[];
    readonly actorIds?: readonly string[];
  }>;
}>;

export type RequirementsIntentRouterInput = Readonly<{
  readonly userMessage: string;
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly projection: Pick<
    RequirementsOrchestrationProjection,
    "authoritativeStage" | "quickActions" | "featureDetail" | "conversationState"
  >;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
}>;

const LOW_CONFIDENCE = 0.45;
const HIGH_CONFIDENCE = 0.82;

function normMessage(raw: string): string {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type RuleMatch = Readonly<{
  readonly actionId: QuickActionId;
  readonly confidence: number;
  readonly reason: string;
  readonly intentType?: IntentType;
}>;

const RULES: readonly RuleMatch[] = [
  {
    actionId: "OPEN_ARTIFACT_HUB",
    confidence: 0.88,
    reason: "artifact hub / deliverable view",
    intentType: "view_action",
  },
  {
    actionId: "OPEN_CANVAS",
    confidence: 0.86,
    reason: "canvas / flow view",
    intentType: "view_action",
  },
  {
    actionId: "DEFINE_SCREEN",
    confidence: 0.9,
    reason: "screen definition",
    intentType: "orchestration_action",
  },
  {
    actionId: "DEFINE_API",
    confidence: 0.88,
    reason: "api definition",
    intentType: "orchestration_action",
  },
  {
    actionId: "GENERATE_DOCUMENT",
    confidence: 0.85,
    reason: "document generation",
    intentType: "artifact_action",
  },
  {
    actionId: "EDIT_FEATURES",
    confidence: 0.84,
    reason: "feature edit",
    intentType: "edit_request",
  },
  {
    actionId: "APPROVE_FLOW",
    confidence: 0.9,
    reason: "flow approve",
    intentType: "orchestration_action",
  },
  {
    actionId: "START_FEATURE_DETAIL",
    confidence: 0.82,
    reason: "feature detail start",
    intentType: "orchestration_action",
  },
  {
    actionId: "VIEW_ALTERNATIVE_DETAIL",
    confidence: 0.8,
    reason: "alternative view",
    intentType: "view_action",
  },
  {
    actionId: "GENERATE_ALTERNATIVE",
    confidence: 0.78,
    reason: "alternative generate",
    intentType: "orchestration_action",
  },
];

function matchesRule(msg: string, actionId: QuickActionId): boolean {
  switch (actionId) {
    case "OPEN_ARTIFACT_HUB":
      return /(아티팩트|산출물|허브).*(보|열|확인)|문서.*(보여|확인|열)/.test(msg);
    case "OPEN_CANVAS":
      return /(캔버스|흐름도|다이어그램).*(보|열|확인)|서비스\s*흐름.*(보|확인)/.test(msg);
    case "DEFINE_API":
      return /(api|엔드포인트|연동).*(정의|정리|시작)/.test(msg) && !/나중/.test(msg);
    case "DEFINE_SCREEN":
      return (
        /(화면|스크린|ui|목업).*(정의|보|넘|가|시작|먼저)/.test(msg) ||
        /화면.*(넘|가자)/.test(msg)
      ) && !/api|엔드포인트/.test(msg);
    case "GENERATE_DOCUMENT":
      return /(문서|pdf|마크다운|보내|정리해|만들어)/.test(msg) && !/(보여|확인|열기)/.test(msg);
    case "EDIT_FEATURES":
      return /(기능|업로드|녹취).*(수정|편집|확정|정리)|수정하자|편집하자|기능\s*수정/.test(msg);
    case "APPROVE_FLOW":
      return /(흐름|서비스\s*흐름).*(확정|승인)|흐름\s*확정/.test(msg);
    case "START_FEATURE_DETAIL":
      return /(세부\s*기능|기능\s*정리|기능\s*단위)/.test(msg);
    case "VIEW_ALTERNATIVE_DETAIL":
      return /대안.*(보|상세|확인)/.test(msg);
    case "GENERATE_ALTERNATIVE":
      return /다른\s*대안|대안.*(다시|생성)/.test(msg);
    default:
      return false;
  }
}

function intentTypeForAction(id: QuickActionId): IntentType {
  const cat = getQuickActionCategory(id);
  if (cat === "artifact_action") return "artifact_action";
  if (cat === "view_action") return "view_action";
  if (id === "EDIT_FEATURES" || id === "EDIT_STEPS") return "edit_request";
  return "orchestration_action";
}

export function buildProjectionSummaryForIntentRouter(
  input: RequirementsIntentRouterInput,
): string {
  const m = input.featureMetrics;
  return [
    `stage=${input.authoritativeStage}`,
    `conv=${input.projection.conversationState ?? "none"}`,
    `features=${m.featureCount} confirmed=${m.confirmedFeatureCount} partial=${m.partialFeatureCount} candidate=${m.candidateFeatureCount}`,
    `coverage=${Math.round(m.featureCoverage * 100)}%`,
    `allowedActions=${input.availableActionIds.join(",")}`,
  ].join("; ");
}

export function routeRequirementsIntent(input: RequirementsIntentRouterInput): IntentRoutingResult {
  const msg = normMessage(input.userMessage);
  if (!msg) {
    return {
      intentType: "unknown",
      suggestedActionId: null,
      confidence: 0,
      clarificationQuestion: "무엇을 도와드릴까요?",
    };
  }

  const chipId = resolveQuickActionIdFromLegacyLabel(input.userMessage);
  if (chipId && input.availableActionIds.includes(chipId)) {
    return {
      intentType: intentTypeForAction(chipId),
      suggestedActionId: chipId,
      confidence: 0.95,
      reason: "matched quick action label",
    };
  }

  let best: RuleMatch | null = null;
  for (const rule of RULES) {
    if (!input.availableActionIds.includes(rule.actionId)) continue;
    if (!matchesRule(msg, rule.actionId)) continue;
    if (!best || rule.confidence > best.confidence) best = rule;
  }

  if (best) {
    return {
      intentType: best.intentType ?? intentTypeForAction(best.actionId),
      suggestedActionId: best.actionId,
      confidence: best.confidence,
      reason: best.reason,
    };
  }

  if (
    /(문서|pdf|마크다운|보내|정리해|만들어)/.test(msg) &&
    !/(보여|확인|열기)/.test(msg) &&
    input.availableActionIds.includes("OPEN_ARTIFACT_HUB") &&
    !input.availableActionIds.includes("GENERATE_DOCUMENT")
  ) {
    return {
      intentType: "view_action",
      suggestedActionId: "OPEN_ARTIFACT_HUB",
      confidence: 0.75,
      reason: "document request routed to artifact hub",
      clarificationQuestion: "문서·산출물은 Artifact Hub에서 확인·생성할 수 있습니다.",
    };
  }

  if (/\?|어떤|무엇|선택|알려|가능할까/.test(msg)) {
    return {
      intentType: "question",
      suggestedActionId: null,
      confidence: 0.55,
      reason: "question-like utterance",
      clarificationQuestion: "어떤 작업을 진행할까요? (기능 수정 · 화면 정의 · API 정의 중 선택)",
    };
  }

  if (/수정|편집|바꿔|고쳐/.test(msg)) {
    const editId: QuickActionId = "EDIT_FEATURES";
    if (input.availableActionIds.includes(editId)) {
      return {
        intentType: "edit_request",
        suggestedActionId: editId,
        confidence: 0.52,
        reason: "weak edit heuristic",
        clarificationQuestion: "어떤 기능을 수정할지 선택해 주세요.",
      };
    }
  }

  return {
    intentType: "unknown",
    suggestedActionId: null,
    confidence: 0.2,
    reason: "no rule match",
    clarificationQuestion: "요청을 이해하지 못했습니다. 화면 정의, 기능 수정, 문서 생성 중 무엇을 원하시나요?",
  };
}

export function isLowConfidenceIntent(result: IntentRoutingResult): boolean {
  return result.confidence < LOW_CONFIDENCE || !result.suggestedActionId;
}

export function isHighConfidenceIntent(result: IntentRoutingResult): boolean {
  return Boolean(result.suggestedActionId) && result.confidence >= HIGH_CONFIDENCE;
}

export function intentRouterTimelinePayload(
  intent: IntentRoutingResult,
  guard: { readonly allowed: boolean; readonly reason?: string; readonly warning?: string },
): string {
  return [
    `intentType:${intent.intentType}`,
    intent.suggestedActionId ? `suggestedActionId:${intent.suggestedActionId}` : "",
    `confidence:${intent.confidence.toFixed(2)}`,
    intent.reason ? `intentReason:${intent.reason}` : "",
    `guardAllowed:${guard.allowed}`,
    guard.reason ? `guardReason:${guard.reason}` : "",
    guard.warning ? `guardWarning:${guard.warning}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
