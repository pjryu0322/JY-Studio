import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canShowDraftContinueCta,
  canShowMaterialRegisterCta,
  deriveStoreWorkflowStatus,
  describeStoreWorkflowStatus,
} from "../lib/store-workflow-status.ts";

describe("deriveStoreWorkflowStatus", () => {
  it("keeps DRAFT authoring for incomplete basic info", () => {
    const status = deriveStoreWorkflowStatus({
      packStatus: "DRAFT",
      basicInfoReady: false,
      sourceMaterialsReady: false,
    });
    assert.equal(status, "DRAFT");
    assert.equal(canShowDraftContinueCta(status), true);
  });

  it("maps SOURCE_REGISTERING when materials missing", () => {
    const status = deriveStoreWorkflowStatus({
      packStatus: "DRAFT",
      basicInfoReady: true,
      sourceMaterialsReady: false,
    });
    assert.equal(status, "SOURCE_REGISTERING");
    assert.equal(canShowMaterialRegisterCta(status), true);
  });

  it("prioritizes admin hold over draft CTAs", () => {
    const status = deriveStoreWorkflowStatus({
      packStatus: "DRAFT",
      basicInfoReady: true,
      sourceMaterialsReady: true,
      adminGenerationHold: "ACCEPTED",
      workerZipRequestStatus: "ACCEPTED",
    });
    assert.equal(status, "ADMIN_RECEIVED");
    assert.equal(canShowDraftContinueCta(status), false);
    assert.equal(canShowMaterialRegisterCta(status), false);
    assert.equal(describeStoreWorkflowStatus(status).providerStatusLabel, "관리자 처리 중");
  });

  it("maps provider review requested", () => {
    const status = deriveStoreWorkflowStatus({
      packStatus: "DRAFT",
      adminGenerationHold: "COMPLETED",
      providerReviewPhase: "REQUESTED",
      adminQualityPassed: true,
    });
    assert.equal(status, "PROVIDER_REVIEW_REQUESTED");
  });

  it("maps provider confirmed to service validating", () => {
    const status = deriveStoreWorkflowStatus({
      packStatus: "DRAFT",
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "NONE",
    });
    assert.equal(status, "SERVICE_VALIDATING");
  });

  it("maps provider WITHDRAWN to PROVIDER_WITHDRAWN with 보완 요청 labels", () => {
    const status = deriveStoreWorkflowStatus({
      packStatus: "DRAFT",
      providerReviewPhase: "WITHDRAWN",
    });
    assert.equal(status, "PROVIDER_WITHDRAWN");
    const labels = describeStoreWorkflowStatus(status);
    assert.equal(labels.label, "보완 요청");
    assert.match(labels.providerStatusLabel, /관리자 확인 대기/);
  });
});
