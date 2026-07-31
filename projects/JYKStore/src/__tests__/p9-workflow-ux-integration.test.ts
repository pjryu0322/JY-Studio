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

  it("approvePackReview still requires REVIEWING; restore-publish is the post-unpublish path", () => {
    const service = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.match(service, /export async function approvePackReview/);
    assert.match(service, /detailBefore\.pack\.status !== "REVIEWING"/);
    assert.match(service, /export async function restorePublishedPackAfterUnpublish/);
    assert.match(service, /RESTORE_PUBLISH_AFTER_UNPUBLISH/);
    assert.match(service, /NOT_UNPUBLISHED_DRAFT/);

    const route = readFileSync(
      join(root, "src/app/api/v1/admin/reviews/[packId]/restore-publish/route.ts"),
      "utf8",
    );
    assert.match(route, /restorePublishedPackAfterUnpublish/);
    assert.match(route, /requireAdminSession/);

    const api = readFileSync(join(root, "src/lib/admin-review-api.ts"), "utf8");
    assert.match(api, /export async function restorePublishAdminReview/);
    assert.match(api, /export async function unpublishAdminReview/);
    assert.match(api, /\/restore-publish/);

    const panel = readFileSync(
      join(root, "src/components/AdminApprovalPublishWorkbenchPanel.tsx"),
      "utf8",
    );
    assert.match(panel, /restorePublishAdminReview/);
    assert.match(panel, /unpublishAdminReview/);
    assert.match(panel, /재게시/);
    assert.match(panel, /게시 중단/);
  });

  it("loadPublicRetrievalPack prefers PRODUCTION generation version", () => {
    const source = readFileSync(join(root, "src/lib/retrieval/retrieval-pack-store.ts"), "utf8");
    assert.match(source, /scope: "PRODUCTION"/);
    assert.match(source, /status: "PROMOTED"/);
    assert.match(source, /prefer the version that owns the current PRODUCTION/);
    assert.doesNotMatch(
      source,
      /include:\s*\{\s*versions:\s*\{\s*orderBy:\s*\{\s*createdAt:\s*"desc"/,
    );
  });

  it("legacy admin queues normalize rather than remaining operational SoT", () => {
    const routes = readFileSync(join(root, "src/lib/routes.ts"), "utf8");
    assert.match(routes, /normalizeAdminWorkQueue/);
    assert.match(routes, /["']accept["']/);
    assert.match(routes, /receipt/);
  });
});
