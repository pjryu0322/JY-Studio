import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  canApproveAdminReview,
  collectReviewBlockers,
  collectReviewWarnings,
} from "@/lib/admin-review-decision";
import { isReviewAccepted, isPendingAdminReview } from "@/lib/admin-review-tabs";
import type {
  NextReviewAction,
  RoleRailItem,
} from "@/lib/role-workspace/types";
import { ROUTES, adminQueuePath, adminReviewDetailPath } from "@/lib/routes";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import type {
  StoreProviderReviewPhase,
  StoreServiceValidationPhase,
} from "@/lib/store-workflow-status";

export type AdminWorkerZipPhase =
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type AdminReviewWorkflowStep =
  | "queue"
  | "generation"
  | "quality"
  | "correction"
  | "providerConfirm"
  | "searchValidation"
  | "decision"
  | "publish"
  | "ops";

export type AdminQualityGateSnapshot = {
  completed: boolean;
  failCount: number;
  hasBlockers: boolean;
  hasWarnings: boolean;
  blockers: string[];
  warnings: string[];
};

const STEP_ORDER: AdminReviewWorkflowStep[] = [
  "queue",
  "generation",
  "quality",
  "correction",
  "providerConfirm",
  "searchValidation",
  "decision",
  "publish",
  "ops",
];

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
 * Next CTA after quality / provider confirm / service validation.
 * WARNING alone never blocks progression.
 */
export function getNextReviewAction(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  /** @deprecated prefer serviceValidationPhase === "PASSED" */
  searchValidationDone?: boolean;
  detail: AdminReviewDetailDto | null;
}): NextReviewAction {
  const {
    workerZipPhase,
    quality,
    providerReviewPhase,
    serviceValidationPhase,
    detail,
  } = input;
  const serviceDone =
    serviceValidationPhase === "PASSED" || Boolean(input.searchValidationDone);

  if (workerZipPhase === "PROCESSING") {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "지식데이터 생성이 진행 중입니다.",
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

  if (
    quality.completed &&
    !quality.hasBlockers &&
    quality.failCount === 0 &&
    providerReviewPhase === "NONE" &&
    workerZipPhase === "COMPLETED"
  ) {
    return {
      kind: "REQUEST_PROVIDER_REVIEW",
      primaryLabel: "제공자 확인 요청",
      secondaryKind: "RERUN_QUALITY",
      secondaryLabel: "품질 점검 다시 실행",
      message: quality.hasWarnings
        ? "품질점검 통과: 제공자에게 생성 결과 검토를 요청하세요. WARNING은 승인 전 확인하세요."
        : "품질점검 통과: 제공자에게 생성 결과 검토를 요청하세요.",
      tone: quality.hasWarnings ? "warning" : "ready",
    };
  }

  if (
    quality.completed &&
    !quality.hasBlockers &&
    quality.failCount === 0 &&
    providerReviewPhase === "NONE" &&
    workerZipPhase !== "COMPLETED"
  ) {
    return {
      kind: "NONE",
      primaryLabel: "",
      message:
        workerZipPhase === "ACCEPTED"
          ? "지식데이터 생성이 완료된 뒤에 제공자 확인을 요청할 수 있습니다."
          : "지식데이터 생성이 완료되지 않아 제공자 확인을 요청할 수 없습니다.",
      tone: "ready",
    };
  }

  if (providerReviewPhase === "REQUESTED") {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "제공자 확인 대기 중입니다. 제공자가 확인 완료하면 서비스 검증을 진행하세요.",
      tone: "ready",
    };
  }

  if (providerReviewPhase === "CONFIRMED" && !serviceDone) {
    return {
      kind: "GO_SEARCH_VALIDATION",
      primaryLabel: "서비스 검증으로 이동",
      secondaryKind: "RERUN_QUALITY",
      secondaryLabel: "품질 점검 다시 실행",
      message: "제공자 확인이 완료되었습니다. API·MCP·Export 서비스 검증을 진행하세요.",
      tone: "ready",
    };
  }

  if (providerReviewPhase === "CONFIRMED" && serviceDone) {
    const canDecide =
      detail != null &&
      (isReviewAccepted(detail) || isPendingAdminReview(detail) || canApproveAdminReview(detail));
    return {
      kind: "GO_FINAL_DECISION",
      primaryLabel: "최종 검수 판단으로 이동",
      secondaryKind: "RERUN_QUALITY",
      secondaryLabel: "품질 점검 다시 실행",
      message: canDecide
        ? "서비스 검증을 확인했습니다. 최종 승인·반려를 진행하세요."
        : "서비스 검증을 확인했습니다. 최종 검수 판단 단계로 이동하세요.",
      tone: quality.hasWarnings ? "warning" : "ready",
    };
  }

  if (workerZipPhase === "COMPLETED" && !quality.completed) {
    return {
      kind: "NONE",
      primaryLabel: "",
      message: "지식데이터 생성이 완료되었습니다. 품질 점검을 실행하세요.",
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

export function getAdminReviewRailState(input: {
  packId: string;
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  /** Open provider supplement phases block service validation. */
  providerSupplementPhase?: string | null;
  /** @deprecated prefer serviceValidationPhase */
  searchValidationDone?: boolean;
  detail: AdminReviewDetailDto | null;
  activeStep: AdminReviewWorkflowStep;
}): { items: RoleRailItem[]; currentStep: AdminReviewWorkflowStep } {
  const {
    packId,
    workerZipPhase,
    quality,
    providerReviewPhase,
    serviceValidationPhase,
    detail,
    activeStep,
  } = input;
  const serviceDone =
    serviceValidationPhase === "PASSED" || Boolean(input.searchValidationDone);
  const detailPath = adminReviewDetailPath(packId);
  const openSupplement = isOpenProviderSupplementPhase(
    input.providerSupplementPhase ?? "NONE",
  );

  let completedThrough: AdminReviewWorkflowStep | null = null;
  let current: AdminReviewWorkflowStep = "queue";

  if (workerZipPhase === "NONE" || workerZipPhase === "REQUESTED") {
    current = "queue";
  } else if (workerZipPhase === "ACCEPTED" || workerZipPhase === "PROCESSING") {
    completedThrough = "queue";
    current = "generation";
  } else if (workerZipPhase === "FAILED") {
    completedThrough = "queue";
    current = "generation";
  } else if (workerZipPhase === "COMPLETED" && !quality.completed) {
    completedThrough = "generation";
    current = "quality";
  } else if (quality.completed && (quality.hasBlockers || quality.failCount > 0)) {
    completedThrough = "quality";
    current = "correction";
  } else if (quality.completed && quality.hasWarnings && providerReviewPhase === "NONE") {
    completedThrough = "quality";
    current = "correction";
  } else if (openSupplement) {
    completedThrough = "correction";
    current = "providerConfirm";
  } else if (
    quality.completed &&
    workerZipPhase === "COMPLETED" &&
    providerReviewPhase === "NONE"
  ) {
    completedThrough = "correction";
    current = "providerConfirm";
  } else if (quality.completed && providerReviewPhase === "NONE") {
    completedThrough = "generation";
    current = "quality";
  } else if (providerReviewPhase === "REQUESTED" || providerReviewPhase === "WITHDRAWN") {
    completedThrough = "correction";
    current = "providerConfirm";
  } else if (providerReviewPhase === "CONFIRMED" && !serviceDone) {
    completedThrough = "providerConfirm";
    current = "searchValidation";
  } else if (providerReviewPhase === "CONFIRMED" && serviceDone) {
    completedThrough = "searchValidation";
    current = "decision";
    if (detail?.pack.status === "PUBLISHED" || detail?.pack.status === "VERIFIED") {
      completedThrough = "decision";
      current = "publish";
    }
  }

  const blockedNext = quality.hasBlockers || quality.failCount > 0 || workerZipPhase === "FAILED";
  const qualityWarning = quality.completed && quality.hasWarnings && !quality.hasBlockers;
  const providerWaiting = providerReviewPhase === "REQUESTED";
  const providerSupplementAttention = openSupplement;

  const foldStageStatus = (
    members: readonly AdminReviewWorkflowStep[],
    warning = false,
  ): RoleRailItem["status"] => {
    // Only the stage matching activeStep is "current" — avoids dual current when
    // the user deep-links to a different step than workflow progress.
    if (members.includes(activeStep)) {
      return warning ? "warning" : "current";
    }
    if (members.includes(current)) {
      return warning ? "warning" : "next";
    }
    const memberMax = Math.max(...members.map((m) => STEP_ORDER.indexOf(m)));
    const memberMin = Math.min(...members.map((m) => STEP_ORDER.indexOf(m)));
    const doneIdx = completedThrough ? STEP_ORDER.indexOf(completedThrough) : -1;
    if (doneIdx >= memberMax) return warning ? "warning" : "completed";
    if (blockedNext && doneIdx >= 0 && memberMin > doneIdx) return "blocked";
    return "idle";
  };

  const decisionPublishMembers = ["decision", "publish"] as const satisfies readonly AdminReviewWorkflowStep[];

  /** Visible workbench rail — generation / quality / correction are independent stages. */
  const items: RoleRailItem[] = [
    {
      id: "queue",
      label: "자료 접수",
      href: `${detailPath}?step=queue`,
      status: foldStageStatus(["queue"]),
    },
    {
      id: "generation",
      label: "생성",
      href: `${detailPath}?step=generation`,
      status: foldStageStatus(["generation"]),
      blockedReason:
        foldStageStatus(["generation"]) === "blocked"
          ? "자료 접수를 먼저 완료하세요."
          : undefined,
    },
    {
      id: "quality",
      label: "점검",
      href: `${detailPath}?step=quality`,
      status: foldStageStatus(["quality"], qualityWarning),
      badge: qualityWarning ? "WARNING" : undefined,
      blockedReason:
        workerZipPhase !== "COMPLETED"
          ? "지식데이터 생성을 먼저 완료하세요."
          : undefined,
    },
    {
      id: "correction",
      label: "보정",
      href: `${detailPath}?step=correction`,
      status: foldStageStatus(["correction"], qualityWarning || blockedNext),
      badge: blockedNext ? "차단" : qualityWarning ? "WARNING" : undefined,
      blockedReason: undefined,
    },
    {
      id: "providerConfirm",
      label: providerSupplementAttention
        ? "제공자 보완요청"
        : providerWaiting
          ? "제공자 검토 대기"
          : "제공자 검토",
      href: `${detailPath}?step=providerConfirm`,
      status:
        !quality.completed || blockedNext
          ? "blocked"
          : foldStageStatus(["providerConfirm"], providerSupplementAttention),
      badge: providerSupplementAttention ? "보완요청" : undefined,
      blockedReason:
        !quality.completed || blockedNext
          ? "품질 점검·보정을 먼저 통과하세요."
          : undefined,
    },
    {
      id: "searchValidation",
      label: "서비스 검증",
      href: `${detailPath}?step=searchValidation`,
      status:
        providerReviewPhase !== "CONFIRMED" || openSupplement
          ? "blocked"
          : foldStageStatus(["searchValidation"]),
      blockedReason: openSupplement
        ? "제공자 보완요청을 먼저 처리하세요."
        : providerReviewPhase !== "CONFIRMED"
          ? "제공자 확인 완료 후에만 서비스 검증을 진행할 수 있습니다."
          : blockedNext
            ? "품질 점검 차단 이슈를 해소한 뒤 진행하세요."
            : undefined,
    },
    {
      id: "decision",
      label: "승인·게시",
      href:
        activeStep === "publish"
          ? `${detailPath}?step=publish`
          : `${detailPath}?step=decision`,
      status:
        providerReviewPhase !== "CONFIRMED" || !serviceDone || openSupplement
          ? "blocked"
          : foldStageStatus(decisionPublishMembers),
      blockedReason: openSupplement
        ? "제공자 보완요청을 먼저 처리하세요."
        : blockedNext
        ? "품질 점검 차단 이슈를 해소한 뒤 진행하세요."
        : providerReviewPhase !== "CONFIRMED"
          ? "제공자 검토를 먼저 완료하세요."
          : !serviceDone
            ? "서비스 검증을 먼저 완료하세요."
            : undefined,
    },
    {
      id: "ops",
      label: "공개/운영",
      href: ROUTES.adminOps,
      status: "idle",
    },
  ];

  return {
    items,
    currentStep: current,
  };
}

/**
 * Internal step ids still accepted via `?step=` (aliased into the display rail).
 * Kept for deep-link / test compatibility — do not remove without a migration.
 */
export const ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS = [
  "queue",
  "generation",
  "quality",
  "correction",
  "providerConfirm",
  "searchValidation",
  "decision",
  "publish",
] as const;

/** Admin console / left-rail stage queue links (list pages). */
export function getAdminConsoleRailItems(activeId: string): RoleRailItem[] {
  const items: Array<{ id: string; label: string; href: string }> = [
    { id: "home", label: "지식데이터 접수", href: adminQueuePath("accept") },
    { id: "generation", label: "지식데이터 생성", href: adminQueuePath("generation") },
    { id: "quality", label: "점검", href: adminQueuePath("quality") },
    { id: "correction", label: "보정", href: adminQueuePath("correction") },
    {
      id: "provider-review",
      label: "제공자 검토",
      href: adminQueuePath("provider-review"),
    },
    {
      id: "service-validation",
      label: "서비스 검증",
      href: adminQueuePath("service-validation"),
    },
    {
      id: "approval-publish",
      label: "승인·게시",
      href: adminQueuePath("approval-publish"),
    },
    { id: "ops", label: "공개/운영", href: ROUTES.adminOps },
  ];
  return items.map((item) => ({
    ...item,
    status: item.id === activeId ? "current" : "idle",
  }));
}
