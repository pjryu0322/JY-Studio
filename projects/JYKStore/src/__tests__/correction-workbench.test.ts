import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableActionsForTarget,
  buildWorkbenchSummary,
  nextWorkForCase,
} from "@/lib/correction/correction-mapper";
import { CorrectionServiceError } from "@/lib/correction/correction-types";

describe("correction-mapper", () => {
  it("exposes FILE/STRUCTURE/CHUNK actions only (no split/label)", () => {
    assert.deepEqual(availableActionsForTarget("FILE"), [
      "FILE_EXCLUDE",
      "FILE_REQUEST_PROVIDER",
    ]);
    assert.deepEqual(availableActionsForTarget("STRUCTURE"), [
      "STRUCTURE_DELETE",
      "STRUCTURE_MERGE",
    ]);
    assert.deepEqual(availableActionsForTarget("CHUNK"), ["CHUNK_DELETE", "CHUNK_MERGE"]);
    const all = [
      ...availableActionsForTarget("FILE"),
      ...availableActionsForTarget("STRUCTURE"),
      ...availableActionsForTarget("CHUNK"),
    ].join(",");
    assert.ok(!all.includes("SPLIT"));
    assert.ok(!all.includes("LABEL"));
  });

  it("maps status to next work labels", () => {
    assert.equal(nextWorkForCase("OPEN"), "보정 액션 적용");
    assert.equal(nextWorkForCase("APPLIED"), "재생성 실행");
    assert.equal(nextWorkForCase("REGENERATED"), "품질·Outcome 확인 후 검증");
    assert.equal(nextWorkForCase("VERIFIED"), "케이스 종료");
    assert.equal(nextWorkForCase("CLOSED"), "완료");
  });

  it("builds workbench summary counts and next work", () => {
    const now = new Date();
    const summary = buildWorkbenchSummary({
      packId: "pack-1",
      versionId: "ver-1",
      cases: [
        {
          id: "c1",
          packId: "pack-1",
          versionId: "ver-1",
          targetType: "FILE",
          targetId: "t1",
          secondaryTargetId: null,
          issueCode: null,
          severity: "BLOCKER",
          title: "a",
          description: "a",
          sourceLocation: null,
          contentPreview: null,
          recommendedAction: "FILE_EXCLUDE",
          status: "OPEN",
          generationRunId: null,
          searchIndexGenerationId: null,
          inventoryItemId: null,
          relativePath: null,
          parameters: null,
          appliedAt: null,
          appliedByUserId: null,
          regeneratedAt: null,
          verifiedAt: null,
          closedAt: null,
          closedByUserId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "c2",
          packId: "pack-1",
          versionId: "ver-1",
          targetType: "CHUNK",
          targetId: "t2",
          secondaryTargetId: null,
          issueCode: null,
          severity: "WARNING",
          title: "b",
          description: "b",
          sourceLocation: null,
          contentPreview: null,
          recommendedAction: "CHUNK_DELETE",
          status: "APPLIED",
          generationRunId: null,
          searchIndexGenerationId: null,
          inventoryItemId: null,
          relativePath: null,
          parameters: null,
          appliedAt: now,
          appliedByUserId: "u1",
          regeneratedAt: null,
          verifiedAt: null,
          closedAt: null,
          closedByUserId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    assert.equal(summary.openCount, 1);
    assert.equal(summary.appliedCount, 1);
    assert.equal(summary.blockerCount, 1);
    assert.equal(summary.warningCount, 1);
    assert.equal(summary.currentStatus, "보정 대기");
    assert.match(summary.nextWork, /보정 액션/);
  });
});

describe("CorrectionServiceError", () => {
  it("carries code and http status", () => {
    const err = new CorrectionServiceError("CASE_NOT_FOUND", "missing", 404);
    assert.equal(err.code, "CASE_NOT_FOUND");
    assert.equal(err.httpStatus, 404);
  });
});
