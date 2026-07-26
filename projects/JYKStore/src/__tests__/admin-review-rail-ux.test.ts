import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS,
  buildAdminQualityGateSnapshot,
  getAdminReviewRailState,
} from "../lib/role-workspace/admin-review-rail.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin review rail UX (workbench 5-stage)", () => {
  it("exposes one 생성·품질보정 and one 승인·게시 display label", () => {
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
    assert.equal(labels.filter((l) => l === "생성·품질보정").length, 1);
    assert.equal(labels.filter((l) => l === "승인·게시").length, 1);
    assert.equal(labels.length, 5);
  });

  it("treats generation and quality as the same active display stage", () => {
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
    const genItem = onGen.items.find((i) => i.id === "generation");
    const qualityItem = onQuality.items.find((i) => i.id === "generation");
    assert.equal(genItem?.label, "생성·품질보정");
    assert.equal(qualityItem?.label, "생성·품질보정");
    assert.equal(genItem?.status, "current");
    assert.equal(qualityItem?.status, "current");
    assert.ok(!onQuality.items.some((i) => i.id === "quality"));
  });

  it("keeps COMPLETED + quality blockers on 생성·품질보정 (not provider)", () => {
    const quality = {
      ...buildAdminQualityGateSnapshot(null),
      completed: true,
      hasBlockers: true,
      failCount: 1,
      blockers: ["청킹 품질 FAIL"],
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
    assert.equal(rail.currentStep, "quality");
    const gen = rail.items.find((i) => i.id === "generation");
    const provider = rail.items.find((i) => i.id === "providerConfirm");
    assert.equal(gen?.status, "current");
    assert.equal(provider?.status, "blocked");
  });

  it("preserves internal step query ids for deep links", () => {
    assert.deepEqual([...ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS], [
      "queue",
      "generation",
      "quality",
      "providerConfirm",
      "searchValidation",
      "decision",
      "publish",
    ]);
    const railSrc = readSource("src/lib/role-workspace/admin-review-rail.ts");
    for (const step of ADMIN_REVIEW_COMPAT_STEP_QUERY_IDS) {
      assert.ok(railSrc.includes(`"${step}"`) || railSrc.includes(`?step=${step}`));
    }
  });
});
