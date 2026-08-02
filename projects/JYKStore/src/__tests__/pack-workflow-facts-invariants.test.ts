import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PackStatus } from "@prisma/client";
import { assemblePackWorkflowFacts } from "../lib/workflow/pack-workflow-facts-assemble.ts";
import {
  collectPackWorkflowInvariantViolations,
  enforcePackWorkflowFactsInvariants,
} from "../lib/workflow/pack-workflow-facts-invariants.ts";
import type { PackWorkflowFacts } from "../lib/workflow/pack-workflow-facts.ts";

function base(over: Partial<PackWorkflowFacts> = {}): PackWorkflowFacts {
  return {
    packId: "inv-1",
    packStatus: PackStatus.DRAFT,
    receipt: {
      accepted: true,
      workerZipPhase: "COMPLETED",
      sourceRevisionId: null,
      workingCopyId: null,
    },
    knowledgeScope: {
      inventoryId: "i1",
      finalized: true,
      includedCount: 1,
      pendingCount: 0,
    },
    generation: {
      generationId: null,
      completed: true,
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

describe("PackWorkflowFacts invariants", () => {
  it("flags CONFIRMED without generationId", () => {
    const v = collectPackWorkflowInvariantViolations(
      base({
        providerReview: { phase: "CONFIRMED", generationId: null, confirmed: true },
      }),
    );
    assert.ok(v.some((x) => x.code === "PROVIDER_CONFIRMED_WITHOUT_GENERATION"));
  });

  it("flags PASSED without generationId", () => {
    const v = collectPackWorkflowInvariantViolations(
      base({
        serviceValidation: { phase: "PASSED", generationId: null },
      }),
    );
    assert.ok(v.some((x) => x.code === "SERVICE_PASSED_WITHOUT_GENERATION"));
  });

  it("flags RESTORE_EXISTING without preservedGenerationId", () => {
    const v = collectPackWorkflowInvariantViolations(
      base({
        publishing: {
          productionGenerationId: null,
          preservedGenerationId: null,
          packReviewStatus: null,
          recoveryMode: "RESTORE_EXISTING",
        },
      }),
    );
    assert.ok(v.some((x) => x.code === "RESTORE_WITHOUT_PRESERVED_GENERATION"));
  });

  it("flags PUBLISH_NEW_REVISION without draft generation", () => {
    const v = collectPackWorkflowInvariantViolations(
      base({
        publishing: {
          productionGenerationId: null,
          preservedGenerationId: "p1",
          packReviewStatus: null,
          recoveryMode: "PUBLISH_NEW_REVISION",
        },
      }),
    );
    assert.ok(v.some((x) => x.code === "NEW_REVISION_WITHOUT_DRAFT_GENERATION"));
  });

  it("strict mode throws", () => {
    assert.throws(() =>
      enforcePackWorkflowFactsInvariants(
        base({
          providerReview: { phase: "CONFIRMED", generationId: null, confirmed: true },
        }),
        { mode: "strict" },
      ),
    );
  });

  it("assemble enforces when confirmed without generationId", () => {
    assert.throws(() =>
      assemblePackWorkflowFacts({
        packId: "x",
        packStatus: "REVIEWING",
        workerZipPhase: "COMPLETED",
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
        invariantMode: "strict",
      }),
    );
  });
});
