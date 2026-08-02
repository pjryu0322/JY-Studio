/**
 * P12.4 — Pure publish eligibility checks (no Prisma).
 * Thin wrappers around admin-workflow-gates / open-supplement SoT.
 */

import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import { canPublish } from "@/lib/workflow/admin-workflow-gates";
import type {
  AdminProviderReviewPhase,
  AdminServiceValidationPhase,
} from "@/lib/workflow/admin-workflow-state";

export { canPublish, isOpenProviderSupplementPhase };

/** Open provider-supplement phases block approve / new-revision publish. */
export function hasOpenPublishBlockingSupplement(
  providerSupplementPhase: string | null | undefined,
): boolean {
  return isOpenProviderSupplementPhase(providerSupplementPhase);
}

export function isEligibleToPublish(input: {
  serviceValidationPhase: AdminServiceValidationPhase;
  providerReviewPhase: AdminProviderReviewPhase;
  openSupplement?: boolean;
  packStatus?: string | null;
}): boolean {
  return canPublish(input);
}

export type PublishEligibilityBlock = {
  error: "INCOMPLETE";
  message: string;
  code:
    | "PROVIDER_SUPPLEMENT_OPEN"
    | "PROVIDER_CONFIRM_REQUIRED"
    | "SERVICE_VALIDATION_REQUIRED"
    | "PUBLISH_GATE_NOT_READY";
};

/**
 * Shared canPublish / open-supplement gate used by first-revision approve
 * and post-unpublish new-revision publish.
 */
export function resolvePublishEligibilityBlock(input: {
  serviceValidationPhase: AdminServiceValidationPhase;
  providerReviewPhase: AdminProviderReviewPhase;
  providerSupplementPhase: string | null | undefined;
  packStatus?: string | null;
  messages?: {
    openSupplement?: string;
    providerConfirm?: string;
    serviceValidation?: string;
    notReady?: string;
  };
}): PublishEligibilityBlock | null {
  const openSupplement = hasOpenPublishBlockingSupplement(input.providerSupplementPhase);
  if (openSupplement) {
    return {
      error: "INCOMPLETE",
      message:
        input.messages?.openSupplement ??
        "제공자 보완요청이 처리되지 않아 승인할 수 없습니다.",
      code: "PROVIDER_SUPPLEMENT_OPEN",
    };
  }
  if (
    !isEligibleToPublish({
      serviceValidationPhase: input.serviceValidationPhase,
      providerReviewPhase: input.providerReviewPhase,
      openSupplement,
      packStatus: input.packStatus,
    })
  ) {
    if (input.providerReviewPhase !== "CONFIRMED") {
      return {
        error: "INCOMPLETE",
        message:
          input.messages?.providerConfirm ??
          "제공자 확인이 완료된 뒤에만 승인할 수 있습니다.",
        code: "PROVIDER_CONFIRM_REQUIRED",
      };
    }
    if (input.serviceValidationPhase !== "PASSED") {
      return {
        error: "INCOMPLETE",
        message:
          input.messages?.serviceValidation ??
          "서비스 검증이 완료된 뒤에만 승인할 수 있습니다.",
        code: "SERVICE_VALIDATION_REQUIRED",
      };
    }
    return {
      error: "INCOMPLETE",
      message: input.messages?.notReady ?? "게시 조건을 충족하지 않습니다.",
      code: "PUBLISH_GATE_NOT_READY",
    };
  }
  return null;
}
