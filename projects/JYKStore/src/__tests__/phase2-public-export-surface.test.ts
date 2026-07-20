import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as serviceValidation from "@/lib/distribution/service-validation-service";
import * as reviewSubmitEvidence from "@/lib/distribution/review-submit-evidence";
import * as providerPack from "@/lib/provider-pack-service";

describe("Phase 2 public export surface characterization", () => {
  it("service-validation-service keeps core policy and command exports", () => {
    assert.equal(typeof serviceValidation.resolveRunCurrentValidity, "function");
    assert.equal(typeof serviceValidation.resolveValidationLockReason, "function");
    assert.equal(typeof serviceValidation.rankingPolicyVersionFromDetails, "function");
    assert.equal(typeof serviceValidation.resolveSearchEvaluationValidity, "function");
    assert.equal(typeof serviceValidation.resolveConfirmationStatusDto, "function");
    assert.equal(typeof serviceValidation.getServiceValidationStatus, "function");
    assert.equal(typeof serviceValidation.runServiceChannelValidation, "function");
    assert.equal(typeof serviceValidation.assertPreparationServiceValidationsPassed, "function");
    assert.equal(typeof serviceValidation.assertSelectedServiceValidationsPassed, "function");
    assert.equal(typeof serviceValidation.assertCurrentServiceValidationEvidence, "function");
    assert.equal(typeof serviceValidation.listAdminServiceValidationHistory, "function");
    assert.equal(typeof serviceValidation.getAdminServiceValidationRun, "function");
    assert.ok(Array.isArray(serviceValidation.SEARCH_VALIDATION_PREPARATION_CHANNELS));
  });

  it("review-submit-evidence keeps fail-closed RAG binding and tx orchestration", () => {
    assert.equal(typeof reviewSubmitEvidence.assertRagExportDownloadEvidenceBinding, "function");
    assert.equal(typeof reviewSubmitEvidence.assertReviewSubmitEvidenceInTx, "function");
    assert.equal(typeof reviewSubmitEvidence.ReviewSubmitEvidenceError, "function");
  });

  it("provider-pack-service keeps CRUD, version, source, and review exports", () => {
    assert.equal(typeof providerPack.listProviderPacksForClient, "function");
    assert.equal(typeof providerPack.createProviderPackForClient, "function");
    assert.equal(typeof providerPack.getProviderPackForClient, "function");
    assert.equal(typeof providerPack.updateProviderPackForClient, "function");
    assert.equal(typeof providerPack.createProviderPackVersionForClient, "function");
    assert.equal(typeof providerPack.createSourceDocumentForProviderPack, "function");
    assert.equal(typeof providerPack.submitProviderPackForReview, "function");
    assert.equal(typeof providerPack.withdrawProviderPackFromReview, "function");
    assert.equal(typeof providerPack.validateProviderSourceDocument, "function");
  });
});
