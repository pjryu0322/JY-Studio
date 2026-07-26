import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdminWorkInboxItemViewModel,
  countAdminWorkInboxWaiting,
  mergeAdminWorkInboxViewModels,
} from "../lib/admin-work-inbox-view-model.ts";

describe("admin work inbox view model", () => {
  it("maps worker completed before provider review to 생성·품질보정 waiting", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-1",
      packName: "Sample Pack",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "NONE",
    });
    assert.equal(view.displayStatus, "생성·품질보정 대기");
    assert.equal(view.ctaLabel, "생성·품질보정");
    assert.equal(view.adminQueueGroup, "GENERATE_REQUIRED");
    assert.equal(view.isWaitingForAdmin, true);
    assert.notEqual(view.displayStatus, "생성 완료");
  });

  it("maps provider review requested away from 생성 완료", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "riamore",
      packName: "리아모어",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "REQUESTED",
    });
    assert.equal(view.displayStatus, "제공자 검토 중");
    assert.equal(view.ctaLabel, "검토 요청 내역 보기");
    assert.equal(view.adminQueueGroup, "PROVIDER_REVIEW_IN_PROGRESS");
    assert.equal(view.isWaitingForAdmin, false);
  });

  it("maps provider confirmed / submitted to admin review required", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-2",
      packName: "Submitted",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "CONFIRMED",
    });
    assert.equal(view.displayStatus, "서비스 검증 대기");
    assert.equal(view.ctaLabel, "서비스 검증");
    assert.equal(view.adminQueueGroup, "ADMIN_REVIEW_REQUIRED");
    assert.equal(view.isWaitingForAdmin, true);
  });

  it("maps confirmed + service PASSED toward pack review copy", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-2b",
      packName: "Validated",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "CONFIRMED",
      serviceValidationPhase: "PASSED",
    });
    assert.equal(view.displayStatus, "승인·게시 대기");
    assert.equal(view.ctaLabel, "승인·게시");
  });

  it("maps reviewing + pending to admin review required", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-3",
      packName: "Review pending",
      packStatus: "REVIEWING",
      packReviewStatus: "PENDING",
    });
    assert.equal(view.displayStatus, "승인·게시 대기");
    assert.equal(view.ctaLabel, "승인·게시");
    assert.equal(view.isWaitingForAdmin, true);
  });

  it("maps reviewing + in_review to admin review in progress", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-4",
      packName: "In review",
      packStatus: "REVIEWING",
      packReviewStatus: "IN_REVIEW",
    });
    assert.equal(view.displayStatus, "승인·게시 진행 중");
    assert.equal(view.ctaLabel, "검수 계속하기");
    assert.equal(view.adminQueueGroup, "ADMIN_REVIEW_IN_PROGRESS");
    assert.equal(view.isWaitingForAdmin, true);
  });

  it("maps published packs out of waiting queue", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "toast",
      packName: "TOAST UI Grid",
      packStatus: "PUBLISHED",
    });
    assert.equal(view.displayStatus, "공개 중");
    assert.equal(view.ctaLabel, "공개 상세 보기");
    assert.equal(view.adminQueueGroup, "PUBLISHED");
    assert.equal(view.isWaitingForAdmin, false);
  });

  it("maps provider WITHDRAWN / 보완요청 into supplement queue as waiting", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "rmategridh5webv60",
      packName: "리아모어",
      packStatus: "DRAFT",
      providerReviewPhase: "WITHDRAWN",
      providerSupplementPhase: "PENDING",
    });
    assert.equal(view.displayStatus, "보완요청 접수 대기");
    assert.equal(view.ctaLabel, "요청사항 확인");
    assert.equal(view.adminQueueGroup, "PROVIDER_SUPPLEMENT_REQUIRED");
    assert.equal(view.isWaitingForAdmin, true);
    assert.equal(view.workflowStatus, "PROVIDER_WITHDRAWN");
  });

  it("keeps pre-request COMPLETED packs in 생성·품질보정 (not provider waiting)", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pre-request",
      packName: "Pre",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "NONE",
      providerSupplementPhase: "NONE",
    });
    assert.equal(view.adminQueueGroup, "GENERATE_REQUIRED");
    assert.equal(view.displayStatus, "생성·품질보정 대기");
    assert.notEqual(view.adminQueueGroup, "PROVIDER_REVIEW_IN_PROGRESS");
  });

  it("maps plain WITHDRAWN without supplement out of admin waiting", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "plain-withdraw",
      packName: "Plain",
      packStatus: "DRAFT",
      providerReviewPhase: "WITHDRAWN",
      providerSupplementPhase: "NONE",
    });
    assert.equal(view.adminQueueGroup, "OTHER");
    assert.equal(view.isWaitingForAdmin, false);
  });

  it("excludes provider-review and published from waiting count", () => {
    const items = mergeAdminWorkInboxViewModels([
      buildAdminWorkInboxItemViewModel({
        packId: "a",
        packName: "A",
        packStatus: "DRAFT",
        workerZipPhase: "COMPLETED",
        providerReviewPhase: "REQUESTED",
      }),
      buildAdminWorkInboxItemViewModel({
        packId: "b",
        packName: "B",
        packStatus: "PUBLISHED",
      }),
      buildAdminWorkInboxItemViewModel({
        packId: "c",
        packName: "C",
        packStatus: "DRAFT",
        workerZipPhase: "COMPLETED",
        providerReviewPhase: "NONE",
      }),
      buildAdminWorkInboxItemViewModel({
        packId: "d",
        packName: "D",
        packStatus: "REVIEWING",
        packReviewStatus: "PENDING",
      }),
    ]);
    assert.equal(countAdminWorkInboxWaiting(items), 2);
  });
});
