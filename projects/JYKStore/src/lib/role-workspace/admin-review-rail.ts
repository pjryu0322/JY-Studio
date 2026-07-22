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
 * Next CTA after quality / search steps (prompt §7).
 * WARNING alone never blocks progression.
 */
export function getNextReviewAction(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  searchValidationDone: boolean;
  detail: AdminReviewDetailDto | null;
}): NextReviewAction {
  const { workerZipPhase, quality, searchValidationDone, detail } = input;

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
      blockedReasons: quality.blockers.length > 0 ? quality.blockers : ["지식데이터 생성이 실패했습니다."],
    };
  }

  if (
    quality.completed &&
    !quality.hasBlockers &&
    quality.failCount === 0 &&
    !searchValidationDone
  ) {
    return {
      kind: "GO_SEARCH_VALIDATION",
      primaryLabel: "검색데이터 생성 및 검증으로 이동",
      secondaryKind: "RERUN_QUALITY",
      secondaryLabel: "품질 점검 다시 실행",
      message: quality.hasWarnings
        ? "진행 가능: 차단 이슈가 없습니다. WARNING 항목은 승인 전 확인하세요."
        : "진행 가능: 차단 이슈가 없습니다.",
      tone: quality.hasWarnings ? "warning" : "ready",
    };
  }

  if (quality.completed && !quality.hasBlockers && quality.failCount === 0 && searchValidationDone) {
    const canDecide =
      detail != null &&
      (isReviewAccepted(detail) || isPendingAdminReview(detail) || canApproveAdminReview(detail));
    return {
      kind: "GO_FINAL_DECISION",
      primaryLabel: "최종 검수 판단으로 이동",
      secondaryKind: "RERUN_QUALITY",
      secondaryLabel: "품질 점검 다시 실행",
      message: canDecide
        ? "검색데이터 검증을 확인했습니다. 최종 승인·반려를 진행하세요."
        : "검색데이터 검증을 확인했습니다. 최종 검수 판단 단계로 이동하세요.",
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
  const order: AdminReviewWorkflowStep[] = [
    "queue",
    "generation",
    "quality",
    "searchValidation",
    "decision",
    "publish",
    "ops",
  ];
  const stepIdx = order.indexOf(step);
  const currentIdx = order.indexOf(current);
  const doneIdx = completedThrough ? order.indexOf(completedThrough) : -1;

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
  searchValidationDone: boolean;
  detail: AdminReviewDetailDto | null;
  activeStep: AdminReviewWorkflowStep;
}): { items: RoleRailItem[]; currentStep: AdminReviewWorkflowStep } {
  const { packId, workerZipPhase, quality, searchValidationDone, detail, activeStep } = input;
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
  } else if (quality.completed && !searchValidationDone) {
    completedThrough = "quality";
    current = "searchValidation";
  } else if (quality.completed && searchValidationDone) {
    completedThrough = "searchValidation";
    current = "decision";
    if (detail && canApproveAdminReview(detail) === false && isReviewAccepted(detail)) {
      // stay on decision
    }
    if (detail?.pack.status === "PUBLISHED" || detail?.pack.status === "VERIFIED") {
      completedThrough = "decision";
      current = "publish";
    }
  }

  const blockedNext = quality.hasBlockers || quality.failCount > 0 || workerZipPhase === "FAILED";
  const qualityWarning = quality.completed && quality.hasWarnings && !quality.hasBlockers;

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

  // Prefer explicit activeStep for "current" highlight when user navigates.
  const highlight = activeStep;
  const items: RoleRailItem[] = [
    mk("queue", "접수", `${detailPath}?step=queue`),
    mk("generation", "지식데이터 생성", `${detailPath}?step=generation`),
    {
      ...mk("quality", "품질 점검", `${detailPath}?step=quality`),
      badge: qualityWarning ? "WARNING" : undefined,
      status: statusFor("quality", highlight, completedThrough, blockedNext, qualityWarning),
    },
    {
      ...mk("searchValidation", "검색데이터 생성·검증", `${detailPath}?step=searchValidation`),
      status: statusFor("searchValidation", highlight, completedThrough, blockedNext, false),
      blockedReason: blockedNext ? "품질 점검 차단 이슈를 해소한 뒤 진행하세요." : undefined,
    },
    {
      ...mk("decision", "최종 검수 판단", `${detailPath}?step=decision`),
      status: statusFor("decision", highlight, completedThrough, blockedNext, false),
      blockedReason: blockedNext
        ? "품질 점검 차단 이슈를 해소한 뒤 진행하세요."
        : !searchValidationDone
          ? "검색데이터 검증을 먼저 확인하세요."
          : undefined,
    },
    mk("publish", "게시 관리", `${detailPath}?step=publish`),
    {
      id: "ops",
      label: "운영 로그",
      href: ROUTES.adminOps,
      status: "idle",
    },
  ];

  // Fix current highlight to activeStep
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
        const order: AdminReviewWorkflowStep[] = [
          "queue",
          "generation",
          "quality",
          "searchValidation",
          "decision",
          "publish",
        ];
        const doneIdx = completedThrough ? order.indexOf(completedThrough) : -1;
        const idx = order.indexOf(item.id as AdminReviewWorkflowStep);
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
    { id: "queue", label: "접수 대기", href: ROUTES.adminReviews },
    { id: "reviews", label: "검수 대기", href: ROUTES.adminReviews },
    { id: "ops", label: "운영 로그", href: ROUTES.adminOps },
    { id: "home", label: "관리자 홈", href: ROUTES.admin },
  ];
  return items.map((item) => ({
    ...item,
    status: item.id === activeId ? "current" : "idle",
  }));
}
