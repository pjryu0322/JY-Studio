import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PackStatus } from "@prisma/client";
import {
  normalizePackReviewStatus,
  normalizePackStatus,
  normalizeProviderReviewPhase,
  normalizeServiceValidationPhase,
  normalizeWorkerZipPhase,
} from "../lib/workflow/pack-workflow-facts-normalize.ts";

describe("PackWorkflowFacts normalize (loader boundary)", () => {
  it("normalizes pack status", () => {
    assert.equal(normalizePackStatus("REVIEWING"), PackStatus.REVIEWING);
    assert.equal(normalizePackStatus("unknown"), PackStatus.DRAFT);
  });

  it("normalizes worker zip phases and legacy aliases", () => {
    assert.equal(normalizeWorkerZipPhase("COMPLETED"), "COMPLETED");
    assert.equal(normalizeWorkerZipPhase("RUNNING"), "ACCEPTED");
    assert.equal(normalizeWorkerZipPhase("PASS"), "COMPLETED");
    assert.equal(normalizeWorkerZipPhase("PENDING"), "REQUESTED");
    assert.equal(normalizeWorkerZipPhase("weird"), "NONE");
  });

  it("normalizes service / provider phases", () => {
    assert.equal(normalizeServiceValidationPhase("PASS"), "PASSED");
    assert.equal(normalizeServiceValidationPhase(null), "NONE");
    assert.equal(normalizeProviderReviewPhase("CONFIRMED"), "CONFIRMED");
    assert.equal(normalizeProviderReviewPhase("x"), "NONE");
  });

  it("normalizes pack review status", () => {
    assert.equal(normalizePackReviewStatus("IN_REVIEW"), "IN_REVIEW");
    assert.equal(normalizePackReviewStatus("REVIEWING"), "IN_REVIEW");
    assert.equal(normalizePackReviewStatus(null), null);
  });
});
