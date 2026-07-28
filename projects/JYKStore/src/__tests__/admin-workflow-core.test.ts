import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_WORKFLOW_STEPS,
  resolveAdminWorkflowStepQuery,
} from "../lib/workflow/admin-workflow-steps.ts";
import type { AdminQualityGateSnapshot } from "../lib/workflow/admin-workflow-state.ts";
import {
  canEnterKnowledgeScope,
  canPublish,
  canRequestProviderReviewAfterServiceValidation,
} from "../lib/workflow/admin-workflow-gates.ts";
import { resolveAdminWorkflowCurrentStep } from "../lib/workflow/admin-workflow-transition.ts";

function quality(overrides?: Partial<AdminQualityGateSnapshot>): AdminQualityGateSnapshot {
  return {
    completed: true,
    failCount: 0,
    hasBlockers: false,
    hasWarnings: false,
    blockers: [],
    warnings: [],
    ...overrides,
  };
}

describe("ADMIN_WORKFLOW_STEPS", () => {
  it("has exactly 6 canonical steps", () => {
    assert.equal(ADMIN_WORKFLOW_STEPS.length, 6);
  });

  it("does not include legacy quality/providerConfirm steps", () => {
    assert.ok(!(ADMIN_WORKFLOW_STEPS as readonly string[]).includes("quality"));
    assert.ok(!(ADMIN_WORKFLOW_STEPS as readonly string[]).includes("providerConfirm"));
    assert.ok(!(ADMIN_WORKFLOW_STEPS as readonly string[]).includes("queue"));
    assert.ok(!(ADMIN_WORKFLOW_STEPS as readonly string[]).includes("decision"));
    assert.ok(!(ADMIN_WORKFLOW_STEPS as readonly string[]).includes("ops"));
  });

  it("is in the new canonical order", () => {
    assert.deepEqual(ADMIN_WORKFLOW_STEPS, [
      "receipt",
      "knowledgeScope",
      "generation",
      "correction",
      "serviceValidation",
      "publish",
    ]);
  });
});

describe("resolveAdminWorkflowStepQuery legacy mappings", () => {
  it("maps legacy step names to canonical steps", () => {
    assert.equal(resolveAdminWorkflowStepQuery("queue"), "receipt");
    assert.equal(resolveAdminWorkflowStepQuery("knowledge-scope"), "knowledgeScope");
    assert.equal(resolveAdminWorkflowStepQuery("quality"), "generation");
    assert.equal(resolveAdminWorkflowStepQuery("providerConfirm"), "publish");
    assert.equal(resolveAdminWorkflowStepQuery("searchValidation"), "serviceValidation");
    assert.equal(resolveAdminWorkflowStepQuery("service-validation"), "serviceValidation");
    assert.equal(resolveAdminWorkflowStepQuery("decision"), "publish");
  });

  it("routes ops outside the workflow (null)", () => {
    assert.equal(resolveAdminWorkflowStepQuery("ops"), null);
  });

  it("passes through canonical steps unchanged", () => {
    for (const step of ADMIN_WORKFLOW_STEPS) {
      assert.equal(resolveAdminWorkflowStepQuery(step), step);
    }
  });

  it("returns null for unknown/empty input", () => {
    assert.equal(resolveAdminWorkflowStepQuery(null), null);
    assert.equal(resolveAdminWorkflowStepQuery(undefined), null);
    assert.equal(resolveAdminWorkflowStepQuery("nonsense"), null);
  });
});

describe("golden path: receipt -> knowledgeScope -> generation -> serviceValidation -> publish", () => {
  it("receipt when zip not yet accepted", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "REQUESTED",
      quality: quality({ completed: false }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
    });
    assert.equal(step, "receipt");
  });

  it("knowledgeScope right after acceptance, before scope is confirmed", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "ACCEPTED",
      quality: quality({ completed: false }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      knowledgeScopeReady: false,
    });
    assert.equal(step, "knowledgeScope");
    assert.equal(canEnterKnowledgeScope({ workerZipPhase: "ACCEPTED" }), true);
  });

  it("generation once scope is ready / processing", () => {
    const acceptedReady = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "ACCEPTED",
      quality: quality({ completed: false }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      knowledgeScopeReady: true,
    });
    assert.equal(acceptedReady, "generation");

    const processing = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "PROCESSING",
      quality: quality({ completed: false }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
    });
    assert.equal(processing, "generation");
  });

  it("serviceValidation once generation completes cleanly", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality(),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
    });
    assert.equal(step, "serviceValidation");
  });

  it("publish once service validation passes, provider review requested then confirmed", () => {
    const requested = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality(),
      providerReviewPhase: "REQUESTED",
      serviceValidationPhase: "PASSED",
    });
    assert.equal(requested, "publish");

    const confirmed = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality(),
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "PASSED",
    });
    assert.equal(confirmed, "publish");
  });

  it("publish stays put once the pack is published/verified", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality(),
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "PASSED",
      packStatus: "PUBLISHED",
    });
    assert.equal(step, "publish");
  });
});

describe("correction path", () => {
  it("routes to correction when quality has blockers", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality({ hasBlockers: true, blockers: ["missing metadata"] }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
    });
    assert.equal(step, "correction");
  });

  it("routes to correction when quality has failures", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality({ failCount: 2 }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
    });
    assert.equal(step, "correction");
  });

  it("routes to correction when an admin supplement is open", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality(),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "PENDING",
    });
    assert.equal(step, "correction");
  });

  it("warnings alone do NOT force correction — still eligible for serviceValidation", () => {
    const step = resolveAdminWorkflowCurrentStep({
      workerZipPhase: "COMPLETED",
      quality: quality({ hasWarnings: true, warnings: ["minor formatting"] }),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
    });
    assert.equal(step, "serviceValidation");
  });
});

describe("canRequestProviderReviewAfterServiceValidation", () => {
  it("requires service validation PASSED", () => {
    assert.equal(
      canRequestProviderReviewAfterServiceValidation({
        serviceValidationPhase: "NONE",
        providerReviewPhase: "NONE",
        workerZipPhase: "COMPLETED",
        quality: quality(),
      }),
      false,
    );

    assert.equal(
      canRequestProviderReviewAfterServiceValidation({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "NONE",
        workerZipPhase: "COMPLETED",
        quality: quality(),
      }),
      true,
    );
  });

  it("blocks when an admin supplement is open", () => {
    assert.equal(
      canRequestProviderReviewAfterServiceValidation({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "NONE",
        workerZipPhase: "COMPLETED",
        quality: quality(),
        openSupplement: true,
      }),
      false,
    );
  });

  it("blocks when provider review is already requested or confirmed", () => {
    assert.equal(
      canRequestProviderReviewAfterServiceValidation({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "REQUESTED",
        workerZipPhase: "COMPLETED",
        quality: quality(),
      }),
      false,
    );
    assert.equal(
      canRequestProviderReviewAfterServiceValidation({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
        workerZipPhase: "COMPLETED",
        quality: quality(),
      }),
      false,
    );
  });
});

describe("canPublish", () => {
  it("requires provider review CONFIRMED even when service validation passed", () => {
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "REQUESTED",
      }),
      false,
    );
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
      }),
      true,
    );
  });

  it("blocks publish when an admin supplement is open", () => {
    assert.equal(
      canPublish({
        serviceValidationPhase: "PASSED",
        providerReviewPhase: "CONFIRMED",
        openSupplement: true,
      }),
      false,
    );
  });

  it("blocks publish when service validation has not passed", () => {
    assert.equal(
      canPublish({
        serviceValidationPhase: "NONE",
        providerReviewPhase: "CONFIRMED",
      }),
      false,
    );
  });
});
