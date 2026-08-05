/**
 * Admin pack-detail rail — consumes P2 Workflow Core (single source of truth).
 * Rail item status comes from PackWorkflowSnapshot via presentAdminReviewRail.
 */
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  canApproveAdminReview,
  collectReviewBlockers,
  collectReviewWarnings,
} from "@/lib/admin-review-decision";
import { isReviewAccepted, isPendingAdminReview } from "@/lib/admin-review-tabs";
import type { NextReviewAction, RoleRailItem } from "@/lib/role-workspace/types";
import { presentNextAdminAction } from "@/lib/role-workspace/present-next-admin-action";
import { presentAdminReviewRail } from "@/lib/role-workspace/present-admin-review-rail";
import { ROUTES, adminQueuePath } from "@/lib/routes";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import type {
  StoreProviderReviewPhase,
  StoreServiceValidationPhase,
} from "@/lib/store-workflow-status";
import {
  ADMIN_WORKFLOW_STEP_LABELS,
  ADMIN_WORKFLOW_STEP_ORDER,
  type AdminQualityGateSnapshot,
  type AdminWorkerZipPhase,
  type AdminWorkflowStep,
} from "@/lib/workflow";
import type { PackWorkflowRuntimeSummary } from "@/lib/workflow/pack-workflow-facts";
import { assemblePackWorkflowFacts } from "@/lib/workflow/pack-workflow-facts-assemble";
import {
  buildPackWorkflowSnapshot,
  type PackWorkflowSnapshot,
} from "@/lib/workflow/pack-workflow-snapshot";

export type { AdminWorkerZipPhase, AdminQualityGateSnapshot };
/** @deprecated Prefer AdminWorkflowStep from `@/lib/workflow`. */
export type AdminReviewWorkflowStep = AdminWorkflowStep;

export {
  resolveAdminWorkflowStepQuery as parseAdminReviewStepQuery,
  type AdminWorkflowStep,
} from "@/lib/workflow";

export { presentAdminReviewRail } from "@/lib/role-workspace/present-admin-review-rail";
export type { AdminRailPresentationInput } from "@/lib/role-workspace/present-admin-review-rail";

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
 * Next CTA chrome after generation / correction / service validation / publish.
 * Presentation SoT only: maps Snapshot/runtime → labels via presentNextAdminAction.
 * Does not call enter/publish gate helpers (judgment stays in Snapshot builders).
 */
export function getNextReviewAction(input: {
  workerZipPhase: AdminWorkerZipPhase;
  quality: AdminQualityGateSnapshot;
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  providerSupplementPhase?: string | null;
  detail: AdminReviewDetailDto | null;
  /** Required Presentation SoT input (Detail always builds Snapshot). */
  snapshot?: PackWorkflowSnapshot | null;
  runtime?: PackWorkflowRuntimeSummary | null;
}): NextReviewAction {
  if (input.snapshot == null && input.runtime == null) {
    throw new Error(
      "getNextReviewAction requires snapshot or runtime (P12.3 Presentation SoT)",
    );
  }
  const canDecide =
    input.detail != null &&
    (isReviewAccepted(input.detail) ||
      isPendingAdminReview(input.detail) ||
      canApproveAdminReview(input.detail));
  return presentNextAdminAction({
    snapshot: input.snapshot,
    runtime: input.runtime,
    hasQualityWarnings: input.quality.hasWarnings,
    qualityBlockerMessages: input.quality.blockers,
    canDecidePublish: canDecide,
  });
}

/**
 * Compatibility wrapper: builds Snapshot from legacy fields when not provided,
 * then delegates to presentAdminReviewRail (no Gate status judgment here).
 */
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
  /** Prefer passing Snapshot from Detail/workbench SoT. */
  snapshot?: PackWorkflowSnapshot;
}): { items: RoleRailItem[]; currentStep: AdminWorkflowStep } {
  const openSupplement = isOpenProviderSupplementPhase(
    input.providerSupplementPhase ?? "NONE",
  );
  const snapshot =
    input.snapshot ??
    buildPackWorkflowSnapshot(
      assemblePackWorkflowFacts({
        packId: input.packId,
        packStatus: input.detail?.pack.status ?? "DRAFT",
        workerZipPhase: input.workerZipPhase,
        // Match legacy gate default: unknown scope readiness → treat as ready.
        knowledgeScopeFinalized: input.knowledgeScopeReady ?? true,
        quality: input.quality,
        openSupplement,
        serviceValidationPhase: input.serviceValidationPhase,
        providerReviewPhase: input.providerReviewPhase,
        invariantMode: "warn",
      }),
    );
  return presentAdminReviewRail({
    packId: input.packId,
    activeStep: input.activeStep,
    snapshot,
  });
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
