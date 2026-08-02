import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ADMIN_WORKFLOW_STEPS,
  ADMIN_WORKFLOW_STEP_LABELS,
  resolveAdminWorkflowStepQuery,
} from "../lib/workflow/admin-workflow-steps.ts";
import { canPublish } from "../lib/workflow/admin-workflow-gates.ts";

const root = process.cwd();

describe("P9 workflow SoT / republish / public version policy", () => {
  it("admin rail is exactly the canonical six steps", () => {
    assert.deepEqual([...ADMIN_WORKFLOW_STEPS], [
      "receipt",
      "knowledgeScope",
      "generation",
      "correction",
      "serviceValidation",
      "publish",
    ]);
    assert.equal(ADMIN_WORKFLOW_STEP_LABELS.publish, "게시");
    assert.equal(resolveAdminWorkflowStepQuery("providerConfirm"), "publish");
    assert.equal(resolveAdminWorkflowStepQuery("quality"), "generation");
    assert.equal(resolveAdminWorkflowStepQuery("ops"), null);
  });

  it("provider review remains a publish gate, not a rail step", () => {
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
        openSupplement: false,
      }),
      true,
    );
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "REQUESTED",
        openSupplement: false,
      }),
      false,
    );
    const gates = readFileSync(join(root, "src/lib/workflow/admin-workflow-gates.ts"), "utf8");
    assert.match(gates, /Publish requires service validation PASSED and provider CONFIRMED/);
    const steps = readFileSync(join(root, "src/lib/workflow/admin-workflow-steps.ts"), "utf8");
    assert.doesNotMatch(steps, /"providerReview"/);
  });

  it("approvePackReview still requires REVIEWING; restore/new-revision are post-unpublish paths", () => {
    const approve = readFileSync(
      join(root, "src/lib/publishing/publish-first-revision.ts"),
      "utf8",
    );
    const restore = readFileSync(
      join(root, "src/lib/publishing/restore-published-revision.ts"),
      "utf8",
    );
    const publishNew = readFileSync(
      join(root, "src/lib/publishing/publish-new-revision.ts"),
      "utf8",
    );
    const facade = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.match(approve, /export async function approvePackReview/);
    assert.match(approve, /detailBefore\.pack\.status !== "REVIEWING"/);
    assert.match(restore, /export async function restorePublishedPackAfterUnpublish/);
    assert.match(restore, /RESTORE_EXISTING_AFTER_UNPUBLISH/);
    assert.match(restore, /NOT_UNPUBLISHED_DRAFT/);
    assert.match(publishNew, /export async function publishNewRevisionAfterUnpublish/);
    assert.match(facade, /approvePackReview/);
    assert.match(facade, /restorePublishedPackAfterUnpublish/);
    assert.match(facade, /publishNewRevisionAfterUnpublish/);

    const api = readFileSync(join(root, "src/lib/admin-review-api.ts"), "utf8");
    assert.match(api, /export async function restorePublishAdminReview/);
    assert.match(api, /export async function publishNewRevisionAdminReview/);
    assert.match(api, /export async function unpublishAdminReview/);
  });

  it("loadPublicRetrievalPack prefers PRODUCTION generation version", () => {
    const source = readFileSync(join(root, "src/lib/retrieval/retrieval-pack-store.ts"), "utf8");
    assert.match(source, /scope: "PRODUCTION"/);
    assert.match(source, /status: "PROMOTED"/);
    assert.match(source, /prefer the version that owns the current PRODUCTION/);
  });

  it("legacy admin queues normalize rather than remaining operational SoT", () => {
    const routes = readFileSync(join(root, "src/lib/routes.ts"), "utf8");
    assert.match(routes, /normalizeAdminWorkQueue/);
    assert.match(routes, /["']accept["']/);
    assert.match(routes, /receipt/);
  });
});
