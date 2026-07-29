import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADMIN_WORK_SECTION_ACCEPT_CTA,
  ADMIN_WORK_SECTION_ACCEPT_TITLE,
  ADMIN_WORK_SECTION_GENERATE_CTA,
  ADMIN_WORK_SECTION_GENERATE_TITLE,
} from "../lib/role-based-ux-copy.ts";
import { buildAdminWorkInboxItemViewModel } from "../lib/admin-work-inbox-view-model.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin material acceptance (workbench step1)", () => {
  it("uses 자료 접수 / 지식데이터 생성 copy for inbox sections", () => {
    assert.equal(ADMIN_WORK_SECTION_ACCEPT_TITLE, "자료 접수 대기");
    assert.equal(ADMIN_WORK_SECTION_ACCEPT_CTA, "자료 접수");
    assert.equal(ADMIN_WORK_SECTION_GENERATE_TITLE, "지식데이터 생성 대기");
    assert.equal(ADMIN_WORK_SECTION_GENERATE_CTA, "지식데이터 생성");
  });

  it("maps REQUESTED to accept queue with 자료 접수 CTA", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "toast",
      packName: "TOAST UI Grid",
      packStatus: "DRAFT",
      workerZipPhase: "REQUESTED",
    });
    assert.equal(view.adminQueueGroup, "ACCEPT_REQUIRED");
    assert.equal(view.displayStatus, "접수 대기");
    assert.equal(view.ctaLabel, "자료 접수");
    assert.equal(view.isWaitingForAdmin, true);
  });

  it("maps ACCEPTED and COMPLETED into 지식데이터 생성 (not provider review)", () => {
    const accepted = buildAdminWorkInboxItemViewModel({
      packId: "a",
      packName: "A",
      packStatus: "DRAFT",
      workerZipPhase: "ACCEPTED",
    });
    assert.equal(accepted.adminQueueGroup, "GENERATE_REQUIRED");
    assert.equal(accepted.ctaLabel, "지식데이터 생성");

    const completed = buildAdminWorkInboxItemViewModel({
      packId: "c",
      packName: "C",
      packStatus: "DRAFT",
      workerZipPhase: "COMPLETED",
      providerReviewPhase: "NONE",
    });
    assert.equal(completed.adminQueueGroup, "GENERATE_REQUIRED");
    assert.equal(completed.displayStatus, "지식데이터 생성 대기");
    assert.notEqual(completed.adminQueueGroup, "PROVIDER_REVIEW_IN_PROGRESS");
  });

  it("keeps PUBLISHED out of accept/generate waiting queues", () => {
    const view = buildAdminWorkInboxItemViewModel({
      packId: "pub",
      packName: "Published",
      packStatus: "PUBLISHED",
      workerZipPhase: "COMPLETED",
    });
    assert.equal(view.adminQueueGroup, "PUBLISHED");
    assert.equal(view.isWaitingForAdmin, false);
  });

  it("queue step renders acceptance panel and not generation card", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes("AdminMaterialAcceptancePanel"));
    assert.ok(detail.includes("AdminKnowledgeGenerationPanel"));
    assert.ok(detail.includes("AdminKnowledgeCorrectionPanel"));
    assert.ok(detail.includes("AdminProviderReviewPanel"));
    assert.ok(detail.includes("AdminQualityCheckPanel"));
    assert.ok(detail.includes('activeStep === "queue"'));
    assert.ok(detail.includes("showAcceptance"));
    assert.ok(detail.includes("showGeneration"));
    assert.ok(detail.includes("showQuality"));
    assert.ok(detail.includes("showCorrection"));
    assert.ok(detail.includes("parseAdminReviewStep"));
    const panel = readSource("src/components/AdminMaterialAcceptancePanel.tsx");
    assert.ok(panel.includes("자료 접수"));
    assert.ok(panel.includes("자료 반려"));
    assert.ok(panel.includes("cancelAdminWorkerZipRejection"));
    assert.ok(panel.includes("생성으로 이동") || panel.includes("생성·품질보정으로 이동"));
    assert.ok(panel.includes("acceptAdminWorkerZipRequest"));
    assert.ok(!panel.includes("runAdminWorkerZipGeneration"));
  });

  it("correction panel is an independent workbench with issue queue", () => {
    const panel = readSource("src/components/AdminKnowledgeCorrectionPanel.tsx");
    const icon = readSource("src/components/role-workspace/RoleRailIcon.tsx");
    assert.ok(panel.includes("보정"));
    assert.ok(panel.includes("원본 미리보기") || panel.includes("미리보기"));
    assert.ok(panel.includes("재생성"));
    assert.ok(panel.includes("UiTooltip"));
    assert.ok(panel.includes("고급 보기"));
    assert.ok(panel.includes("더보기"));
    assert.ok(icon.includes('case "correction"'));
  });

  it("generation card no longer exposes 자료 반려 CTA", () => {
    const card = readSource("src/components/AdminWorkerZipGenerationCard.tsx");
    assert.ok(!card.includes(">자료 반려<") && !card.includes('"자료 반려"'));
    assert.doesNotMatch(card, /rejectAdminWorkerZipRequest/);
    assert.doesNotMatch(card, /cancelAdminWorkerZipRejection/);
    assert.match(card, /지식데이터 생성 실행/);
    assert.match(card, /실행/);
    assert.match(card, /완료취소/);
  });
});
