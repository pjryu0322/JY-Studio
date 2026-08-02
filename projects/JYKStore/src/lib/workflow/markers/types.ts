/**
 * Shared types for Store workflow markers modules.
 */
import type { prisma } from "@/lib/prisma";
import type {
  StoreProviderReviewPhase,
  StoreServiceValidationPhase,
} from "@/lib/store-workflow-status";
import type { ProviderChangesRequestPayload } from "@/lib/provider-review-workbench";
import type {
  ProviderSupplementAdminPhase,
  ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";

export type PrismaClientLike = typeof prisma;

export type StoreWorkflowMarkerSnapshot = {
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  providerReviewRequestedAt: string | null;
  providerReviewConfirmedAt: string | null;
  serviceValidationPassedAt: string | null;
  /** Raw PipelineRun.summary for the latest provider-review marker. */
  providerReviewSummary: string | null;
  /** Parsed 보완요청 payload when the latest marker encodes one. */
  providerChangesRequest: ProviderChangesRequestPayload | null;
  /** Latest STORE_PROVIDER_SUPPLEMENT admin-processing phase. */
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  providerSupplement: ProviderSupplementRequestState | null;
  providerSupplementSubmittedAt: string | null;
};

export type AdminProviderReturnedPackListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  withdrawnAt: string;
  packStatus: string;
  providerReviewPhase: "WITHDRAWN" | "NONE" | "REQUESTED" | "CONFIRMED";
  serviceValidationPhase: "NONE" | "PASSED";
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  changesRequest: ProviderChangesRequestPayload | null;
  changeTypeLabel: string | null;
  targetCount: number;
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

export type SupplementActionResult =
  | { ok: true; state: ProviderSupplementRequestState }
  | { ok: false; error: string; message: string };
