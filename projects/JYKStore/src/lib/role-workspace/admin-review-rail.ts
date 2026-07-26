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
  RoleRailStepStatus,
} from "@/lib/role-workspace/types";
import { ROUTES, adminReviewDetailPath } from "@/lib/routes";
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

function statusFor(
  step: AdminReviewWorkflowStep,
  current: AdminReviewWorkflowStep,
  completedThrough: AdminReviewWorkflowStep | null,
  blocked: boolean,
  warning: boolean,
): RoleRailStepStatus {
  const stepIdx = STEP_ORDER.indexOf(step);
  const currentIdx = STEP_ORDER.indexOf(current);
  const doneIdx = completedThrough ? STEP_ORDER.indexOf(completedThrough) : -1;

  if (blocked && stepIdx > currentIdx) return "blocked";
  if (step === current) return warning && step === "quality" ? "warning" : "current";
  if (stepIdx === currentIdx + 1 && !blocked) return "next";
  if (stepIdx <= doneIdx) return warning && step === "quality" ? "warning" : "completed";
  return "idle";
}

export function getAdminReviewRailState(input: {
  packId: string;
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
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
  } else if (quality.completed && quality.hasBlockers) {
    completedThrough = "generation";
    current = "quality";
  } else if (
    quality.completed &&
    workerZipPhase === "COMPLETED" &&
    providerReviewPhase === "NONE"
  ) {
    completedThrough = "quality";
    current = "providerConfirm";
  } else if (quality.completed && providerReviewPhase === "NONE") {
    // Quality may look complete from legacy data, but generation must finish first.
    completedThrough = "generation";
    current = "quality";
  } else if (providerReviewPhase === "REQUESTED") {
    completedThrough = "quality";
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

  const mk = (
    id: AdminReviewWorkflowStep,
    label: string,
    href: string,
    extra?: Partial<RoleRailItem>,
  ): RoleRailItem => ({
    id,
    label,
    href,
    status: statusFor(id, activeStep || current, completedThrough, blockedNext, qualityWarning),
    ...extra,
  });

  const highlight = activeStep;
  const items: RoleRailItem[] = [
    mk("queue", "자료 접수", `${detailPath}?step=queue`),
    mk("generation", "생성·품질보정", `${detailPath}?step=generation`),
    {
      ...mk("quality", "생성·품질보정", `${detailPath}?step=quality`),
      badge: qualityWarning ? "WARNING" : undefined,
      status: statusFor("quality", highlight, completedThrough, blockedNext, qualityWarning),
    },
    {
      ...mk(
        "providerConfirm",
        providerWaiting ? "제공자 검토 대기" : "제공자 검토",
        `${detailPath}?step=providerConfirm`,
      ),
      status: statusFor("providerConfirm", highlight, completedThrough, blockedNext, false),
      blockedReason: !quality.completed || blockedNext
        ? "품질 점검을 먼저 통과하세요."
        : undefined,
    },
    {
      ...mk("searchValidation", "서비스 검증", `${detailPath}?step=searchValidation`),
      status:
        providerReviewPhase !== "CONFIRMED"
          ? ("blocked" as const)
          : statusFor("searchValidation", highlight, completedThrough, blockedNext, false),
      blockedReason:
        providerReviewPhase !== "CONFIRMED"
          ? "제공자 확인 완료 후에만 서비스 검증을 진행할 수 있습니다."
          : blockedNext
            ? "품질 점검 차단 이슈를 해소한 뒤 진행하세요."
            : undefined,
    },
    {
      ...    mk("decision", "승인·게시", `${detailPath}?step=decision`),
      status:
        providerReviewPhase !== "CONFIRMED" || !serviceDone
          ? ("blocked" as const)
          : statusFor("decision", highlight, completedThrough, blockedNext, false),
      blockedReason: blockedNext
        ? "품질 점검 차단 이슈를 해소한 뒤 진행하세요."
        : providerReviewPhase !== "CONFIRMED"
          ? "제공자 검토를 먼저 완료하세요."
          : !serviceDone
            ? "서비스 검증을 먼저 완료하세요."
            : undefined,
    },
    mk("publish", "승인·게시", `${detailPath}?step=publish`),
    {
      id: "ops",
      label: "운영 로그",
      href: ROUTES.adminOps,
      status: "idle",
    },
  ];

  return {
    items: items.map((item) => {
      if (item.id === "ops") return item;
      if (item.id === highlight) {
        return {
          ...item,
          status:
            item.status === "blocked"
              ? "blocked"
              : item.id === "quality" && qualityWarning
                ? "warning"
                : "current",
        };
      }
      if (item.status === "current" && item.id !== highlight) {
        const doneIdx = completedThrough ? STEP_ORDER.indexOf(completedThrough) : -1;
        const idx = STEP_ORDER.indexOf(item.id as AdminReviewWorkflowStep);
        return {
          ...item,
          status: idx <= doneIdx ? (item.badge ? "warning" : "completed") : "idle",
        };
      }
      return item;
    }),
    currentStep: current,
  };
}

/** Static admin console rail (list / ops pages). */
export function getAdminConsoleRailItems(activeId: string): RoleRailItem[] {
  const items: Array<{ id: string; label: string; href: string }> = [
    { id: "home", label: "할 일", href: ROUTES.admin },
    { id: "reviews", label: "검수 대기", href: ROUTES.adminReviews },
    { id: "ops", label: "운영 로그", href: ROUTES.adminOps },
  ];
  return items.map((item) => ({
    ...item,
    status: item.id === activeId ? "current" : "idle",
  }));
}
