/**
 * P12.4 — Pure identity asserts for restore vs new-revision publish paths.
 * Uses publish-recovery resolution facts; no Prisma/IO.
 */

import type { PublishRecoveryResolution } from "@/lib/workflow/publish-recovery";

export type PublishIdentityAssertOk = { ok: true };

export type PublishIdentityAssertFail = {
  ok: false;
  error: "INCOMPLETE";
  message: string;
  code: string;
};

export type PublishIdentityAssertResult =
  | PublishIdentityAssertOk
  | PublishIdentityAssertFail;

/**
 * Restore Existing must resume preserved Production A.
 * Rejects when a material new Draft/Revision (B) is pending.
 */
export function assertRestorePublishedIdentity(
  recovery: PublishRecoveryResolution,
): PublishIdentityAssertResult {
  if (recovery.mode === "PUBLISH_NEW_REVISION") {
    return {
      ok: false,
      error: "INCOMPLETE",
      message: recovery.message,
      code: "NEW_REVISION_PENDING",
    };
  }
  if (!recovery.canRestoreExisting || !recovery.unpublishSnapshot) {
    return {
      ok: false,
      error: "INCOMPLETE",
      message: recovery.message || "기존 게시본을 복구할 수 없습니다.",
      code:
        (recovery.code as
          | "UNPUBLISH_SNAPSHOT_MISSING"
          | "PRESERVED_GENERATION_NOT_ACTIVE"
          | "PROVIDER_SUPPLEMENT_OPEN"
          | "UNRESOLVED_CORRECTION"
          | "PUBLISH_RECOVERY_BLOCKED"
          | "SEARCH_GENERATION_NOT_READY") ?? "PUBLISH_RECOVERY_BLOCKED",
    };
  }
  return { ok: true };
}

/**
 * New Revision publish must promote current Draft B, never restore preserved A.
 */
export function assertPublishNewRevisionIdentity(input: {
  recovery: PublishRecoveryResolution;
  reviewedGenerationId?: string | null;
}): PublishIdentityAssertResult {
  const { recovery, reviewedGenerationId } = input;

  if (recovery.mode === "RESTORE_EXISTING") {
    return {
      ok: false,
      error: "INCOMPLETE",
      message: "새 Draft가 없습니다. 기존 게시본 다시 게시를 사용하세요.",
      code: "RESTORE_EXISTING_AVAILABLE",
    };
  }
  if (recovery.mode !== "PUBLISH_NEW_REVISION" || !recovery.currentDraftGenerationId) {
    return {
      ok: false,
      error: "INCOMPLETE",
      message: recovery.message || "새 Revision 게시 조건을 충족하지 않습니다.",
      code: (recovery.code as string) || "PUBLISH_RECOVERY_BLOCKED",
    };
  }
  if (
    reviewedGenerationId != null &&
    reviewedGenerationId !== recovery.currentDraftGenerationId
  ) {
    return {
      ok: false,
      error: "INCOMPLETE",
      message: "제공자 검토 Revision이 현재 Draft와 일치하지 않습니다.",
      code: "PROVIDER_REVIEW_STALE",
    };
  }
  if (
    recovery.preservedGenerationId &&
    reviewedGenerationId != null &&
    reviewedGenerationId === recovery.preservedGenerationId
  ) {
    return {
      ok: false,
      error: "INCOMPLETE",
      message: "새 Revision Draft가 필요합니다. 기존 게시본 복구를 사용하세요.",
      code: "RESTORE_EXISTING_AVAILABLE",
    };
  }
  return { ok: true };
}
