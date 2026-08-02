import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PackStatus } from "@prisma/client";
import type { PackWorkflowFacts } from "../lib/workflow/pack-workflow-facts.ts";
import {
  buildPackWorkflowSnapshot,
  resolveAvailableActions,
  resolveCurrentAdminStep,
} from "../lib/workflow/pack-workflow-snapshot.ts";

function baseFacts(over: Partial<PackWorkflowFacts> = {}): PackWorkflowFacts {
  return {
    packId: "pack-1",
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

function readyForPublish(over: Partial<PackWorkflowFacts> = {}): PackWorkflowFacts {
  return baseFacts({
    packStatus: PackStatus.REVIEWING,
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
    providerReview: { phase: "CONFIRMED", generationId: "g1", confirmed: true },
    ...over,
  });
}

describe("PackWorkflowSnapshot SoT", () => {
  it("routes REQUESTED worker zip to receipt", () => {
    assert.equal(resolveCurrentAdminStep(baseFacts()), "receipt");
    assert.ok(resolveAvailableActions(baseFacts()).includes("ACCEPT_MATERIAL"));
  });

  it("routes ACCEPTED + unfinished scope to knowledgeScope", () => {
    const facts = baseFacts({
      receipt: {
        accepted: true,
        workerZipPhase: "ACCEPTED",
        sourceRevisionId: "s1",
        workingCopyId: null,
      },
    });
    assert.equal(resolveCurrentAdminStep(facts), "knowledgeScope");
    assert.ok(resolveAvailableActions(facts).includes("FINALIZE_SCOPE"));
  });

  it("routes finalized ACCEPTED to generation", () => {
    const facts = baseFacts({
      receipt: {
        accepted: true,
        workerZipPhase: "ACCEPTED",
        sourceRevisionId: "s1",
        workingCopyId: "w1",
      },
      knowledgeScope: {
        inventoryId: "i1",
        finalized: true,
        includedCount: 2,
        pendingCount: 0,
      },
    });
    assert.equal(resolveCurrentAdminStep(facts), "generation");
    assert.ok(resolveAvailableActions(facts).includes("START_GENERATION"));
  });

  it("routes generation blockers to correction", () => {
    const facts = baseFacts({
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
        blockerCount: 2,
        warningCount: 0,
        failCount: 1,
      },
    });
    assert.equal(resolveCurrentAdminStep(facts), "correction");
    const snap = buildPackWorkflowSnapshot(facts);
    assert.ok(snap.availableActions.includes("OPEN_CORRECTION"));
    assert.ok(snap.blockingReasons.some((r) => r.code === "QUALITY_BLOCKERS"));
    assert.equal(snap.correction.state, "BLOCKED");
  });

  it("routes open supplement to correction", () => {
    const facts = readyForPublish({
      packStatus: PackStatus.DRAFT,
      correction: { openCount: 0, openSupplement: true },
      providerReview: { phase: "CONFIRMED", generationId: "g1", confirmed: true },
    });
    assert.equal(resolveCurrentAdminStep(facts), "correction");
    assert.ok(
      buildPackWorkflowSnapshot(facts).blockingReasons.some((r) => r.code === "OPEN_SUPPLEMENT"),
    );
  });

  it("routes service validation when quality is clean", () => {
    const facts = readyForPublish({
      packStatus: PackStatus.DRAFT,
      serviceValidation: { phase: "NONE", generationId: "g1" },
      providerReview: { phase: "NONE", generationId: null, confirmed: false },
    });
    assert.equal(resolveCurrentAdminStep(facts), "serviceValidation");
    assert.ok(resolveAvailableActions(facts).includes("RUN_SERVICE_VALIDATION"));
  });

  it("never treats provider review as a rail step id", () => {
    const snap = buildPackWorkflowSnapshot(
      readyForPublish({
        packStatus: PackStatus.DRAFT,
        providerReview: { phase: "REQUESTED", generationId: "g1", confirmed: false },
      }),
    );
    assert.equal(snap.currentStep, "publish");
    assert.ok(snap.blockingReasons.some((r) => r.step === "providerReview"));
    assert.ok(!("providerReview" in ADMIN_STEPS_AS_RAIL(snap)));
  });

  it("exposes first publish + reject when REVIEWING and publish gates pass", () => {
    const actions = resolveAvailableActions(readyForPublish());
    assert.ok(actions.includes("PUBLISH_FIRST_REVISION"));
    assert.ok(actions.includes("REJECT_REVIEW"));
  });

  it("exposes restore existing from recovery mode", () => {
    const actions = resolveAvailableActions(
      readyForPublish({
        packStatus: PackStatus.DRAFT,
        publishing: {
          productionGenerationId: null,
          preservedGenerationId: "prod-1",
          packReviewStatus: null,
          recoveryMode: "RESTORE_EXISTING",
        },
        providerReview: { phase: "NONE", generationId: null, confirmed: false },
        serviceValidation: { phase: "NONE", generationId: null },
      }),
    );
    assert.ok(actions.includes("RESTORE_EXISTING_REVISION"));
  });

  it("exposes new revision publish when recovery + publish gates pass", () => {
    const actions = resolveAvailableActions(
      readyForPublish({
        packStatus: PackStatus.DRAFT,
        publishing: {
          productionGenerationId: null,
          preservedGenerationId: "prod-1",
          packReviewStatus: null,
          recoveryMode: "PUBLISH_NEW_REVISION",
        },
      }),
    );
    assert.ok(actions.includes("PUBLISH_NEW_REVISION"));
  });

  it("exposes unpublish for published packs", () => {
    const actions = resolveAvailableActions(
      readyForPublish({ packStatus: PackStatus.PUBLISHED }),
    );
    assert.ok(actions.includes("UNPUBLISH"));
  });

  it("exposes StepState on each step snapshot", () => {
    const snap = buildPackWorkflowSnapshot(baseFacts());
    assert.equal(snap.receipt.state, "IN_PROGRESS");
    assert.equal(typeof snap.receipt.ready, "boolean");
    assert.equal(typeof snap.receipt.blocked, "boolean");
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
