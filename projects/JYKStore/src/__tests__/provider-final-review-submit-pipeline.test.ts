import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildProviderReviewSubmitSnapshot } from "../lib/provider-review-submit-snapshot.ts";
import { ADMIN_REVIEW_CTA_REFRESH_ALL } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider final review submit pipeline", () => {
  it("runs ordered final preparation before REVIEWING", () => {
    const service = readSource("src/lib/auto-pipeline/provider-final-review-submit-service.ts");
    const submit = readSource("src/lib/provider-pack-service.ts");

    assert.ok(service.includes("validateAllSourceDocumentsForPack"));
    assert.ok(service.includes("await evaluatePackStructureQuality"));
    assert.ok(service.includes("await regenerateAutoChunksForPack"));
    assert.ok(service.includes("await evaluatePackChunkQuality"));
    assert.ok(service.includes("await generateRetrievalEvaluationCasesForPack"));
    assert.ok(service.includes("await runRetrievalEvaluationForPack"));
    assert.ok(service.includes("await evaluateReleaseGateForPack"));

    const structureIdx = service.indexOf("await evaluatePackStructureQuality");
    const chunkIdx = service.indexOf("await evaluatePackChunkQuality");
    const casesIdx = service.indexOf("await generateRetrievalEvaluationCasesForPack");
    const runIdx = service.indexOf("await runRetrievalEvaluationForPack");
    const gateIdx = service.indexOf("await evaluateReleaseGateForPack");
    assert.ok(structureIdx > 0 && chunkIdx > structureIdx);
    assert.ok(casesIdx > chunkIdx && runIdx > casesIdx && gateIdx > runIdx);

    assert.ok(submit.includes("prepareProviderPackForFinalReviewSubmit"));
    assert.ok(submit.includes("buildProviderReviewSubmitSnapshot"));
    assert.ok(submit.includes("submitSnapshot"));
  });

  it("blocks submit when release gate fails in preparation", () => {
    const service = readSource("src/lib/auto-pipeline/provider-final-review-submit-service.ts");
    assert.ok(service.includes('blockingStage: "release_gate"'));
    assert.ok(service.includes("릴리스 게이트가 FAIL"));
    assert.ok(service.includes('blockingStage: "retrieval_evaluation"'));
  });
});

describe("provider submit readiness release gate", () => {
  it("requires release gate step in readiness plan source", () => {
    const steps = readSource("src/lib/provider-submit-readiness-steps.ts");
    assert.ok(steps.includes('"release_gate"'));
    assert.ok(steps.includes("meetsReleaseGateSubmitGate"));
    assert.ok(steps.includes("릴리스 게이트 사전 점검"));
    assert.ok(steps.includes("QUALITY_STEP_COUNT = 5"));
  });
});

describe("admin review submitted snapshot", () => {
  it("stores and surfaces submit snapshot", () => {
    const snapshot = buildProviderReviewSubmitSnapshot({
      sourceDocumentIds: ["d1"],
      activeChunkIds: ["c1", "c2"],
      releaseGateRunId: "rg1",
      releaseGateStatus: "PASS",
      retrievalEvaluationRunId: "run1",
      warnings: [],
    });
    assert.equal(snapshot.sourceDocumentCount, 1);
    assert.equal(snapshot.activeChunkCount, 2);
    assert.ok(snapshot.submittedAt);

    const dto = readSource("src/lib/admin-review-dto.ts");
    const summary = readSource("src/components/AdminReviewInspectionSummary.tsx");
    assert.ok(dto.includes("submitSnapshot"));
    assert.ok(dto.includes("parseProviderReviewSubmitSnapshot"));
    assert.ok(summary.includes("ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE"));
    assert.equal(ADMIN_REVIEW_CTA_REFRESH_ALL, "고급: 최신 상태로 재점검");
  });
});
