/**
 * Presentation-only mapper: PackWorkflowSnapshot / RuntimeSummary → NextReviewAction labels.
 * Does NOT call canEnter* / canPublish — judgment lives in Snapshot builders.
 */
import type { NextReviewAction } from "@/lib/role-workspace/types";
import type {
  PackWorkflowRuntimeSummary,
  WorkflowAction,
  WorkflowBlockingReason,
} from "@/lib/workflow/pack-workflow-facts";
import type { PackWorkflowSnapshot } from "@/lib/workflow/pack-workflow-snapshot";
import type { AdminWorkflowStep } from "@/lib/workflow/admin-workflow-steps";

function hasAction(
  actions: readonly WorkflowAction[],
  code: WorkflowAction,
): boolean {
  return actions.includes(code);
}

function hasBlockCode(
  reasons: readonly WorkflowBlockingReason[],
  code: string,
): boolean {
  return reasons.some((r) => r.code === code);
}

/**
 * Map Snapshot (or runtime summary) fields to NextReviewAction chrome only.
 */
export function presentNextAdminAction(input: {
  snapshot?: Pick<
    PackWorkflowSnapshot,
    | "currentStep"
    | "availableActions"
    | "blockingReasons"
    | "generation"
    | "correction"
    | "serviceValidation"
    | "publish"
  > | null;
  runtime?: PackWorkflowRuntimeSummary | null;
  /** Presentation copy only — secondary CTA / tone when warnings exist. */
  hasQualityWarnings?: boolean;
  /** Prefer detail blocker messages when present; else Snapshot reason messages. */
  qualityBlockerMessages?: string[];
  /** Presentation nuance for GO_FINAL_DECISION message. */
  canDecidePublish?: boolean;
}): NextReviewAction {
  const availableActions =
    input.snapshot?.availableActions ?? input.runtime?.availableActions ?? [];
  const blockingReasons =
    input.snapshot?.blockingReasons ?? input.runtime?.blockingReasons ?? [];
  const currentStep: AdminWorkflowStep =
    input.snapshot?.currentStep ?? input.runtime?.currentStep ?? "receipt";
  const hasWarnings = Boolean(input.hasQualityWarnings);
  const serviceCompleted =
    input.snapshot?.serviceValidation.state === "COMPLETED";
  const generationInProgress =
    input.snapshot?.generation.state === "IN_PROGRESS";
  const generationCompleted =
    input.snapshot?.generation.state === "COMPLETED";

  if (generationInProgress) {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "지식데이터 생성이 진행 중입니다.",
      tone: "ready",
    };
  }

  if (hasBlockCode(blockingReasons, "QUALITY_BLOCKERS")) {
    const fromSnapshot = blockingReasons
      .filter((r) => r.code === "QUALITY_BLOCKERS")
      .map((r) => r.message);
    return {
      kind: "REGENERATE_KNOWLEDGE",
      primaryLabel: "지식데이터 재생성",
      secondaryKind: "REQUEST_PROVIDER_FIX",
      secondaryLabel: "제공자 보완요청",
      message: "차단 이슈 또는 생성 실패가 있어 다음 단계로 진행할 수 없습니다.",
      tone: "blocked",
      blockedReasons:
        input.qualityBlockerMessages && input.qualityBlockerMessages.length > 0
          ? input.qualityBlockerMessages
          : fromSnapshot.length > 0
            ? fromSnapshot
            : ["지식데이터 생성이 실패했습니다."],
    };
  }

  if (
    generationCompleted &&
    !hasAction(availableActions, "RUN_SERVICE_VALIDATION") &&
    !hasAction(availableActions, "REQUEST_PROVIDER_REVIEW") &&
    !hasAction(availableActions, "OPEN_CORRECTION") &&
    currentStep === "generation"
  ) {
    return {
      kind: "RERUN_QUALITY",
      primaryLabel: "품질 결과 확인",
      message: "지식데이터 생성이 완료되었습니다. 생성 결과·자동 품질을 확인하세요.",
      tone: "ready",
    };
  }

  if (
    hasAction(availableActions, "RUN_SERVICE_VALIDATION") &&
    !serviceCompleted &&
    (input.snapshot != null
      ? true
      : hasBlockCode(blockingReasons, "SERVICE_VALIDATION_REQUIRED") ||
        currentStep === "serviceValidation" ||
        currentStep === "generation" ||
        currentStep === "correction")
  ) {
    // After SV passes, RUN_SERVICE_VALIDATION may still be listed; prefer later actions.
    if (
      !hasAction(availableActions, "REQUEST_PROVIDER_REVIEW") &&
      !hasAction(availableActions, "PUBLISH_FIRST_REVISION") &&
      !hasAction(availableActions, "PUBLISH_NEW_REVISION") &&
      !hasAction(availableActions, "RESTORE_EXISTING_REVISION") &&
      !hasBlockCode(blockingReasons, "PROVIDER_REVIEW_REQUIRED")
    ) {
      return {
        kind: "GO_SERVICE_VALIDATION",
        primaryLabel: "서비스 검증으로 이동",
        secondaryKind: hasWarnings ? "REQUEST_PROVIDER_FIX" : "RERUN_QUALITY",
        secondaryLabel: hasWarnings ? "보정으로 이동" : "품질 결과 다시 보기",
        message: hasWarnings
          ? "생성·품질 확인이 끝났습니다. WARNING은 보정에서 검토할 수 있습니다. 서비스 검증을 진행하세요."
          : "생성·품질 확인이 끝났습니다. API·MCP·Export 서비스 검증을 진행하세요.",
        tone: hasWarnings ? "warning" : "ready",
      };
    }
  }

  if (hasAction(availableActions, "REQUEST_PROVIDER_REVIEW")) {
    return {
      kind: "REQUEST_PROVIDER_REVIEW",
      primaryLabel: "제공자 검토 요청",
      message: "서비스 검증이 통과되었습니다. 제공자에게 서비스 결과 검토를 요청하세요.",
      tone: "ready",
    };
  }

  if (
    hasBlockCode(blockingReasons, "PROVIDER_REVIEW_REQUIRED") &&
    !hasAction(availableActions, "REQUEST_PROVIDER_REVIEW")
  ) {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "제공자 검토 대기 중입니다. 승인되면 게시할 수 있습니다.",
      tone: "ready",
    };
  }

  const publishActionReady =
    hasAction(availableActions, "PUBLISH_FIRST_REVISION") ||
    hasAction(availableActions, "PUBLISH_NEW_REVISION") ||
    hasAction(availableActions, "RESTORE_EXISTING_REVISION");

  // Snapshot may omit PUBLISH_* for DRAFT even when publish step is enterable
  // (canPublish); treat publish currentStep without provider-review block as CTA.
  const publishStepReady =
    currentStep === "publish" &&
    !hasBlockCode(blockingReasons, "PROVIDER_REVIEW_REQUIRED") &&
    !hasBlockCode(blockingReasons, "OPEN_SUPPLEMENT") &&
    (serviceCompleted ||
      input.runtime != null ||
      input.snapshot?.publish.ready === true ||
      input.snapshot?.publish.state === "AVAILABLE" ||
      input.snapshot?.publish.state === "IN_PROGRESS");

  if (publishActionReady || publishStepReady) {
    return {
      kind: "GO_FINAL_DECISION",
      primaryLabel: "게시 단계로 이동",
      message: input.canDecidePublish
        ? "제공자 승인이 확인되었습니다. 게시(승인)를 진행하세요."
        : "제공자 승인이 확인되었습니다. 게시 단계로 이동하세요.",
      tone: hasWarnings ? "warning" : "ready",
    };
  }

  if (hasBlockCode(blockingReasons, "OPEN_SUPPLEMENT")) {
    return {
      kind: "REQUEST_PROVIDER_FIX",
      primaryLabel: "보정으로 이동",
      message: "열린 제공자 보완요청이 있습니다. 보정 단계에서 처리하세요.",
      tone: "warning",
    };
  }

  if (currentStep === "knowledgeScope") {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "지식화 대상 확인 후 지식데이터 생성을 진행하세요.",
      tone: "ready",
    };
  }

  if (currentStep === "receipt") {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "자료 접수를 먼저 완료하세요.",
      tone: "ready",
    };
  }

  return {
    kind: "NONE",
    primaryLabel: "",
    message: "",
    tone: "ready",
  };
}
