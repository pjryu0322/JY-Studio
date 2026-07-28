/**
 * P2 admin workflow steps — canonical order and Korean labels.
 *
 * This module is the single source of truth for the admin-facing workflow
 * rail. Any legacy step identifiers (pre-P2) must be resolved through
 * {@link resolveAdminWorkflowStepQuery} and must never be emitted as a
 * canonical step from normal navigation after P2.
 */
export const ADMIN_WORKFLOW_STEPS = [
  "receipt",
  "knowledgeScope",
  "generation",
  "correction",
  "serviceValidation",
  "publish",
] as const;

export type AdminWorkflowStep = (typeof ADMIN_WORKFLOW_STEPS)[number];

export const ADMIN_WORKFLOW_STEP_LABELS: Record<AdminWorkflowStep, string> = {
  receipt: "자료 접수",
  knowledgeScope: "지식화 대상 확인",
  generation: "지식데이터 생성",
  correction: "보정",
  serviceValidation: "서비스 검증",
  publish: "게시",
};

export const ADMIN_WORKFLOW_STEP_ORDER = ADMIN_WORKFLOW_STEPS;

/** Query ?step= values (canonical). */
export function isAdminWorkflowStep(raw: string | null | undefined): raw is AdminWorkflowStep {
  return ADMIN_WORKFLOW_STEPS.includes(raw as AdminWorkflowStep);
}

/**
 * Map legacy ?step= / deep-links to canonical P2 steps.
 * Old steps must NOT be emitted as normal navigation after P2.
 */
export function resolveAdminWorkflowStepQuery(raw: string | null | undefined): AdminWorkflowStep | null {
  if (!raw) return null;
  if (isAdminWorkflowStep(raw)) return raw;
  switch (raw) {
    case "queue":
      return "receipt";
    case "knowledge-scope":
      return "knowledgeScope";
    case "quality":
      return "generation"; // quality folded into generation
    case "providerConfirm":
      return "publish"; // provider review is publish gate
    case "searchValidation":
    case "service-validation":
      return "serviceValidation";
    case "decision":
      return "publish";
    case "ops":
      return null; // ops is outside workflow — caller should route to /admin/ops
    default:
      return null;
  }
}

export function adminWorkflowStepQueryParam(step: AdminWorkflowStep): string {
  return step;
}

export function adminWorkflowStepIndex(step: AdminWorkflowStep): number {
  return ADMIN_WORKFLOW_STEP_ORDER.indexOf(step);
}
