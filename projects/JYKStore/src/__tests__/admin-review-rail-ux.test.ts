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

describe("admin review rail UX (workbench stages)", () => {
  it("exposes independent 생성 / 점검 / 보정 rail labels", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality: buildAdminQualityGateSnapshot(null),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "quality",
    });
    const labels = rail.items.filter((i) => i.id !== "ops").map((i) => i.label);
    assert.deepEqual(labels, [
      "자료 접수",
      "생성",
      "점검",
      "보정",
      "제공자 검토",
      "서비스 검증",
      "승인·게시",
    ]);
    assert.ok(!labels.includes("생성·품질보정"));
  });

  it("keeps generation and quality as separate active stages", () => {
    const base = {
      packId: "p1",
      workerZipPhase: "COMPLETED" as const,
      quality: buildAdminQualityGateSnapshot(null),
      providerReviewPhase: "NONE" as const,
      serviceValidationPhase: "NONE" as const,
      detail: null,
    };
    const onGen = getAdminReviewRailState({ ...base, activeStep: "generation" });
    const onQuality = getAdminReviewRailState({ ...base, activeStep: "quality" });
    assert.equal(onGen.items.find((i) => i.id === "generation")?.status, "current");
    assert.equal(onQuality.items.find((i) => i.id === "quality")?.status, "current");
    assert.notEqual(
      onGen.items.find((i) => i.id === "generation")?.label,
      onQuality.items.find((i) => i.id === "quality")?.label,
    );
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

  it("preserves internal step query ids for deep links including correction", () => {
    assert.deepEqual([...ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS], [
      "queue",
      "generation",
      "quality",
      "correction",
      "providerConfirm",
      "searchValidation",
      "decision",
      "publish",
    ]);
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(detail.includes('case "correction"'));
  });

  it("defaults REQUESTED worker zip to queue (not generation)", () => {
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "REQUESTED",
      quality: buildAdminQualityGateSnapshot(null),
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "queue",
    });
    assert.equal(rail.currentStep, "queue");
  });

  it("exposes console rail with 지식데이터 접수 and split stage queues", () => {
    const items = getAdminConsoleRailItems("generation");
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("지식데이터 접수"));
    assert.ok(labels.includes("지식데이터 생성"));
    assert.ok(labels.includes("점검"));
    assert.ok(labels.includes("보정"));
    assert.ok(labels.includes("제공자 검토"));
    assert.ok(labels.includes("서비스 검증"));
    assert.ok(labels.includes("승인·게시"));
    assert.ok(labels.includes("공개/운영"));
    assert.ok(!labels.includes("자료 접수"));
    assert.ok(!labels.includes("생성·품질보정"));
    assert.ok(items.some((i) => i.href.includes("queue=accept")));
    assert.ok(items.some((i) => i.href.includes("queue=generation")));
    assert.ok(items.some((i) => i.href.includes("queue=quality")));
    assert.ok(items.some((i) => i.href.includes("queue=correction")));
  });

  it("does not render the inline 현재/다음 단계 pill card on review detail", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!detail.includes('aria-label="검수 단계"'));
    assert.ok(!detail.includes("현재 단계:"));
    assert.ok(detail.includes('activeStep === "correction"'));
    assert.ok(detail.includes('workbenchMode="generation"'));
    assert.ok(detail.includes('workbenchMode="quality"'));
  });

  it("wires RoleRailIcon correction and quality→correction CTAs", () => {
    const icon = readSource("src/components/role-workspace/RoleRailIcon.tsx");
    const quality = readSource("src/components/AdminQualityCheckPanel.tsx");
    const correction = readSource("src/components/AdminKnowledgeCorrectionPanel.tsx");
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const card = readSource("src/components/AdminWorkerZipGenerationCard.tsx");
    assert.ok(icon.includes('case "correction"'));
    assert.ok(icon.includes('case "generation"'));
    assert.ok(icon.includes('case "quality"'));
    assert.ok(quality.includes("onGoCorrection"));
    assert.ok(card.includes("완료취소"));
    assert.ok(card.includes("onAcknowledgeQualityReview"));
    assert.ok(correction.includes("보정 큐"));
    assert.ok(correction.includes("미리보기"));
    assert.ok(correction.includes("보정 액션"));
    assert.ok(correction.includes("부모 지식단위와 병합"));
    assert.ok(detail.includes("showCorrection"));
    assert.ok(detail.includes("AdminKnowledgeCorrectionPanel"));
    assert.ok(detail.includes('step=correction') || detail.includes('"correction"'));
    assert.ok(detail.includes("onGoCorrection={() => goStep(\"correction\")}"));
  });

  it("marks correction warning/current when quality blockers exist and blocks later stages", () => {
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
    assert.ok(correction.status === "current" || correction.status === "warning");
    assert.equal(rail.items.find((i) => i.id === "providerConfirm")?.status, "blocked");
    assert.equal(rail.items.find((i) => i.id === "searchValidation")?.status, "blocked");
    assert.equal(rail.items.find((i) => i.id === "decision")?.status, "blocked");
  });

  it("routes COMPLETED + quality pass to 제공자 검토 as next", () => {
    const quality = {
      ...buildAdminQualityGateSnapshot(null),
      completed: true,
      hasBlockers: false,
      hasWarnings: false,
      failCount: 0,
      blockers: [],
      warnings: [],
    };
    const rail = getAdminReviewRailState({
      packId: "p1",
      workerZipPhase: "COMPLETED",
      quality,
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      detail: null,
      activeStep: "quality",
    });
    assert.equal(rail.currentStep, "providerConfirm");
    assert.equal(rail.items.find((i) => i.id === "providerConfirm")?.status, "next");
  });
});
