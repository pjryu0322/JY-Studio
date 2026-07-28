/**
 * Admin pack-detail rail — consumes P2 Workflow Core (single source of truth).
 * Does not redefine step ids; delegates current-step + gates to `@/lib/workflow`.
 */
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  canApproveAdminReview,
  collectReviewBlockers,
  collectReviewWarnings,
} from "@/lib/admin-review-decision";
import { isReviewAccepted, isPendingAdminReview } from "@/lib/admin-review-tabs";
import type { NextReviewAction, RoleRailItem } from "@/lib/role-workspace/types";
import { ROUTES, adminQueuePath, adminReviewDetailPath } from "@/lib/routes";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import type {
  StoreProviderReviewPhase,
  StoreServiceValidationPhase,
} from "@/lib/store-workflow-status";
import {
  ADMIN_WORKFLOW_STEP_LABELS,
  ADMIN_WORKFLOW_STEP_ORDER,
  canEnterServiceValidation,
  canPublish,
  canRequestProviderReviewAfterServiceValidation,
  describeAdminPublishGatePhase,
  resolveAdminPublishGatePhase,
  resolveAdminWorkflowCurrentStep,
  type AdminQualityGateSnapshot,
  type AdminWorkerZipPhase,
  type AdminWorkflowStep,
} from "@/lib/workflow";

export type { AdminWorkerZipPhase, AdminQualityGateSnapshot };
/** @deprecated Prefer AdminWorkflowStep from `@/lib/workflow`. */
export type AdminReviewWorkflowStep = AdminWorkflowStep;

export {
  resolveAdminWorkflowStepQuery as parseAdminReviewStepQuery,
  type AdminWorkflowStep,
} from "@/lib/workflow";

const STEP_ORDER = ADMIN_WORKFLOW_STEP_ORDER;

export function buildAdminQualityGateSnapshot(
  detail: AdminReviewDetailDto | null,
): AdminQualityGateSnapshot {
  if (!detail) {
    return {
      completed: false,
      failCount: 0,
      hasBlockers: false,
      hasWarnings: false,
      blockers: [],
      warnings: [],
    };
  }
  const blockers = collectReviewBlockers(detail);
  const warnings = collectReviewWarnings(detail);
  const failCount = detail.readiness.sourceValidation.failCount;
  const completed =
    detail.readiness.structureCoverageStatus != null ||
    detail.readiness.chunkQualityStatus != null ||
    detail.readiness.retrievalEvaluationStatus != null ||
    detail.readiness.releaseGateStatus != null ||
    detail.readiness.sourceValidation.passCount +
      detail.readiness.sourceValidation.warningCount +
      detail.readiness.sourceValidation.failCount >
      0;
  const hasWarnings =
    warnings.length > 0 ||
    detail.readiness.knowledgeQualityStatus === "WARNING" ||
    detail.readiness.chunkQualityStatus === "WARNING" ||
    detail.readiness.retrievalEvaluationStatus === "WARNING" ||
    detail.readiness.releaseGateStatus === "WARNING" ||
    detail.readiness.sourceValidation.warningCount > 0;

  return {
    completed,
    failCount,
    hasBlockers: blockers.length > 0 || failCount > 0,
    hasWarnings,
    blockers,
    warnings,
  };
}

/**
 * Next CTA after generation / correction / service validation / publish gate.
 * Provider review is requested only after service validation passes.
 */
export function getNextReviewAction(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  providerSupplementPhase?: string | null;
  detail: AdminReviewDetailDto | null;
}): NextReviewAction {
  const {
    workerZipPhase,
    quality,
    providerReviewPhase,
    serviceValidationPhase,
    detail,
  } = input;
  const openSupplement = isOpenProviderSupplementPhase(
    input.providerSupplementPhase ?? "NONE",
  );
  const serviceDone = serviceValidationPhase === "PASSED";

  if (workerZipPhase === "PROCESSING") {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "지식데이터 생성이 진행 중입니다.",
      tone: "ready",
    };
  }

  if (
    workerZipPhase === "NONE" ||
    workerZipPhase === "REQUESTED" ||
    workerZipPhase === "REJECTED" ||
    workerZipPhase === "ACCEPTED"
  ) {
    return {
      kind: "NONE",
      primaryLabel: "",
      message:
        workerZipPhase === "ACCEPTED"
          ? "지식화 대상 확인 후 지식데이터 생성을 진행하세요."
          : "자료 접수를 먼저 완료하세요.",
      tone: "ready",
    };
  }

  if (workerZipPhase === "FAILED" || (quality.completed && quality.hasBlockers)) {
    return {
      kind: "REGENERATE_KNOWLEDGE",
      primaryLabel: "지식데이터 재생성",
      secondaryKind: "REQUEST_PROVIDER_FIX",
      secondaryLabel: "제공자 보완요청",
      message: "차단 이슈 또는 생성 실패가 있어 다음 단계로 진행할 수 없습니다.",
      tone: "blocked",
      blockedReasons:
        quality.blockers.length > 0 ? quality.blockers : ["지식데이터 생성이 실패했습니다."],
    };
  }

  if (workerZipPhase === "COMPLETED" && !quality.completed) {
    return {
      kind: "RERUN_QUALITY",
      primaryLabel: "품질 결과 확인",
      message: "지식데이터 생성이 완료되었습니다. 생성 결과·자동 품질을 확인하세요.",
      tone: "ready",
    };
  }

  if (
    canEnterServiceValidation({
      workerZipPhase,
      quality,
      openSupplement,
    }) &&
    !serviceDone
  ) {
    return {
      kind: "GO_SERVICE_VALIDATION",
      primaryLabel: "서비스 검증으로 이동",
      secondaryKind: quality.hasWarnings ? "REQUEST_PROVIDER_FIX" : "RERUN_QUALITY",
      secondaryLabel: quality.hasWarnings ? "보정으로 이동" : "품질 결과 다시 보기",
      message: quality.hasWarnings
        ? "생성·품질 확인이 끝났습니다. WARNING은 보정에서 검토할 수 있습니다. 서비스 검증을 진행하세요."
        : "생성·품질 확인이 끝났습니다. API·MCP·Export 서비스 검증을 진행하세요.",
      tone: quality.hasWarnings ? "warning" : "ready",
    };
  }

  if (
    canRequestProviderReviewAfterServiceValidation({
      serviceValidationPhase,
      providerReviewPhase,
      openSupplement,
      workerZipPhase,
      quality,
    })
  ) {
    return {
      kind: "REQUEST_PROVIDER_REVIEW",
      primaryLabel: "제공자 검토 요청",
      message: "서비스 검증이 통과되었습니다. 제공자에게 서비스 결과 검토를 요청하세요.",
      tone: "ready",
    };
  }

  if (providerReviewPhase === "REQUESTED") {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "제공자 검토 대기 중입니다. 승인되면 게시할 수 있습니다.",
      tone: "ready",
    };
  }

  if (
    canPublish({
      serviceValidationPhase,
      providerReviewPhase,
      openSupplement,
    })
  ) {
    const canDecide =
      detail != null &&
      (isReviewAccepted(detail) || isPendingAdminReview(detail) || canApproveAdminReview(detail));
    return {
      kind: "GO_FINAL_DECISION",
      primaryLabel: "게시 단계로 이동",
      message: canDecide
        ? "제공자 승인이 확인되었습니다. 게시(승인)를 진행하세요."
        : "제공자 승인이 확인되었습니다. 게시 단계로 이동하세요.",
      tone: quality.hasWarnings ? "warning" : "ready",
    };
  }

  if (openSupplement) {
    return {
      kind: "REQUEST_PROVIDER_FIX",
      primaryLabel: "보정으로 이동",
      message: "열린 제공자 보완요청이 있습니다. 보정 단계에서 처리하세요.",
      tone: "warning",
    };
  }

  return {
    kind: "NONE",
    primaryLabel: "",
    message: "",
    tone: "ready",
  };
}

export function getAdminReviewRailState(input: {
  packId: string;
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  providerSupplementPhase?: string | null;
  detail: AdminReviewDetailDto | null;
  activeStep: AdminWorkflowStep;
  knowledgeScopeReady?: boolean;
}): { items: RoleRailItem[]; currentStep: AdminWorkflowStep } {
  const {
    packId,
    workerZipPhase,
    quality,
    providerReviewPhase,
    serviceValidationPhase,
    detail,
    activeStep,
  } = input;
  const openSupplement = isOpenProviderSupplementPhase(
    input.providerSupplementPhase ?? "NONE",
  );
  const detailPath = adminReviewDetailPath(packId);

  const current = resolveAdminWorkflowCurrentStep({
    workerZipPhase,
    quality,
    providerReviewPhase,
    serviceValidationPhase,
    providerSupplementPhase: input.providerSupplementPhase,
    packStatus: detail?.pack.status ?? null,
    knowledgeScopeReady: input.knowledgeScopeReady,
  });

  const publishGate = resolveAdminPublishGatePhase({
    serviceValidationPhase,
    providerReviewPhase,
    openSupplement,
    workerZipPhase,
    quality,
    packStatus: detail?.pack.status ?? null,
  });

  const blockedNext =
    quality.hasBlockers || quality.failCount > 0 || workerZipPhase === "FAILED";
  const qualityWarning = quality.completed && quality.hasWarnings && !quality.hasBlockers;
  const currentIdx = STEP_ORDER.indexOf(current);

  const stepStatus = (
    step: AdminWorkflowStep,
    options?: {
      warning?: boolean;
      blocked?: boolean;
      blockedReason?: string;
      badge?: string;
    },
  ): Pick<RoleRailItem, "status" | "blockedReason" | "badge"> => {
    const idx = STEP_ORDER.indexOf(step);
    if (options?.blocked) {
      return {
        status: "blocked",
        blockedReason: options.blockedReason,
        badge: options.badge,
      };
    }
    if (activeStep === step) {
      return {
        status: options?.warning ? "warning" : "current",
        badge: options?.badge ?? (options?.warning ? "WARNING" : undefined),
      };
    }
    if (current === step) {
      return {
        status: options?.warning ? "warning" : "next",
        badge: options?.badge ?? (options?.warning ? "WARNING" : undefined),
      };
    }
    if (idx < currentIdx) {
      return {
        status: options?.warning ? "warning" : "completed",
        badge: options?.badge,
      };
    }
    if (blockedNext && idx > currentIdx) {
      return {
        status: "blocked",
        blockedReason: options?.blockedReason ?? "이전 단계의 차단 이슈를 먼저 해소하세요.",
      };
    }
    return { status: "idle" };
  };

  const publishBadge =
    publishGate === "PROVIDER_REVIEW_REQUESTED"
      ? "제공자 검토 대기"
      : publishGate === "READY_TO_PUBLISH" || publishGate === "PROVIDER_APPROVED"
        ? "게시 가능"
        : publishGate === "READY_FOR_PROVIDER_REVIEW"
          ? "제공자 검토 요청"
          : undefined;

  const publishBlocked =
    !canPublish({
      serviceValidationPhase,
      providerReviewPhase,
      openSupplement,
    }) &&
    activeStep !== "publish" &&
    current !== "publish";

  const items: RoleRailItem[] = [
    {
      id: "receipt",
      label: ADMIN_WORKFLOW_STEP_LABELS.receipt,
      href: `${detailPath}?step=receipt`,
      ...stepStatus("receipt"),
    },
    {
      id: "knowledgeScope",
      label: ADMIN_WORKFLOW_STEP_LABELS.knowledgeScope,
      href: `${detailPath}?step=knowledgeScope`,
      ...stepStatus("knowledgeScope", {
        blocked: !["ACCEPTED", "PROCESSING", "COMPLETED", "FAILED"].includes(workerZipPhase),
        blockedReason: "자료 접수를 먼저 완료하세요.",
      }),
    },
    {
      id: "generation",
      label: ADMIN_WORKFLOW_STEP_LABELS.generation,
      href: `${detailPath}?step=generation`,
      ...stepStatus("generation", {
        warning: qualityWarning && current === "generation",
        blocked: !["ACCEPTED", "PROCESSING", "COMPLETED", "FAILED"].includes(workerZipPhase),
        blockedReason: "지식화 대상 확인·접수를 먼저 완료하세요.",
      }),
    },
    {
      id: "correction",
      label: ADMIN_WORKFLOW_STEP_LABELS.correction,
      href: `${detailPath}?step=correction`,
      ...stepStatus("correction", {
        warning: qualityWarning || openSupplement,
        badge: blockedNext ? "차단" : openSupplement ? "보완요청" : qualityWarning ? "WARNING" : undefined,
      }),
    },
    {
      id: "serviceValidation",
      label: ADMIN_WORKFLOW_STEP_LABELS.serviceValidation,
      href: `${detailPath}?step=serviceValidation`,
      ...stepStatus("serviceValidation", {
        blocked:
          !canEnterServiceValidation({ workerZipPhase, quality, openSupplement }) &&
          serviceValidationPhase !== "PASSED",
        blockedReason: openSupplement
          ? "제공자 보완요청을 먼저 처리하세요."
          : blockedNext
            ? "생성·보정 차단 이슈를 해소한 뒤 진행하세요."
            : "지식데이터 생성을 먼저 완료하세요.",
      }),
    },
    {
      id: "publish",
      label: ADMIN_WORKFLOW_STEP_LABELS.publish,
      href: `${detailPath}?step=publish`,
      ...stepStatus("publish", {
        blocked: publishBlocked && serviceValidationPhase !== "PASSED",
        blockedReason:
          serviceValidationPhase !== "PASSED"
            ? "서비스 검증을 먼저 완료하세요."
            : openSupplement
              ? "제공자 보완요청을 먼저 처리하세요."
              : providerReviewPhase !== "CONFIRMED"
                ? "제공자 승인 후에만 게시할 수 있습니다."
                : undefined,
      }),
      badge: publishBadge,
      // Prefer publish gate description in blockedReason when on publish with waiting state
      ...(activeStep === "publish" || current === "publish"
        ? {
            blockedReason:
              publishGate === "PROVIDER_REVIEW_REQUESTED" ||
              publishGate === "READY_FOR_PROVIDER_REVIEW"
                ? describeAdminPublishGatePhase(publishGate)
                : stepStatus("publish").blockedReason,
          }
        : {}),
    },
  ];

  return { items, currentStep: current };
}

/** Canonical detail `?step=` ids (P2). Legacy aliases are resolved by resolveAdminWorkflowStepQuery. */
export const ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS = STEP_ORDER;

/** Admin console / left-rail stage queue links (list pages). */
export function getAdminConsoleRailItems(activeId: string): RoleRailItem[] {
  const items: Array<{ id: string; label: string; href: string }> = [
    { id: "receipt", label: ADMIN_WORKFLOW_STEP_LABELS.receipt, href: adminQueuePath("receipt") },
    {
      id: "knowledge-scope",
      label: ADMIN_WORKFLOW_STEP_LABELS.knowledgeScope,
      href: adminQueuePath("knowledge-scope"),
    },
    {
      id: "generation",
      label: ADMIN_WORKFLOW_STEP_LABELS.generation,
      href: adminQueuePath("generation"),
    },
    {
      id: "correction",
      label: ADMIN_WORKFLOW_STEP_LABELS.correction,
      href: adminQueuePath("correction"),
    },
    {
      id: "service-validation",
      label: ADMIN_WORKFLOW_STEP_LABELS.serviceValidation,
      href: adminQueuePath("service-validation"),
    },
    { id: "publish", label: ADMIN_WORKFLOW_STEP_LABELS.publish, href: adminQueuePath("publish") },
  ];
  return items.map((item) => ({
    ...item,
    status: item.id === activeId ? "current" : "idle",
  }));
}

/** Ops stays outside the pack fabrication workflow. */
export function getAdminOpsNavItem(): RoleRailItem {
  return {
    id: "ops",
    label: "공개/운영",
    href: ROUTES.adminOps,
    status: "idle",
  };
}
