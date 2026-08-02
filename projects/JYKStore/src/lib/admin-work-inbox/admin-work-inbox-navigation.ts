import type { AdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import {
  adminReviewDetailPath,
  normalizeAdminWorkQueue,
  type AdminWorkQueueKey,
} from "@/lib/routes";

/**
 * Detail deep-link for an inbox row: prefer explicit queue scope step,
 * otherwise map `adminQueueGroup` → workflow step query.
 */
export function adminWorkInboxDetailHref(
  item: AdminWorkInboxItemViewModel,
  queueScope: AdminWorkQueueKey | "all" = "all",
): string {
  const base = adminReviewDetailPath(item.packId);
  const scope =
    queueScope === "all" || queueScope === "ops"
      ? queueScope
      : normalizeAdminWorkQueue(queueScope);
  switch (scope) {
    case "receipt":
      return `${base}?step=receipt`;
    case "knowledge-scope":
      return `${base}?step=knowledgeScope`;
    case "generation":
      return `${base}?step=generation`;
    case "correction":
      return `${base}?step=correction`;
    case "service-validation":
      return `${base}?step=serviceValidation`;
    case "publish":
      return `${base}?step=publish`;
    default:
      break;
  }
  switch (item.adminQueueGroup) {
    case "ACCEPT_REQUIRED":
      return `${base}?step=receipt`;
    case "GENERATE_REQUIRED":
      return item.workerZipPhase === "ACCEPTED"
        ? `${base}?step=knowledgeScope`
        : `${base}?step=generation`;
    case "PROVIDER_REVIEW_IN_PROGRESS":
    case "RETURNED_OR_REJECTED":
      return `${base}?step=publish`;
    case "PROVIDER_SUPPLEMENT_REQUIRED":
      return `${base}?step=correction`;
    case "ADMIN_REVIEW_REQUIRED":
      return item.serviceValidationPhase === "PASSED"
        ? `${base}?step=publish`
        : `${base}?step=serviceValidation`;
    case "ADMIN_REVIEW_IN_PROGRESS":
      return `${base}?step=publish`;
    default:
      return base;
  }
}
