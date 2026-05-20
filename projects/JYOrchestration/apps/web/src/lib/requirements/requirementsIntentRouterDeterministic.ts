/**
 * Deterministic Intent Router — label fast-path + regex rules (fallback when LLM unavailable).
 */

import {
  resolveQuickActionIdFromLegacyLabel,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import { getQuickActionCategory } from "@/lib/requirements/requirementsQuickActionPolicy";
import {
  actionIdsForLlmIntentRouter,
  type IntentRoutingResult,
  type IntentType,
  type RequirementsIntentRouterInput,
} from "@/lib/requirements/requirementsIntentRouterTypes";

const LOW_CONFIDENCE = 0.45;

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
  { actionId: "OPEN_ARTIFACT_HUB", confidence: 0.88, reason: "artifact hub view", intentType: "view_action" },
  { actionId: "OPEN_CANVAS", confidence: 0.86, reason: "canvas view", intentType: "view_action" },
  { actionId: "DEFINE_SCREEN", confidence: 0.9, reason: "screen definition", intentType: "orchestration_action" },
  { actionId: "DEFINE_API", confidence: 0.88, reason: "api definition", intentType: "orchestration_action" },
  { actionId: "EDIT_FEATURES", confidence: 0.84, reason: "feature edit", intentType: "edit_request" },
  { actionId: "APPROVE_FLOW", confidence: 0.9, reason: "flow approve", intentType: "orchestration_action" },
  { actionId: "START_FEATURE_DETAIL", confidence: 0.82, reason: "feature detail start", intentType: "orchestration_action" },
  { actionId: "VIEW_ALTERNATIVE_DETAIL", confidence: 0.8, reason: "alternative view", intentType: "view_action" },
  { actionId: "GENERATE_ALTERNATIVE", confidence: 0.78, reason: "alternative generate", intentType: "orchestration_action" },
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
        (/(화면|스크린|ui|목업).*(정의|보|보고|넘|가|시작|먼저)/.test(msg) ||
          /화면.*(넘|가자|보고)/.test(msg) ||
          /먼저.*화면/.test(msg)) &&
        !/api|엔드포인트/.test(msg)
      );
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
  if (cat === "edit_request") return "edit_request";
  return "orchestration_action";
}

export function routeRequirementsIntentDeterministic(
  input: RequirementsIntentRouterInput,
): IntentRoutingResult {
  const pickable = actionIdsForLlmIntentRouter(input.availableActionIds);
  const msg = normMessage(input.userMessage);
  if (!msg) {
    return {
      intentType: "unknown",
      suggestedActionId: null,
      confidence: 0,
      routerMode: "deterministic",
      clarificationQuestion: "무엇을 도와드릴까요?",
    };
  }

  const chipId = resolveQuickActionIdFromLegacyLabel(input.userMessage);
  if (chipId && pickable.includes(chipId)) {
    return {
      intentType: intentTypeForAction(chipId),
      suggestedActionId: chipId,
      confidence: 0.95,
      reason: "matched quick action label",
      routerMode: "deterministic",
    };
  }

  let best: RuleMatch | null = null;
  for (const rule of RULES) {
    if (!pickable.includes(rule.actionId)) continue;
    if (!matchesRule(msg, rule.actionId)) continue;
    if (!best || rule.confidence > best.confidence) best = rule;
  }

  if (best) {
    return {
      intentType: best.intentType ?? intentTypeForAction(best.actionId),
      suggestedActionId: best.actionId,
      confidence: best.confidence,
      reason: best.reason,
      routerMode: "deterministic",
    };
  }

  if (
    /(문서|pdf|마크다운|보내|정리해|만들어|export)/.test(msg) &&
    !/(보여|확인|열기)/.test(msg) &&
    pickable.includes("OPEN_ARTIFACT_HUB")
  ) {
    return {
      intentType: "view_action",
      suggestedActionId: "OPEN_ARTIFACT_HUB",
      confidence: 0.75,
      reason: "document request routed to artifact hub",
      routerMode: "deterministic",
      clarificationQuestion: "문서·산출물은 Artifact Hub에서 확인·생성할 수 있습니다.",
    };
  }

  if (/\?|어떤|무엇|선택|알려|가능할까/.test(msg)) {
    return {
      intentType: "question",
      suggestedActionId: null,
      confidence: 0.55,
      reason: "question-like utterance",
      routerMode: "deterministic",
      clarificationQuestion: "어떤 작업을 진행할까요? (기능 수정 · 화면 정의 · API 정의 중 선택)",
    };
  }

  if (/수정|편집|바꿔|고쳐/.test(msg) && pickable.includes("EDIT_FEATURES")) {
    return {
      intentType: "edit_request",
      suggestedActionId: "EDIT_FEATURES",
      confidence: 0.52,
      reason: "weak edit heuristic",
      routerMode: "deterministic",
      clarificationQuestion: "어떤 기능을 수정할지 선택해 주세요.",
    };
  }

  return {
    intentType: "unknown",
    suggestedActionId: null,
    confidence: 0.2,
    reason: "no deterministic match",
    routerMode: "deterministic",
    clarificationQuestion: "요청을 이해하지 못했습니다. 화면 정의, 기능 수정, Artifact Hub 중 무엇을 원하시나요?",
  };
}

export function isLowConfidenceIntent(result: IntentRoutingResult): boolean {
  return result.confidence < LOW_CONFIDENCE || !result.suggestedActionId;
}
