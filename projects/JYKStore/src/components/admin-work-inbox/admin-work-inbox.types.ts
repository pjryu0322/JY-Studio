import type { AdminWorkInboxQueueGroup } from "@/lib/admin-work-inbox-view-model";
import type { AdminWorkQueueKey } from "@/lib/routes";

export type WorkStatusFilter =
  | "all"
  | "accept"
  | "generate"
  | "quality"
  | "provider_review"
  | "service_validation"
  | "pack_review"
  | "pack_review_in_progress"
  | "returned";

export const FILTER_TO_GROUPS: Record<WorkStatusFilter, AdminWorkInboxQueueGroup[] | null> = {
  all: null,
  accept: ["ACCEPT_REQUIRED"],
  generate: ["GENERATE_REQUIRED"],
  quality: ["GENERATE_REQUIRED"],
  provider_review: ["PROVIDER_REVIEW_IN_PROGRESS"],
  service_validation: ["ADMIN_REVIEW_REQUIRED"],
  pack_review: ["ADMIN_REVIEW_REQUIRED"],
  pack_review_in_progress: ["ADMIN_REVIEW_IN_PROGRESS"],
  returned: ["PROVIDER_SUPPLEMENT_REQUIRED", "RETURNED_OR_REJECTED"],
};

export type AdminWorkInboxPageClientProps = {
  readonly initialStatusFilter?: WorkStatusFilter;
  /** When true, status filter stays fixed at initialStatusFilter (stage rail pages). */
  readonly lockStatusFilter?: boolean;
  /** @deprecated Prefer `?queue=` on `/admin`. */
  readonly queueScope?: AdminWorkQueueKey | "generation";
};

export type AdminWorkInboxCategoryOption = {
  readonly id: string;
  readonly name: string;
};

export type {
  WorkInboxSortKey,
  WorkInboxSortState,
} from "@/lib/admin-work-inbox/admin-work-inbox-format";
