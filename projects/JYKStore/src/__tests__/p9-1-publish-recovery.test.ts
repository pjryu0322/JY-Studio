import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  hasMaterialPostUnpublishChange,
  resolvePublishRecoveryMode,
} from "../lib/workflow/publish-recovery.ts";
import {
  ADMIN_REVIEW_CTA_PUBLISH_NEW_REVISION,
  ADMIN_REVIEW_CTA_REJECT,
  ADMIN_REVIEW_CTA_RESTORE_EXISTING,
  ADMIN_REVIEW_CTA_UNPUBLISH,
} from "../lib/role-based-ux-copy.ts";

const root = process.cwd();

describe("P9.1 publish recovery SoT", () => {
  it("separates RESTORE_EXISTING from PUBLISH_NEW_REVISION", () => {
    assert.equal(
      resolvePublishRecoveryMode({
        packStatus: "DRAFT",
        hasUnpublishSnapshot: true,
        preservedProductionValid: true,
        materialChangeAfterUnpublish: false,
        hasCurrentDraftReady: false,
        openSupplement: false,
        openCorrection: false,
      }),
      "RESTORE_EXISTING",
    );
    assert.equal(
      resolvePublishRecoveryMode({
        packStatus: "DRAFT",
        hasUnpublishSnapshot: true,
        preservedProductionValid: true,
        materialChangeAfterUnpublish: true,
        hasCurrentDraftReady: true,
        openSupplement: false,
        openCorrection: false,
      }),
      "PUBLISH_NEW_REVISION",
    );
  });

  it("treats new draft after unpublish as material change", () => {
    assert.equal(
      hasMaterialPostUnpublishChange({
        newDraftReadyGeneration: true,
        newWorkerZipImport: false,
        newProviderReview: false,
        newServiceValidation: false,
        newOpenCorrection: false,
        newOpenSupplement: false,
        draftReadyDiffersFromPreserved: true,
      }),
      true,
    );
  });

  it("restore service rejects Draft B review as evidence for Production A", () => {
    const service = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.match(service, /NEW_REVISION_PENDING/);
    assert.match(service, /RESTORE_EXISTING_AFTER_UNPUBLISH/);
    assert.match(service, /export async function publishNewRevisionAfterUnpublish/);
    assert.match(service, /PUBLISH_NEW_REVISION_AFTER_UNPUBLISH/);
    // Restore must not call assertProviderReviewBindingCurrent
    const restoreFn = service.slice(
      service.indexOf("export async function restorePublishedPackAfterUnpublish"),
      service.indexOf("export async function publishNewRevisionAfterUnpublish"),
    );
    assert.doesNotMatch(restoreFn, /assertProviderReviewBindingCurrent/);
  });

  it("UI CTAs distinguish restore vs new revision vs reject vs unpublish", () => {
    assert.equal(ADMIN_REVIEW_CTA_REJECT, "검수 반려");
    assert.equal(ADMIN_REVIEW_CTA_UNPUBLISH, "게시 중단");
    assert.equal(ADMIN_REVIEW_CTA_RESTORE_EXISTING, "기존 게시본 다시 게시");
    assert.equal(ADMIN_REVIEW_CTA_PUBLISH_NEW_REVISION, "새 Revision 게시");
    const panel = readFileSync(
      join(root, "src/components/AdminApprovalPublishWorkbenchPanel.tsx"),
      "utf8",
    );
    assert.match(panel, /ADMIN_REVIEW_CTA_RESTORE_EXISTING/);
    assert.match(panel, /ADMIN_REVIEW_CTA_PUBLISH_NEW_REVISION/);
    assert.match(panel, /fetchPublishRecoveryAdminReview/);
    assert.doesNotMatch(panel, />재게시</);
  });

  it("routes exist for restore, publish-new-revision, and publish-recovery", () => {
    assert.match(
      readFileSync(
        join(root, "src/app/api/v1/admin/reviews/[packId]/restore-publish/route.ts"),
        "utf8",
      ),
      /restorePublishedPackAfterUnpublish/,
    );
    assert.match(
      readFileSync(
        join(root, "src/app/api/v1/admin/reviews/[packId]/publish-new-revision/route.ts"),
        "utf8",
      ),
      /publishNewRevisionAfterUnpublish/,
    );
    assert.match(
      readFileSync(
        join(root, "src/app/api/v1/admin/reviews/[packId]/publish-recovery/route.ts"),
        "utf8",
      ),
      /resolvePublishRecoveryForPack/,
    );
  });
});
