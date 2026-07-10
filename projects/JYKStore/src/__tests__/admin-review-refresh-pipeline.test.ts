import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ADMIN_REVIEW_CTA_REFRESH_ALL } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin review refresh pipeline", () => {
  it("exposes review-refresh route and ordered pipeline steps", () => {
    const route = readSource("src/app/api/v1/admin/packs/[packId]/review-refresh/route.ts");
    const service = readSource("src/lib/admin-review-refresh-service.ts");
    const api = readSource("src/lib/admin-review-api.ts");

    assert.ok(route.includes("rejectUnlessAdmin"));
    assert.ok(route.includes("refreshAdminReviewReadiness"));
    assert.ok(service.includes("validateAllSourceDocumentsForPack"));
    assert.ok(service.includes("evaluatePackStructureQuality"));
    assert.ok(service.includes("evaluatePackChunkQuality"));
    assert.ok(service.includes("generateRetrievalEvaluationCasesForPack"));
    assert.ok(service.includes("runRetrievalEvaluationForPack"));
    assert.ok(service.includes("evaluateReleaseGateForPack"));

    const structureIdx = service.indexOf("await evaluatePackStructureQuality");
    const chunkIdx = service.indexOf("await evaluatePackChunkQuality");
    const casesIdx = service.indexOf("await generateRetrievalEvaluationCasesForPack");
    const runIdx = service.indexOf("await runRetrievalEvaluationForPack");
    const gateIdx = service.indexOf("await evaluateReleaseGateForPack");
    assert.ok(structureIdx > 0 && chunkIdx > structureIdx);
    assert.ok(casesIdx > chunkIdx && runIdx > casesIdx && gateIdx > runIdx);

    assert.ok(api.includes("refreshAdminReviewReadinessApi"));
    assert.ok(api.includes("/review-refresh"));
  });

  it("surfaces full refresh CTA copy for stale review state", () => {
    const decision = readSource("src/components/AdminReviewDecisionSummary.tsx");
    assert.equal(ADMIN_REVIEW_CTA_REFRESH_ALL, "현재 데이터 기준 전체 재점검");
    assert.ok(decision.includes("ADMIN_REVIEW_CTA_REFRESH_ALL"));
    assert.ok(decision.includes("ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE"));
    assert.ok(decision.includes('busy === "refresh"'));
    assert.ok(decision.includes("전체 재점검에 실패했습니다"));
  });
});
