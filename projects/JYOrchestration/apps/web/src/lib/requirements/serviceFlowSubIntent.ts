/**
 * Project SingleChat — service_flow 내부 sub-intent 및 APPLY_PROPOSAL 과잉 라우팅 guard.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { serviceFlowHasMinimumDraftForApply } from "@/lib/requirements/serviceFlowAdviceApplyMode";
import type { ProjectSingleChatCtaId } from "@/lib/requirements/singleChatStageRouter";
import type { ServiceFlowAnalyzeQualityIssueCode } from "@/lib/requirements/serviceFlowAnalyzeValidation";

export type ServiceFlowSubIntent =
  | "actor_definition"
  | "flow_step_definition"
  | "flow_draft"
  | "flow_review"
  | "flow_apply"
  | "flow_edit"
  | "general_service_flow";

const SUB_INTENTS = new Set<ServiceFlowSubIntent>([
  "actor_definition",
  "flow_step_definition",
  "flow_draft",
  "flow_review",
  "flow_apply",
  "flow_edit",
  "general_service_flow",
]);

export function normalizeServiceFlowSubIntent(raw?: string | null): ServiceFlowSubIntent {
  const v = String(raw ?? "").trim() as ServiceFlowSubIntent;
  return SUB_INTENTS.has(v) ? v : "general_service_flow";
}

/** actor/step/draft/edit — advice mode보다 flow_update(structural) 우선 */
export function isServiceFlowStructuralSubIntent(
  subIntent: ServiceFlowSubIntent | null | undefined,
): boolean {
  return (
    subIntent === "actor_definition" ||
    subIntent === "flow_step_definition" ||
    subIntent === "flow_draft" ||
    subIntent === "flow_edit"
  );
}

export function getServiceFlowSubIntentFromPolicy(responsePolicy: unknown): ServiceFlowSubIntent | null {
  if (!responsePolicy || typeof responsePolicy !== "object") return null;
  const raw = (responsePolicy as { serviceFlowSubIntent?: string }).serviceFlowSubIntent;
  if (!raw) return null;
  return normalizeServiceFlowSubIntent(raw);
}

export function shouldBlockStrongActionForServiceFlowSubIntent(input: {
  readonly suggestedActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: ProjectSingleChatCtaId | null;
}): {
  readonly blocked: boolean;
  readonly reason: string | null;
  readonly downgradedTo: QuickActionId | null;
} {
  const sub = normalizeServiceFlowSubIntent(input.serviceFlowSubIntent);
  const suggested = input.suggestedActionId ?? null;

  if (
    suggested === "GENERATE_ALTERNATIVE" &&
    (sub === "flow_draft" || sub === "flow_step_definition" || sub === "actor_definition")
  ) {
    return {
      blocked: true,
      reason: sub === "flow_draft" ? "flow_draft_is_not_alternative" : `${sub}_is_not_alternative`,
      downgradedTo: "DIRECT_INPUT",
    };
  }

  if (suggested !== "APPLY_PROPOSAL" && suggested !== "APPLY_ALTERNATIVE") {
    return { blocked: false, reason: null, downgradedTo: null };
  }

  const reviewable = serviceFlowHasMinimumDraftForApply(input.currentFlow);

  if (
    (input.directQuickActionId === "APPLY_PROPOSAL" || input.directQuickActionId === "APPLY_ALTERNATIVE") &&
    reviewable
  ) {
    return { blocked: false, reason: null, downgradedTo: null };
  }

  if (sub === "actor_definition") {
    return { blocked: true, reason: "actor_definition_is_not_apply", downgradedTo: "DIRECT_INPUT" };
  }
  if (sub === "flow_step_definition") {
    return { blocked: true, reason: "flow_step_definition_is_not_apply", downgradedTo: "DIRECT_INPUT" };
  }
  if (sub === "flow_draft") {
    return { blocked: true, reason: "flow_draft_is_not_apply", downgradedTo: "DIRECT_INPUT" };
  }

  if (!reviewable) {
    return { blocked: true, reason: "apply_requires_reviewable_flow", downgradedTo: "DIRECT_INPUT" };
  }

  if (sub === "flow_apply" && reviewable) {
    return { blocked: false, reason: null, downgradedTo: null };
  }

  return { blocked: false, reason: null, downgradedTo: null };
}

export function shouldBlockApplyProposalForServiceFlowSubIntent(input: {
  readonly suggestedActionId?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly directQuickActionId?: QuickActionId | null;
  readonly directCtaId?: ProjectSingleChatCtaId | null;
}): { readonly blocked: boolean; readonly reason: string | null } {
  const check = shouldBlockStrongActionForServiceFlowSubIntent(input);
  if (!check.blocked) return { blocked: false, reason: null };
  if (input.suggestedActionId !== "APPLY_PROPOSAL" && input.suggestedActionId !== "APPLY_ALTERNATIVE") {
    return { blocked: false, reason: null };
  }
  return { blocked: true, reason: check.reason };
}

export function formatServiceFlowSubIntentGuardTrace(input: {
  readonly suggested?: QuickActionId | null;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
  readonly reviewable: boolean;
  readonly blocked: boolean;
  readonly downgradedTo?: QuickActionId | null;
  readonly reason?: string | null;
}): string {
  return [
    "[serviceFlowSubIntentGuard]",
    `suggested=${input.suggested ?? ""}`,
    `serviceFlowSubIntent=${input.serviceFlowSubIntent ?? ""}`,
    `reviewable=${String(input.reviewable)}`,
    `blocked=${String(input.blocked)}`,
    `downgradedTo=${input.downgradedTo ?? ""}`,
    `reason=${input.reason ?? ""}`,
  ].join("\n");
}

export function buildServiceFlowActorDefinitionSystemPromptBlock(): string {
  return `[Service-flow Actor Definition Mode]
- 사용자는 서비스 흐름을 만들기 전에 액터부터 정의하라고 요청했다.
- APPLY_PROPOSAL이나 기존 초안 적용으로 처리하지 않는다.
- assistantMessage에는 액터 목록과 각 액터의 책임을 번호 목록/불릿으로 제시한다.
- updatedFlow.actors를 반드시 채운다(최소 2개).
- steps는 아직 확정하지 않아도 되지만, 빈 배열을 유지할 수 있다.
- "정의해 보겠습니다"만 말하지 않는다.
- 마지막에는 "이 액터를 기준으로 서비스 흐름 단계를 정리할 수 있습니다." 정도의 단일 CTA를 둔다.`;
}

export function buildServiceFlowStepDefinitionSystemPromptBlock(): string {
  return `[Service-flow Step Definition Mode]
- 사용자는 액터 또는 현재 아이디어를 기준으로 서비스 흐름 단계를 정의하라고 요청했다.
- actors가 있으면 재사용한다.
- updatedFlow.steps를 최소 3개 이상 생성한다.
- 각 step은 id, title, purpose, order, primaryActorId, secondaryActorIds, approved, updatedAt을 반드시 포함한다.
- purpose 필드를 사용한다. description 필드는 step에 사용하지 않는다.
- primaryActorId는 updatedFlow.actors[].id 중 하나여야 한다.
- assistantMessage의 단계 제목은 updatedFlow.steps[].title과 일치해야 한다.
- assistantMessage에는 "예상 흐름" 번호 목록을 표시한다.
- "정의해 보겠습니다"만 말하지 않는다.`;
}

export function buildServiceFlowDraftSystemPromptBlock(): string {
  return `[Service-flow Draft Mode]
- 사용자는 현재 아이디어와 슬롯을 기준으로 기본 서비스 흐름 초안을 만들라고 요청했다.
- 대안 비교(alternative proposal)가 아니다.
- updatedFlow.actors와 updatedFlow.steps를 반드시 채운다.
- steps는 최소 3개, 권장 4~6개.
- 각 step은 id/title/purpose/order/primaryActorId/secondaryActorIds/approved/updatedAt을 포함한다.
- purpose 필드를 사용한다. step.description을 쓰지 않는다.
- assistantMessage에는 실제 단계 목록(예상 흐름 번호)을 표시한다.
- "기본 운영 흐름이 정리되었습니다"라고 말하려면 updatedFlow.steps가 최소 3개 이상이어야 한다.
- GENERATE_ALTERNATIVE·이 대안 적용·다른 대안 다시 생성 UX를 제안하지 않는다.`;
}

export function buildServiceFlowSubIntentRegenerationUserPayload(input: {
  readonly subIntent: ServiceFlowSubIntent;
  readonly issues: readonly ServiceFlowAnalyzeQualityIssueCode[];
  readonly rejectedAssistantPreview: string;
}): string {
  const issueLines = input.issues.map((c) => `- ${c}`).join("\n");
  const preview = input.rejectedAssistantPreview.slice(0, 600) || "(없음)";

  if (input.subIntent === "actor_definition") {
    return `[Regeneration for actor_definition]
직전 응답은 액터 정의 기준을 충족하지 못했다.

거부 사유:
${issueLines || "- (미상)"}

거부된 assistantMessage 미리보기:
${preview}

필수:
- updatedFlow.actors를 최소 2개 이상 생성하고 assistantMessage에 각 액터의 역할·책임을 번호/불릿으로 제시하라.
- 미래형 선언만 하지 말라.`;
  }

  if (input.subIntent === "flow_step_definition" || input.subIntent === "flow_draft") {
    return `[Regeneration for ${input.subIntent}]
직전 응답은 단계 정의 기준을 충족하지 못했다.

거부 사유:
${issueLines || "- (미상)"}

거부된 assistantMessage 미리보기:
${preview}

필수:
- updatedFlow.steps를 최소 3개 이상 생성하라.
- 각 step은 primaryActorId가 actors에 존재해야 한다.
- assistantMessage에 실제 단계 목록을 표시하라.`;
  }

  return `[Regeneration for service_flow]
거부 사유:
${issueLines || "- (미상)"}

거부된 assistantMessage 미리보기:
${preview}`;
}
