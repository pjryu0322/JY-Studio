import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdminWorkInboxItemViewModel,
  countAdminWorkInboxWaiting,
  mergeAdminWorkInboxViewModels,
} from "../lib/admin-work-inbox-view-model.ts";

describe("admin work inbox view model", () => {
  it("maps worker completed before provider review to quality check waiting", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-1",
      packName: "Sample Pack",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "NONE",
    });
    assert.equal(view.displayStatus, "품질점검 대기");
    assert.equal(view.ctaLabel, "품질 점검 후 검토 요청");
    assert.equal(view.adminQueueGroup, "QUALITY_CHECK_REQUIRED");
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
    assert.equal(view.displayStatus, "검수 요청 접수");
    assert.equal(view.ctaLabel, "검수 시작");
    assert.equal(view.adminQueueGroup, "ADMIN_REVIEW_REQUIRED");
    assert.equal(view.isWaitingForAdmin, true);
  });

  it("maps reviewing + pending to admin review required", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-3",
      packName: "Review pending",
      packStatus: "REVIEWING",
      packReviewStatus: "PENDING",
    });
    assert.equal(view.displayStatus, "검수 요청 접수");
    assert.equal(view.ctaLabel, "검수 시작");
    assert.equal(view.isWaitingForAdmin, true);
  });

  it("maps reviewing + in_review to admin review in progress", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pack-4",
      packName: "In review",
      packStatus: "REVIEWING",
      packReviewStatus: "IN_REVIEW",
    });
    assert.equal(view.displayStatus, "검수 중");
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
