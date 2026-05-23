/**
 * Pre-Project messenger vs Project SingleChat execution boundary.
 *
 * Pre-Project: brainstorming, summary, project creation prep (text only).
 * Project SingleChat: service-flow analyze, strong actions, advice mode, alternative viewer.
 */

import type { ConversationScope } from "@/lib/conversation-core/conversationIntentTypes";

export type ConversationExecutionScope = "pre_project" | "project_single_chat";

export const PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT = `[Scope: Pre-Project]
이 대화방은 프로젝트 생성 전 브레인스토밍 공간입니다.
service-flow analyze, 대안 비교 Viewer, 추천안 적용, 단계 전환, flow update를 실행하지 않습니다.
사용자가 절차·흐름·검수·대안을 묻더라도 텍스트 제안으로 답합니다.
GENERATE_ALTERNATIVE, APPLY_PROPOSAL, APPROVE_FLOW, NEXT_STAGE 같은 Project SingleChat 실행 액션을 사용하지 않습니다.
프로젝트 생성 후 SingleChat에서 구체화할 수 있음을 안내할 수는 있으나, 「다음에 제가…」 같은 예고성 반복 문구는 금지합니다.`;

/** Pre-Project 응답에 Project SingleChat 실행 메타가 누출됐는지 (scope contamination guard, 의도 라우팅 아님). */
const PRE_PROJECT_FORBIDDEN_EXECUTION_MARKERS: readonly RegExp[] = [
  /\[ProposalDecision\]/i,
  /\bGENERATE_ALTERNATIVE\b/,
  /\bAPPLY_PROPOSAL\b/,
  /\bAPPROVE_FLOW\b/,
  /\bNEXT_STAGE\b/,
  /대안\s*비교\s*Viewer/i,
  /openAlternativeCanvas/i,
  /service-flow\s*analyze/i,
  /serviceFlowResponseMode\s*=\s*advice/i,
];

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
  const t = String(text ?? "");
  if (!t.trim()) return false;
  return PRE_PROJECT_FORBIDDEN_EXECUTION_MARKERS.some((re) => re.test(t));
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
