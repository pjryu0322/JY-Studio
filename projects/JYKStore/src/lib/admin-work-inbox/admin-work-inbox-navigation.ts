import type { AdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import {
  adminReviewDetailPath,
  normalizeAdminWorkQueue,
  type AdminWorkQueueKey,
} from "@/lib/routes";
import type { AdminWorkflowStep } from "@/lib/workflow/admin-workflow-steps";

const QUEUE_TO_STEP: Partial<Record<AdminWorkQueueKey, AdminWorkflowStep>> = {
  receipt: "receipt",
  "knowledge-scope": "knowledgeScope",
  generation: "generation",
  correction: "correction",
  "service-validation": "serviceValidation",
  publish: "publish",
};

/**
 * Detail deep-link for an inbox row.
 * Prefer explicit canonical queue scope step; otherwise use Snapshot currentStep.
 * Queue-group / phase switches are not allowed here (P12.1).
 */
export function adminWorkInboxDetailHref(
  item: Pick<AdminWorkInboxItemViewModel, "packId" | "workflow">,
  queueScope: AdminWorkQueueKey | "all" = "all",
): string {
  const base = adminReviewDetailPath(item.packId);
  const scope =
    queueScope === "all" || queueScope === "ops"
      ? queueScope
      : normalizeAdminWorkQueue(queueScope);

  const fromQueue = scope !== "all" && scope !== "ops" ? QUEUE_TO_STEP[scope] : undefined;
  const step = fromQueue ?? item.workflow?.currentStep ?? null;
  if (!step) return base;
  return `${base}?step=${step}`;
}
