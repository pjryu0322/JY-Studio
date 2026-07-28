import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS,
  buildAdminQualityGateSnapshot,
  getAdminConsoleRailItems,
  getAdminReviewRailState,
} from "../lib/role-workspace/admin-review-rail.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

const qualityOk = {
  ...buildAdminQualityGateSnapshot(null),
  completed: true,
  hasBlockers: false,
  failCount: 0,
  hasWarnings: false,
  blockers: [] as string[],
  warnings: [] as string[],
};

describe("admin review rail UX (P2 6-step workflow)", () => {
  it("exposes exactly 6 fabrication rail labels", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "generation",
    });
    const labels = rail.items.map((i) => i.label);
    assert.deepEqual(labels, [
      "자료 접수",
      "지식화 대상 확인",
      "지식데이터 생성",
      "보정",
      "서비스 검증",
      "게시",
    ]);
    assert.ok(!labels.includes("점검"));
    assert.ok(!labels.includes("제공자 검토"));
    assert.ok(!labels.includes("승인·게시"));
    assert.ok(!labels.includes("공개/운영"));
  });

  it("does not treat quality as an independent rail step", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "generation",
    });
    assert.ok(!rail.items.some((i) => i.id === "quality"));
    assert.equal(rail.items.find((i) => i.id === "generation")?.status, "current");
  });

  it("routes COMPLETED + quality blockers to 보정", () => {
    const quality = {
      ...buildAdminQualityGateSnapshot(null),
      completed: true,
      hasBlockers: true,
      failCount: 1,
      blockers: ["fail"],
    };
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "correction",
    });
    assert.equal(rail.currentStep, "correction");
  });

  it("preserves canonical step ids (legacy mapped via resolveAdminWorkflowStepQuery)", () => {
    assert.deepEqual([...ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS], [
      "receipt",
      "knowledgeScope",
      "generation",
      "correction",
      "serviceValidation",
      "publish",
    ]);
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes('activeStep === "correction"'));
  });

  it("defaults REQUESTED worker zip to receipt", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "REQUESTED",
      quality: buildAdminQualityGateSnapshot(null),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "receipt",
    });
    assert.equal(rail.currentStep, "receipt");
  });

  it("exposes console rail with P2 queues; never emits legacy queue keys", () => {
    const items = getAdminConsoleRailItems("generation");
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("자료 접수"));
    assert.ok(labels.includes("지식화 대상 확인"));
    assert.ok(labels.includes("지식데이터 생성"));
    assert.ok(labels.includes("보정"));
    assert.ok(labels.includes("서비스 검증"));
    assert.ok(labels.includes("게시"));
    assert.ok(!labels.includes("점검"));
    assert.ok(!labels.includes("제공자 검토"));
    assert.ok(!labels.includes("승인·게시"));
    assert.ok(!labels.includes("공개/운영"));
    for (const item of items) {
      assert.ok(item.href);
      assert.ok(!item.href.includes("queue=accept"));
      assert.ok(!item.href.includes("queue=quality"));
      assert.ok(!item.href.includes("queue=provider-review"));
      assert.ok(!item.href.includes("queue=approval-publish"));
    }
    assert.ok(items.some((i) => i.href!.includes("queue=receipt")));
    assert.ok(items.some((i) => i.href!.includes("queue=knowledge-scope")));
    assert.ok(items.some((i) => i.href!.includes("queue=generation")));
    assert.ok(items.some((i) => i.href!.includes("queue=correction")));
    assert.ok(items.some((i) => i.href!.includes("queue=service-validation")));
    assert.ok(items.some((i) => i.href!.includes("queue=publish")));
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    assert.ok(rail.includes("getAdminOpsNavItem"));
    assert.ok(rail.includes('label: "공개/운영"'));
    const routes = readSource("src/lib/routes.ts");
    assert.ok(routes.includes('adminQueuePath("receipt")'));
    assert.ok(routes.includes('adminQueuePath("knowledge-scope")'));
    assert.ok(routes.includes('adminQueuePath("publish")'));
    assert.ok(!routes.includes('adminQueuePath("accept")'));
    assert.ok(!routes.includes('adminQueuePath("quality")'));
    assert.ok(!routes.includes('adminQueuePath("provider-review")'));
  });

  it("does not render the inline 현재/다음 단계 pill card on review detail", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!detail.includes('aria-label="검수 단계"'));
    assert.ok(!detail.includes("현재 단계:"));
    assert.ok(detail.includes('activeStep === "correction"'));
    assert.ok(detail.includes('workbenchMode="generation"'));
  });

  it("wires RoleRailIcon and correction CTAs", () => {
    const icon = readSource("src/components/role-workspace/RoleRailIcon.tsx");
    const quality = readSource("src/components/AdminQualityCheckPanel.tsx");
    const correction = readSource("src/components/AdminKnowledgeCorrectionPanel.tsx");
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const card = readSource("src/components/AdminWorkerZipGenerationCard.tsx");
    assert.ok(icon.includes('case "correction"'));
    assert.ok(icon.includes('case "generation"'));
    assert.ok(icon.includes('case "receipt"') || icon.includes('case "queue"'));
    assert.ok(quality.includes("onGoCorrection"));
    assert.ok(card.includes("완료취소"));
    assert.ok(card.includes("onAcknowledgeQualityReview"));
    assert.ok(correction.includes("보정 큐"));
    assert.ok(detail.includes("showCorrection"));
    assert.ok(detail.includes("AdminKnowledgeCorrectionPanel"));
    assert.ok(detail.includes("onGoCorrection={() => goStep(\"correction\")}"));
  });

  it("marks correction when quality blockers exist and blocks later stages", () => {
    const quality = {
      ...buildAdminQualityGateSnapshot(null),
      completed: true,
      hasBlockers: true,
      failCount: 1,
      blockers: ["fail"],
    };
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "correction",
    });
    const correction = rail.items.find((i) => i.id === "correction");
    assert.ok(correction);
    assert.ok(correction.status === "current" || correction.status === "warning" || correction.status === "next");
    const service = rail.items.find((i) => i.id === "serviceValidation");
    assert.ok(service);
    assert.equal(service.status, "blocked");
  });

  it("routes clean COMPLETED quality to serviceValidation before provider review", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: qualityOk,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "serviceValidation",
    });
    assert.equal(rail.currentStep, "serviceValidation");
    assert.ok(!rail.items.some((i) => i.id === "providerConfirm"));
  });
});
