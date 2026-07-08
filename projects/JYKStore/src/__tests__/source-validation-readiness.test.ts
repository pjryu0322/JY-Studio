import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApproveReviewReadiness,
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";

const baseReady = {
  isReviewing: true,
  versionCount: 1,
  sourceDocumentCount: 2,
  hasRequiredDescription: true,
};

describe("source validation readiness", () => {
  it("blocks submit when FAIL is present", () => {
    const counts = countSourceValidationFromStatuses(["PASS", "FAIL"]);
    assert.equal(meetsSourceValidationSubmitGate(counts), false);
  });

  it("blocks submit when NOT_CHECKED is present", () => {
    const counts = countSourceValidationFromStatuses(["PASS", "NOT_CHECKED"]);
    assert.equal(meetsSourceValidationSubmitGate(counts), false);
  });

  it("allows submit when only WARNING is present", () => {
    const counts = countSourceValidationFromStatuses(["WARNING", "PASS"]);
    assert.equal(meetsSourceValidationSubmitGate(counts), true);
  });

  it("allows submit when only PASS is present", () => {
    const counts = countSourceValidationFromStatuses(["PASS", "PASS"]);
    assert.equal(meetsSourceValidationSubmitGate(counts), true);
  });

  it("blocks approve when FAIL is present", () => {
    const counts = countSourceValidationFromStatuses(["FAIL"]);
    assert.equal(canApproveReviewReadiness(baseReady, counts), false);
  });

  it("blocks approve when NOT_CHECKED is present", () => {
    const counts = countSourceValidationFromStatuses(["NOT_CHECKED"]);
    assert.equal(canApproveReviewReadiness(baseReady, counts), false);
  });

  it("allows approve when only WARNING is present", () => {
    const counts = countSourceValidationFromStatuses(["WARNING"]);
    assert.equal(canApproveReviewReadiness(baseReady, counts), true);
  });

  it("allows approve when only PASS is present", () => {
    const counts = countSourceValidationFromStatuses(["PASS"]);
    assert.equal(canApproveReviewReadiness(baseReady, counts), true);
  });
});
