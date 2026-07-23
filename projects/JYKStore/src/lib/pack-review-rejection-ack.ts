/**
 * Pack-review rejection acknowledgment (stored in PackReview.submitSnapshot).
 * Until the provider acknowledges, the pack stays non-editable even when status is DRAFT.
 */

import { isOpenPackReviewStatus } from "@/lib/pack-review-status";

export const PROVIDER_REJECTION_ACK_AT_KEY = "providerRejectionAcknowledgedAt";
export const PROVIDER_REJECTION_ACK_BY_KEY = "providerRejectionAcknowledgedByUserId";

export function readProviderRejectionAcknowledgedAt(submitSnapshot: unknown): string | null {
  if (!submitSnapshot || typeof submitSnapshot !== "object" || Array.isArray(submitSnapshot)) {
    return null;
  }
  const value = (submitSnapshot as Record<string, unknown>)[PROVIDER_REJECTION_ACK_AT_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isProviderRejectionAcknowledged(submitSnapshot: unknown): boolean {
  return Boolean(readProviderRejectionAcknowledgedAt(submitSnapshot));
}

export function withProviderRejectionAcknowledged(
  submitSnapshot: unknown,
  input: { acknowledgedAt: string; acknowledgedByUserId: string },
): Record<string, unknown> {
  const base =
    submitSnapshot && typeof submitSnapshot === "object" && !Array.isArray(submitSnapshot)
      ? { ...(submitSnapshot as Record<string, unknown>) }
      : {};
  return {
    ...base,
    [PROVIDER_REJECTION_ACK_AT_KEY]: input.acknowledgedAt,
    [PROVIDER_REJECTION_ACK_BY_KEY]: input.acknowledgedByUserId,
  };
}

/**
 * True while admin holds the pack after ZIP 접수: ACCEPTED, PROCESSING, or
 * COMPLETED (still DRAFT in admin queue before PackReview / 반려).
 */
export function isAdminGenerationHoldActive(
  hold: string | null | undefined,
): boolean {
  return hold === "ACCEPTED" || hold === "PROCESSING" || hold === "COMPLETED";
}

/**
 * Provider content editing: DRAFT only, no open PackReview, no admin generation
 * hold, no open provider-review handoff, and rejection must be acknowledged first.
 */
export function isProviderPackContentEditable(input: {
  status: string;
  latestRejectionReason?: string | null;
  latestRejectionAcknowledged?: boolean | null;
  latestReviewStatus?: string | null;
  adminGenerationHold?: string | null;
  providerReviewPhase?: string | null;
}): boolean {
  if (input.status !== "DRAFT") return false;
  if (input.latestReviewStatus && isOpenPackReviewStatus(input.latestReviewStatus)) {
    return false;
  }
  if (isAdminGenerationHoldActive(input.adminGenerationHold)) {
    return false;
  }
  if (
    input.providerReviewPhase === "REQUESTED" ||
    input.providerReviewPhase === "CONFIRMED"
  ) {
    return false;
  }
  if (input.latestRejectionReason?.trim() && !input.latestRejectionAcknowledged) {
    return false;
  }
  return true;
}
