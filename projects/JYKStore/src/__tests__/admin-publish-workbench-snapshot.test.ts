import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { assemblePackWorkflowFacts } from "../lib/workflow/pack-workflow-facts-assemble.ts";
import { buildPackWorkflowSnapshot } from "../lib/workflow/pack-workflow-snapshot.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

describe("Publish Workbench Snapshot CTAs", () => {
  it("maps snapshot availableActions to workbench CTA visibility", () => {
    const restore = buildPackWorkflowSnapshot(
      assemblePackWorkflowFacts({
        packId: "p1",
        packStatus: PackStatus.DRAFT,
        workerZipPhase: "COMPLETED",
        knowledgeScopeFinalized: true,
        quality: {
          completed: true,
          hasBlockers: false,
          failCount: 0,
          hasWarnings: false,
          blockers: [],
          warnings: [],
        },
        openSupplement: false,
        serviceValidationPhase: "NONE",
        providerReviewPhase: "NONE",
        recoveryMode: "RESTORE_EXISTING",
        preservedGenerationId: "prod-1",
      }),
    );
    assert.ok(restore.availableActions.includes("RESTORE_EXISTING_REVISION"));

    const first = buildPackWorkflowSnapshot(
      assemblePackWorkflowFacts({
        packId: "p2",
        packStatus: PackStatus.REVIEWING,
        workerZipPhase: "COMPLETED",
        knowledgeScopeFinalized: true,
        quality: {
          completed: true,
          hasBlockers: false,
          failCount: 0,
          hasWarnings: false,
          blockers: [],
          warnings: [],
        },
        openSupplement: false,
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
      }),
    );
    assert.ok(first.availableActions.includes("PUBLISH_FIRST_REVISION"));
    assert.ok(first.availableActions.includes("REJECT_REVIEW"));

    const published = buildPackWorkflowSnapshot(
      assemblePackWorkflowFacts({
        packId: "p3",
        packStatus: PackStatus.PUBLISHED,
        workerZipPhase: "COMPLETED",
        knowledgeScopeFinalized: true,
        quality: {
          completed: true,
          hasBlockers: false,
          failCount: 0,
          hasWarnings: false,
          blockers: [],
          warnings: [],
        },
        openSupplement: false,
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
      }),
    );
    assert.ok(published.availableActions.includes("UNPUBLISH"));
  });

  it("panel source consumes buildPackWorkflowSnapshot / availableActions", () => {
    const src = readFileSync(
      join(projectRoot, "src/components/AdminApprovalPublishWorkbenchPanel.tsx"),
      "utf8",
    );
    assert.ok(src.includes("buildPackWorkflowSnapshot"));
    assert.ok(src.includes("assemblePackWorkflowFacts"));
    assert.ok(src.includes("availableActions"));
    assert.ok(src.includes("RESTORE_EXISTING_REVISION"));
    assert.ok(src.includes("PUBLISH_NEW_REVISION"));
    assert.ok(src.includes("PUBLISH_FIRST_REVISION"));
  });
});
