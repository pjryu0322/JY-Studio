import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PackStatus } from "@prisma/client";
import { adminWorkInboxDetailHref } from "../lib/admin-work-inbox/admin-work-inbox-navigation.ts";
import { buildAdminWorkInboxItemViewModel } from "../lib/admin-work-inbox-view-model.ts";
import type { PackWorkflowFacts } from "../lib/workflow/pack-workflow-facts.ts";
import {
  buildPackWorkflowSnapshot,
  toPackWorkflowRuntimeSummary,
} from "../lib/workflow/pack-workflow-snapshot.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function facts(over: Partial<PackWorkflowFacts> = {}): PackWorkflowFacts {
  return {
    packId: "pack-nav",
    packStatus: PackStatus.DRAFT,
    receipt: {
      accepted: false,
      workerZipPhase: "REQUESTED",
      sourceRevisionId: null,
      workingCopyId: null,
    },
    knowledgeScope: {
      inventoryId: null,
      finalized: false,
      includedCount: 0,
      pendingCount: 0,
    },
    generation: {
      generationId: null,
      completed: false,
      blockerCount: 0,
      warningCount: 0,
      failCount: 0,
    },
    correction: { openCount: 0, openSupplement: false },
    serviceValidation: { phase: "NONE", generationId: null },
    providerReview: { phase: "NONE", generationId: null, confirmed: false },
    publishing: {
      productionGenerationId: null,
      preservedGenerationId: null,
      packReviewStatus: null,
      recoveryMode: null,
    },
    ...over,
  };
}

describe("admin inbox navigation uses Snapshot currentStep", () => {
  it("row.workflow.currentStep matches buildPackWorkflowSnapshot", () => {
    const snap = buildPackWorkflowSnapshot(facts());
    const item = buildAdminWorkInboxItemViewModel({
      packId: "pack-nav",
      packName: "Nav Pack",
      packStatus: "DRAFT",
      workerZipPhase: "REQUESTED",
      workflow: toPackWorkflowRuntimeSummary(snap),
    });
    assert.equal(item.workflow?.currentStep, snap.currentStep);
    assert.equal(
      adminWorkInboxDetailHref(item, "all"),
      `/admin/reviews/pack-nav?step=${snap.currentStep}`,
    );
  });

  it("explicit queue scope wins over snapshot step", () => {
    const snap = buildPackWorkflowSnapshot(facts());
    const item = buildAdminWorkInboxItemViewModel({
      packId: "pack-nav",
      packName: "Nav Pack",
      packStatus: "DRAFT",
      workerZipPhase: "REQUESTED",
      workflow: toPackWorkflowRuntimeSummary(snap),
    });
    assert.equal(
      adminWorkInboxDetailHref(item, "publish"),
      "/admin/reviews/pack-nav?step=publish",
    );
  });

  it("removes queue-group switch from inbox navigation", () => {
    const nav = readFileSync(
      join(projectRoot, "src/lib/admin-work-inbox/admin-work-inbox-navigation.ts"),
      "utf8",
    );
    assert.ok(!nav.includes("adminQueueGroup"));
    assert.ok(!nav.includes("ACCEPT_REQUIRED"));
    assert.ok(!nav.includes("GENERATE_REQUIRED"));
    assert.ok(nav.includes("currentStep"));
  });
});
