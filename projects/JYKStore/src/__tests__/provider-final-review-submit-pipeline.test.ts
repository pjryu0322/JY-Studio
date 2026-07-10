import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

  it("blocks immediately when chunk regeneration fails", () => {
    const service = readSource("src/lib/auto-pipeline/provider-final-review-submit-service.ts");
    const regenIdx = service.indexOf("await regenerateAutoChunksForPack");
    const errorBlockIdx = service.indexOf('if ("error" in chunks)');
    const qualityIdx = service.indexOf("await evaluatePackChunkQuality");
    assert.ok(regenIdx > 0 && errorBlockIdx > regenIdx && qualityIdx > errorBlockIdx);
    assert.ok(service.includes('blockingStage: "chunk_quality"'));
    assert.ok(service.includes("검수용 Chunk가 생성되지 않아 제출할 수 없습니다."));
  });

  it("scopes snapshot to latest submitted version", () => {
    const service = readSource("src/lib/auto-pipeline/provider-final-review-submit-service.ts");
    assert.ok(service.includes("submittedVersionId"));
    assert.ok(service.includes("pack.versions[0]"));
    assert.ok(service.includes("where: { versionId: submittedVersionId }"));
  });
});

describe("provider submit readiness release gate", () => {
  it("requires release gate step in readiness plan source", () => {
    const steps = readSource("src/lib/provider-submit-readiness-steps.ts");
    assert.ok(steps.includes('"release_gate"'));
    assert.ok(steps.includes("meetsReleaseGateSubmitGate"));
    assert.ok(steps.includes("릴리스 게이트 사전 점검"));
    assert.ok(steps.includes("QUALITY_STEP_COUNT = 5"));
    assert.ok(steps.includes("requiresFinalGateOnSubmit"));
  });
});

describe("admin review submitted snapshot", () => {
  it("stores and surfaces submit snapshot", () => {
    const snapshot = buildProviderReviewSubmitSnapshot({
      submittedVersionId: "v-latest",
      sourceDocumentIds: ["d1"],
      activeChunkIds: ["c1", "c2"],
      releaseGateRunId: "rg1",
      releaseGateStatus: "PASS",
      retrievalEvaluationRunId: "run1",
      warnings: [],
    });
    assert.equal(snapshot.sourceDocumentCount, 1);
    assert.equal(snapshot.activeChunkCount, 2);
    assert.equal(snapshot.submittedVersionId, "v-latest");
    assert.ok(snapshot.submittedAt);

    const dto = readSource("src/lib/admin-review-dto.ts");
    const packageTab = readSource("src/components/AdminReviewPackageSnapshotTab.tsx");
    assert.ok(dto.includes("submitSnapshot"));
    assert.ok(dto.includes("parseProviderReviewSubmitSnapshot"));
    assert.ok(packageTab.includes("ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE"));
    assert.equal(ADMIN_REVIEW_CTA_REFRESH_ALL, "현재 데이터 기준 전체 재점검");
  });

  it("has prisma migration for PackReview.submitSnapshot", () => {
    const schema = readSource("prisma/schema.prisma");
    assert.ok(schema.includes("submitSnapshot"));
    const migrationDir = join(
      projectRoot,
      "prisma",
      "migrations",
      "20260710210000_add_pack_review_submit_snapshot",
    );
    assert.ok(existsSync(migrationDir));
    const sql = readFileSync(join(migrationDir, "migration.sql"), "utf8");
    assert.ok(sql.includes('"submitSnapshot"'));
    assert.ok(sql.includes("PackReview"));
  });
});
