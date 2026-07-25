import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildProviderPackProgress,
  buildProviderPacksStatusSummary,
} from "../lib/provider-pack-progress.ts";
import { buildProviderOnboardingSteps } from "../lib/provider-onboarding-steps.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider pack progress", () => {
  it("keeps published and reviewing packs on separate steps", () => {
    const published = buildProviderPackProgress({
      packId: "2025sw",
      packStatus: "PUBLISHED",
      name: "SW",
      categoryId: "guide",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: { id: "v1", version: "0.1.0" },
    });
    const reviewing = buildProviderPackProgress({
      packId: "toast-ui-grid",
      packStatus: "REVIEWING",
      name: "TOAST UI Grid",
      categoryId: "ui",
      shortDescription: "short",
      description: "desc",
      language: "en",
      workingVersion: {
        id: "v2",
        version: "1.0.0",
        sourceDocumentCount: 2,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });

    assert.equal(published.currentStep, "PUBLISHED");
    assert.ok(published.actions.some((a) => a.label === "공개 정보 관리"));
    assert.ok(published.actions.some((a) => a.label === "사용 통계 보기"));
    assert.equal(reviewing.currentStep, "REVIEWING");
    assert.ok(reviewing.actions.some((a) => a.label === "검수 상태 보기"));

    const summary = buildProviderPacksStatusSummary([
      { status: "PUBLISHED" },
      { status: "REVIEWING" },
      {
        status: "DRAFT",
        storeWorkflowStatus: "PROVIDER_REVIEW_REQUESTED",
        providerReviewPhase: "REQUESTED",
      },
    ]);
    assert.equal(summary.total, 3);
    assert.equal(summary.published, 1);
    assert.equal(summary.reviewing, 1);
    assert.equal(summary.providerReviewRequested, 1);
    assert.equal(summary.draft, 0);
  });

  it("separates published version from working draft version", () => {
    const progress = buildProviderPackProgress({
      packId: "pack-a",
      packStatus: "PUBLISHED",
      name: "Pack A",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      workingVersion: {
        id: "v2",
        version: "0.2.0",
        sourceDocumentCount: 0,
        materialReady: false,
        distributionReady: false,
      },
      publishedVersion: { id: "v1", version: "0.1.0" },
    });

    assert.equal(progress.publishedVersion?.version, "0.1.0");
    assert.equal(progress.workingVersion?.version, "0.2.0");
    assert.equal(progress.currentStep, "SOURCE_MATERIALS");
    assert.equal(progress.currentStepLabel, "자료 등록");
  });

  it("uses 자료 등록 label instead of Payload 등록", () => {
    const progress = buildProviderPackProgress({
      packId: "draft-1",
      packStatus: "DRAFT",
      name: "Draft",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 0,
        materialReady: false,
        distributionReady: false,
      },
      publishedVersion: null,
    });
    assert.ok(progress.steps.some((s) => s.label === "자료 등록"));
    assert.ok(!progress.steps.some((s) => s.label.includes("Payload")));
  });

  it("does not push 자료등록 when materials already exist but basic info is incomplete", () => {
    const progress = buildProviderPackProgress({
      packId: "rmate",
      packStatus: "DRAFT",
      name: "리아모어",
      categoryId: "ui",
      shortDescription: "short enough",
      description: "long enough description text here",
      language: null,
      workingVersion: {
        id: "v1",
        version: "v6.0",
        sourceDocumentCount: 273,
        materialReady: true,
        structureReady: true,
        searchFoundationReady: true,
        searchValidationReady: false,
        distributionReady: false,
        pipelineCurrent: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.currentStep, "BASIC_INFO");
    assert.ok(progress.actions.some((a) => a.label === "기본정보 완성"));
    assert.ok(!progress.actions.some((a) => a.label === "자료등록"));
    assert.ok(!progress.actions.some((a) => a.label === "계속 작성"));
  });

  it("hides draft CTAs while admin hold is active (리아모어 regression)", () => {
    const progress = buildProviderPackProgress({
      packId: "rmate",
      packStatus: "DRAFT",
      name: "리아모어",
      categoryId: "ui",
      shortDescription: "short enough",
      description: "long enough description text here",
      language: "ko",
      adminGenerationHold: "COMPLETED",
      workerZipRequestStatus: "COMPLETED",
      workingVersion: {
        id: "v1",
        version: "v6.0",
        sourceDocumentCount: 273,
        materialReady: true,
        structureReady: true,
        searchFoundationReady: true,
        searchValidationReady: false,
        distributionReady: false,
        pipelineCurrent: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.storeWorkflowStatus, "KNOWLEDGE_GENERATED");
    assert.ok(progress.actions.some((a) => a.label === "처리 상태 보기"));
    assert.ok(!progress.actions.some((a) => a.label === "계속 작성"));
    assert.ok(!progress.actions.some((a) => a.label === "자료등록"));
    assert.ok(!progress.actions.some((a) => a.label === "검수 요청"));
  });

  it("shows 생성 결과 검토 when provider review is requested", () => {
    const progress = buildProviderPackProgress({
      packId: "pack-1",
      packStatus: "DRAFT",
      name: "Pack",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      adminGenerationHold: "COMPLETED",
      workerZipRequestStatus: "COMPLETED",
      providerReviewPhase: "REQUESTED",
      adminQualityPassed: true,
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 2,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.storeWorkflowStatus, "PROVIDER_REVIEW_REQUESTED");
    assert.equal(progress.currentStepLabel, "검토 요청");
    assert.equal(progress.actions[0]?.label, "검토하기");
    assert.ok(progress.actions.some((a) => a.label === "검토하기"));
    assert.ok(!progress.actions.some((a) => a.label === "확인 완료"));
    assert.ok(!progress.actions.some((a) => a.label === "생성 결과 검토"));
    assert.ok(!progress.actions.some((a) => a.label === "계속 작성"));
    assert.ok(!progress.actions.some((a) => a.label === "상세 검토하기"));
  });

  it("shows 검수 상태 보기 after provider confirm", () => {
    const progress = buildProviderPackProgress({
      packId: "pack-1",
      packStatus: "DRAFT",
      name: "Pack",
      categoryId: "cat",
      shortDescription: "short",
      description: "desc",
      language: "ko",
      providerReviewPhase: "CONFIRMED",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 2,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.equal(progress.storeWorkflowStatus, "SERVICE_VALIDATING");
    assert.ok(progress.actions.some((a) => a.label === "검수 상태 보기"));
    assert.ok(!progress.actions.some((a) => a.label === "자료등록"));
  });

  it("maps pack-scoped onboarding steps through facade", () => {
    const steps = buildProviderOnboardingSteps({
      hasProfile: true,
      packCount: 1,
      sourceDocumentCount: 0,
      hasReviewingPack: false,
      hasPublishedOrVerifiedPack: false,
      packScoped: {
        packId: "draft-1",
        packStatus: "DRAFT",
        name: "Draft",
        categoryId: "cat",
        shortDescription: "short",
        description: "desc",
        language: "ko",
        workingVersion: {
          id: "v1",
          version: "0.1.0",
          sourceDocumentCount: 0,
          materialReady: false,
          distributionReady: false,
        },
        publishedVersion: null,
      },
    });
    assert.equal(steps.find((s) => s.key === "payload")?.title, "자료 등록");
    assert.equal(steps.find((s) => s.key === "payload")?.status, "current");
  });
});

describe("provider center pack progress UX sources", () => {
  it("removes global stepper and first-pack detail fetch", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("ProviderOnboardingStepper"));
    assert.ok(!center.includes("buildProviderOnboardingSteps"));
    assert.ok(!center.includes("fetchProviderPack("));
    assert.ok(!center.includes("primary"));
    assert.ok(center.includes("summary") || center.includes("현황"));
    assert.ok(center.includes("currentStepLabel") || center.includes("progress"));
  });

  it("does not mount pack-scoped stepper on pack detail editor", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(!editor.includes("ProviderPackProgressStepper"));
    assert.ok(editor.includes("buildProviderPackProgress"));
  });

  it("enriches list API with summary without N+1 client calls", () => {
    const route = readSource("src/app/api/v1/provider/packs/route.ts");
    const service = readSource("src/lib/provider-pack/provider-pack-query-service.ts");
    assert.ok(route.includes("summary"));
    assert.ok(service.includes("buildProviderPackProgress"));
    assert.ok(service.includes("buildProviderPacksStatusSummary"));
  });

  it("keeps review inbox without center banners for review/wait alerts", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    const reviewsPage = readSource("src/app/(store)/provider/reviews/page.tsx");
    assert.ok(center.includes("검토대상") || center.includes("검토 요청"));
    assert.ok(center.includes("providerReviewRequested"));
    // Center page must not show the amber review/wait alert banners.
    assert.ok(!center.includes("할 일 / 대기 알림"));
    assert.ok(!center.includes("aria-label=\"검토대상 작업함\""));
    assert.ok(!center.includes("관리자 검수 결과를 기다려 주세요."));
    assert.ok(!center.includes("생성·품질점검한 지식데이터를 검토해 주세요."));
    assert.ok(center.includes("검토하기") || center.includes("ProviderReviewTargetCard"));
    assert.ok(center.includes('variant === "reviewInbox"') || center.includes("reviewInbox"));
    assert.ok(reviewsPage.includes('variant="reviewInbox"'));
    assert.ok(reviewsPage.includes('initialFilter="providerReviewRequested"'));
    // Review inbox must stay a pure list — no status dashboard / register chrome.
    assert.ok(center.includes("!reviewInbox"));
    assert.ok(center.includes("ProviderReviewTargetCard"));
    const inboxCard = readSource("src/components/ProviderReviewTargetCard.tsx");
    assert.ok(inboxCard.includes("검토하기"));
    assert.ok(inboxCard.includes("ProviderGenerationReviewPanel"));
    assert.ok(!inboxCard.includes("상세 검토하기"));
  });

  it("keeps confirm and request-changes actions on generation review detail panel", () => {
    const panel = readSource("src/components/ProviderGenerationReviewPanel.tsx");
    assert.ok(panel.includes("확인 완료"));
    assert.ok(panel.includes("보완 요청 작성"));
    assert.ok(panel.includes("다운로드"));
    assert.ok(panel.includes("생성결과 내역"));
    assert.ok(panel.includes("buildProviderGenerationReviewMarkdown"));
    assert.ok(panel.includes("<table"));
    assert.ok(panel.includes("formatProviderReviewQualityLabel"));
    assert.ok(panel.includes("confirmProviderStoreReviewApi"));
    assert.ok(panel.includes("IssueAlertIcon") || panel.includes("이슈"));
    assert.ok(panel.includes("openIssueModal") || panel.includes("issueModalDocId"));
    assert.ok(panel.includes('role="dialog"') || panel.includes("aria-modal"));
    assert.ok(panel.includes("이슈 상세"));
    assert.ok(!panel.includes("품질점검 이슈"));
    assert.ok(panel.includes("blockingFail"));
    assert.ok(panel.includes("주의 필요 항목이 남아 있습니다"));
    assert.ok(panel.includes("원문과 생성 데이터를 확인한 뒤"));
    assert.ok(!panel.includes('"WARNING"'));
    assert.ok(panel.includes("검색 지식 단위 검토"));
    assert.ok(panel.includes("상세 검토"));
    assert.ok(panel.includes("DetailReviewIcon"));
    assert.ok(panel.includes("보완 요청에 추가"));
    assert.ok(panel.includes("chunkAttentionReviewed"));
    assert.ok(panel.includes("setChunkReviewExpanded"));
    assert.ok(panel.includes("toggleChunkSort"));
    assert.ok(panel.includes("chunkFilterCounts"));
    assert.ok(panel.includes("selectedChunkIds"));
    assert.ok(panel.includes("downloadProviderChunkReviewPdf"));
    assert.ok(panel.includes("PDF 저장"));
    assert.ok(panel.includes("순번"));
    assert.ok(panel.includes("ChevronIcon"));
    assert.ok(!panel.includes("Chunk 샘플"));
    assert.ok(!panel.includes("청킹 확인 필요"));
    assert.ok(!panel.includes('font-semibold">조치'));
    assert.ok(panel.includes("PROVIDER_CHUNK_REVIEW_CHECKLIST"));
    assert.ok(panel.includes("fetchProviderChunkReviewDetailApi"));
  });
});
