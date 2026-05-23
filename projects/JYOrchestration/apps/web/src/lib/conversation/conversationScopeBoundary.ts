/**
 * Pre-Project messenger vs Project SingleChat execution boundary.
 *
 * Pre-Project: brainstorming, summary, project creation prep (text only).
 * Project SingleChat: service-flow analyze, strong actions, advice mode, alternative viewer.
 */

import type { ConversationScope } from "@/lib/conversation-core/conversationIntentTypes";

export type ConversationExecutionScope = "pre_project" | "project_single_chat";

const MIN_SANITIZED_PRE_PROJECT_RESPONSE_CHARS = 60;

export const PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT = `[Scope: Pre-Project]
이 대화방은 프로젝트 생성 전 브레인스토밍 공간입니다.
service-flow analyze, 대안 비교 Viewer, 추천안 적용, 단계 전환, flow update를 실행하지 않습니다.
사용자가 절차·흐름·검수·대안을 묻더라도 텍스트 제안으로 답합니다.
GENERATE_ALTERNATIVE, APPLY_PROPOSAL, APPROVE_FLOW, NEXT_STAGE 같은 Project SingleChat 실행 액션을 사용하지 않습니다.
프로젝트 생성 후 SingleChat에서 구체화할 수 있음을 안내할 수는 있으나, 「다음에 제가…」 같은 예고성 반복 문구는 금지합니다.`;

export type PreProjectContaminationSanitizeResult = Readonly<{
  readonly contaminated: boolean;
  readonly reason: string | null;
  readonly text: string;
  readonly removedMarkers: readonly string[];
}>;

/** Pre-Project 응답에 Project SingleChat 실행 메타가 누출됐는지 (scope contamination guard, 의도 라우팅 아님). */
const PRE_PROJECT_FORBIDDEN_EXECUTION_MARKERS: readonly {
  readonly id: string;
  readonly pattern: RegExp;
}[] = [
  { id: "proposal_decision", pattern: /\[ProposalDecision\]/i },
  { id: "generate_alternative", pattern: /\bGENERATE_ALTERNATIVE\b/ },
  { id: "apply_proposal", pattern: /\bAPPLY_PROPOSAL\b/ },
  { id: "approve_flow", pattern: /\bAPPROVE_FLOW\b/ },
  { id: "next_stage", pattern: /\bNEXT_STAGE\b/ },
  { id: "alternative_viewer", pattern: /대안\s*비교\s*Viewer/i },
  { id: "open_alternative_canvas", pattern: /openAlternativeCanvas/i },
  { id: "service_flow_analyze", pattern: /service-flow\s*analyze/i },
  { id: "service_flow_response_mode_advice", pattern: /serviceFlowResponseMode\s*=\s*advice/i },
  { id: "apply_proposal_ko", pattern: /추천안\s*적용/ },
  { id: "partial_edit_ko", pattern: /일부\s*수정/ },
  { id: "show_other_alternative_ko", pattern: /다른\s*대안\s*보기/ },
];

function globalMarkerRegExp(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function markerPatternMatches(text: string, pattern: RegExp): boolean {
  return globalMarkerRegExp(pattern).test(text);
}

function collectMatchingMarkerIds(text: string): readonly string[] {
  const t = String(text ?? "");
  if (!t.trim()) return [];
  const ids: string[] = [];
  for (const marker of PRE_PROJECT_FORBIDDEN_EXECUTION_MARKERS) {
    if (markerPatternMatches(t, marker.pattern)) ids.push(marker.id);
  }
  return ids;
}

function removeForbiddenMarkersFromText(text: string): { readonly cleaned: string; readonly removedIds: readonly string[] } {
  const removedIds: string[] = [];
  let cleaned = String(text ?? "");
  for (const marker of PRE_PROJECT_FORBIDDEN_EXECUTION_MARKERS) {
    if (!markerPatternMatches(cleaned, marker.pattern)) continue;
    removedIds.push(marker.id);
    cleaned = cleaned.replace(globalMarkerRegExp(marker.pattern), "");
  }
  cleaned = cleaned
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { cleaned, removedIds: [...new Set(removedIds)] };
}

export function buildPreProjectContaminationSafeFallback(fallbackUserMessage?: string | null): string {
  const userHint = String(fallbackUserMessage ?? "").trim().slice(0, 120);
  const lines = [
    "요청하신 내용은 프로젝트 생성 전 단계에서는 실행 액션이 아니라 기획 의견으로만 정리하겠습니다.",
    "",
    "현재 아이디어 기준으로는 다음처럼 접근할 수 있습니다.",
    "",
    "- 사용자가 원하는 절차나 대안의 목적을 먼저 정리합니다.",
    "- 프로젝트 생성 후 SingleChat에서 서비스 흐름·검수 단계·대안 비교를 구체화할 수 있습니다.",
    "- 지금 단계에서는 실행이나 적용 없이 텍스트 초안으로만 정리합니다.",
  ];
  if (userHint) {
    lines.splice(2, 0, "", `요청 요약: ${userHint}`);
  }
  return lines.join("\n");
}

export function sanitizePreProjectContaminatedResponse(input: {
  readonly text: string;
  readonly fallbackUserMessage?: string | null;
}): PreProjectContaminationSanitizeResult {
  const original = String(input.text ?? "").trim();
  if (!original) {
    return { contaminated: false, reason: null, text: original, removedMarkers: [] };
  }

  const matchedIds = collectMatchingMarkerIds(original);
  if (matchedIds.length === 0) {
    return { contaminated: false, reason: null, text: original, removedMarkers: [] };
  }

  const reason = preProjectScopeContaminationReason(original);
  const { cleaned, removedIds } = removeForbiddenMarkersFromText(original);
  const stillUnsafe =
    cleaned.length < MIN_SANITIZED_PRE_PROJECT_RESPONSE_CHARS ||
    containsPreProjectForbiddenExecutionMarkers(cleaned);

  const text = stillUnsafe ? buildPreProjectContaminationSafeFallback(input.fallbackUserMessage) : cleaned;

  return {
    contaminated: true,
    reason,
    text,
    removedMarkers: removedIds.length ? removedIds : matchedIds,
  };
}

export function formatPreProjectContaminationGuardTrace(
  contamination: PreProjectContaminationSanitizeResult,
): string {
  if (!contamination.contaminated) return "";
  return [
    "",
    "---",
    "",
    "[preProjectContaminationGuard]",
    "contaminated=true",
    `reason=${contamination.reason ?? ""}`,
    `removedMarkers=${contamination.removedMarkers.join(",")}`,
  ].join("\n");
}

export function conversationScopeFromProjectId(projectId?: string | null): ConversationExecutionScope {
  return String(projectId ?? "").trim() ? "project_single_chat" : "pre_project";
}

export function conversationScopeFromConversationScope(scope: ConversationScope): ConversationExecutionScope {
  return scope === "pre_project" ? "pre_project" : "project_single_chat";
}

export function isPreProjectScope(scope: ConversationExecutionScope | string | null | undefined): boolean {
  return scope === "pre_project";
}

export function isProjectSingleChatScope(scope: ConversationExecutionScope | string | null | undefined): boolean {
  return scope === "project_single_chat";
}

export function canUseProjectExecutionActions(scope: ConversationExecutionScope): boolean {
  return scope === "project_single_chat";
}

export function canUseServiceFlowAnalyze(scope: ConversationExecutionScope): boolean {
  return scope === "project_single_chat";
}

export function canOpenAlternativeViewer(scope: ConversationExecutionScope): boolean {
  return scope === "project_single_chat";
}

export function shouldApplyStrongActionGuard(scope: ConversationExecutionScope): boolean {
  return scope === "project_single_chat";
}

export function containsPreProjectForbiddenExecutionMarkers(text: string): boolean {
  return collectMatchingMarkerIds(text).length > 0;
}

export function preProjectScopeContaminationReason(text: string): string | null {
  if (!containsPreProjectForbiddenExecutionMarkers(text)) return null;
  return "Pre-Project 응답에 Project SingleChat 실행 메타가 포함되어 있습니다.";
}

/** service-flow-analyze API에 Pre-Project/messenger 화면 키가 넘어오면 거부 */
export function isPreProjectWorkspaceScreenKey(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "pre_project" || s === "messenger" || s.startsWith("messenger_");
}
