import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PackWorkflowFacts } from "../lib/workflow/pack-workflow-facts.ts";
import {
  buildPackWorkflowSnapshot,
  resolveCurrentAdminStep,
} from "../lib/workflow/pack-workflow-snapshot.ts";

function baseFacts(over: Partial<PackWorkflowFacts> = {}): PackWorkflowFacts {
  return {
    packId: "pack-1",
    packStatus: "DRAFT",
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
    serviceValidation: { phase: null, generationId: null },
    providerReview: { phase: null, generationId: null, confirmed: false },
    publishing: {
      productionGenerationId: null,
      preservedGenerationId: null,
      packReviewStatus: null,
      recoveryMode: null,
    },
    ...over,
  };
}

describe("PackWorkflowSnapshot SoT", () => {
  it("routes REQUESTED worker zip to receipt", () => {
    assert.equal(resolveCurrentAdminStep(baseFacts()), "receipt");
  });

  it("never treats provider review as a rail step id", () => {
    const snap = buildPackWorkflowSnapshot(
      baseFacts({
        receipt: {
          accepted: true,
          workerZipPhase: "COMPLETED",
          sourceRevisionId: "s1",
          workingCopyId: "w1",
        },
        knowledgeScope: {
          inventoryId: "i1",
          finalized: true,
          includedCount: 1,
          pendingCount: 0,
        },
        generation: {
          generationId: "g1",
          completed: true,
          blockerCount: 0,
          warningCount: 0,
          failCount: 0,
        },
        serviceValidation: { phase: "PASSED", generationId: "g1" },
        providerReview: { phase: "REQUESTED", generationId: "g1", confirmed: false },
      }),
    );
    assert.equal(snap.currentStep, "publish");
    assert.ok(snap.blockingReasons.some((r) => r.step === "providerReview"));
    assert.ok(!("providerReview" in ADMIN_STEPS_AS_RAIL(snap)));
  });
});

function ADMIN_STEPS_AS_RAIL(snap: ReturnType<typeof buildPackWorkflowSnapshot>) {
  return {
    receipt: snap.receipt.step,
    knowledgeScope: snap.knowledgeScope.step,
    generation: snap.generation.step,
    correction: snap.correction.step,
    serviceValidation: snap.serviceValidation.step,
    publish: snap.publish.step,
  };
}
