/**
 * Presentation-only mapper: PackWorkflowSnapshot → Admin review rail chrome.
 * Judgment for enter/publish eligibility lives in Snapshot builders, not here.
 */
import type { RoleRailItem, RoleRailStepStatus } from "@/lib/role-workspace/types";
import { adminReviewDetailPath } from "@/lib/routes";
import {
  ADMIN_WORKFLOW_STEP_LABELS,
  ADMIN_WORKFLOW_STEP_ORDER,
  type AdminWorkflowStep,
} from "@/lib/workflow/admin-workflow-steps";
import type {
  StepSnapshot,
  WorkflowAction,
  WorkflowStepState,
} from "@/lib/workflow/pack-workflow-facts";
import type { PackWorkflowSnapshot } from "@/lib/workflow/pack-workflow-snapshot";

export type AdminRailPresentationInput = {
  packId: string;
  activeStep: AdminWorkflowStep;
  snapshot: PackWorkflowSnapshot;
};

function stepFromSnapshot(
  snapshot: PackWorkflowSnapshot,
  step: AdminWorkflowStep,
): StepSnapshot {
  switch (step) {
    case "receipt":
      return snapshot.receipt;
    case "knowledgeScope":
      return snapshot.knowledgeScope;
    case "generation":
      return snapshot.generation;
    case "correction":
      return snapshot.correction;
    case "serviceValidation":
      return snapshot.serviceValidation;
    case "publish":
      return snapshot.publish;
    default:
      return snapshot.receipt;
  }
}

function mapStepStateToStatus(
  state: WorkflowStepState,
  step: AdminWorkflowStep,
  activeStep: AdminWorkflowStep,
): RoleRailStepStatus {
  let status: RoleRailStepStatus;
  switch (state) {
    case "NOT_STARTED":
      status = "idle";
      break;
    case "AVAILABLE":
      status = "next";
      break;
    case "IN_PROGRESS":
      status = activeStep === step ? "current" : "next";
      break;
    case "COMPLETED":
      status = "completed";
      break;
    case "WARNING":
      status = "warning";
      break;
    case "BLOCKED":
      status = "blocked";
      break;
    default:
      status = "idle";
  }
  // activeStep is UI chrome only — mark the viewed step as current.
  if (activeStep === step && status !== "blocked" && status !== "warning") {
    status = "current";
  }
  return status;
}

function hasAction(
  actions: readonly WorkflowAction[],
  code: WorkflowAction,
): boolean {
  return actions.includes(code);
}

function hasPublishAction(actions: readonly WorkflowAction[]): boolean {
  return (
    hasAction(actions, "PUBLISH_FIRST_REVISION") ||
    hasAction(actions, "PUBLISH_NEW_REVISION") ||
    hasAction(actions, "RESTORE_EXISTING_REVISION")
  );
}

/**
 * Labels/badges from availableActions + provider-review presentation only.
 * Never re-judges workflow enter/publish gates in this layer.
 */
function badgeForStep(
  step: AdminWorkflowStep,
  stepSnap: StepSnapshot,
  snapshot: PackWorkflowSnapshot,
): string | undefined {
  if (step === "publish") {
    const actions = stepSnap.availableActions.length
      ? stepSnap.availableActions
      : snapshot.availableActions;
    if (hasAction(actions, "REQUEST_PROVIDER_REVIEW")) {
      return "제공자 검토 요청";
    }
    if (
      snapshot.blockingReasons.some(
        (r) =>
          r.step === "providerReview" || r.code === "PROVIDER_REVIEW_REQUIRED",
      )
    ) {
      return "제공자 검토 대기";
    }
    if (hasPublishAction(actions) || hasPublishAction(snapshot.availableActions)) {
      return "게시 가능";
    }
  }

  if (step === "correction") {
    if (snapshot.blockingReasons.some((r) => r.code === "OPEN_SUPPLEMENT")) {
      return "보완요청";
    }
    if (
      snapshot.blockingReasons.some((r) => r.code === "QUALITY_BLOCKERS") ||
      stepSnap.state === "BLOCKED"
    ) {
      return "차단";
    }
  }

  if (stepSnap.state === "WARNING") {
    return "WARNING";
  }
  return undefined;
}

function blockedReasonForStep(stepSnap: StepSnapshot): string | undefined {
  return stepSnap.blockingReasons[0]?.message;
}

/**
 * Map Snapshot step states → RoleRailItem chrome.
 * currentStep is taken from snapshot.currentStep (not re-derived).
 */
export function presentAdminReviewRail(
  input: AdminRailPresentationInput,
): { items: RoleRailItem[]; currentStep: AdminWorkflowStep } {
  const { packId, activeStep, snapshot } = input;
  const detailPath = adminReviewDetailPath(packId);

  const items: RoleRailItem[] = ADMIN_WORKFLOW_STEP_ORDER.map((step) => {
    const stepSnap = stepFromSnapshot(snapshot, step);
    const status = mapStepStateToStatus(stepSnap.state, step, activeStep);
    const badge = badgeForStep(step, stepSnap, snapshot);
    const blockedReason = blockedReasonForStep(stepSnap);

    return {
      id: step,
      label: ADMIN_WORKFLOW_STEP_LABELS[step],
      href: `${detailPath}?step=${step}`,
      status,
      ...(blockedReason ? { blockedReason } : {}),
      ...(badge ? { badge } : {}),
    };
  });

  return { items, currentStep: snapshot.currentStep };
}
