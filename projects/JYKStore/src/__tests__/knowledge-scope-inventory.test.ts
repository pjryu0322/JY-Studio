import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyInventoryAutoDecision,
  isSafetyBlockedOverride,
  previewKindForExtension,
} from "@/lib/knowledge-scope/inventory-auto-exclude";
import {
  canFinalizeKnowledgeScope,
  isKnowledgeScopeReadyForGeneration,
  toKnowledgeScopeGateSummary,
} from "@/lib/knowledge-scope/inventory-gate";
import {
  buildWorkerInputManifestFromItems,
  listIncludedRelativePaths,
  mergeAdminExcludePaths,
} from "@/lib/knowledge-scope/inventory-worker-manifest";

describe("inventory auto-exclude", () => {
  it("excludes zero-byte files as ZERO_BYTE", () => {
    const result = classifyInventoryAutoDecision({
      relativePath: "docs/empty.txt",
      fileName: "empty.txt",
      extension: ".txt",
      sizeBytes: 0,
    });
    assert.equal(result.decision, "EXCLUDED");
    assert.equal(result.decisionSource, "SYSTEM");
    assert.equal(result.exclusionReasonCode, "ZERO_BYTE");
    assert.equal(result.overrideAllowed, false);
    assert.equal(isSafetyBlockedOverride("ZERO_BYTE"), true);
  });

  it("excludes executables", () => {
    const result = classifyInventoryAutoDecision({
      relativePath: "bin/tool.exe",
      fileName: "tool.exe",
      extension: ".exe",
      sizeBytes: 100,
    });
    assert.equal(result.decision, "EXCLUDED");
    assert.equal(result.exclusionReasonCode, "EXECUTABLE");
    assert.equal(isSafetyBlockedOverride("EXECUTABLE"), true);
  });

  it("marks ordinary documents as PENDING candidates", () => {
    const result = classifyInventoryAutoDecision({
      relativePath: "docs/guide.md",
      fileName: "guide.md",
      extension: ".md",
      sizeBytes: 2048,
    });
    assert.equal(result.decision, "PENDING");
    assert.equal(result.exclusionReasonCode, null);
    assert.equal(result.overrideAllowed, true);
  });

  it("maps preview kinds", () => {
    assert.equal(previewKindForExtension(".pdf"), "pdf");
    assert.equal(previewKindForExtension(".png"), "image");
    assert.equal(previewKindForExtension(".md"), "text");
    assert.equal(previewKindForExtension(".exe"), "unsupported");
  });
});

describe("knowledge scope gates", () => {
  it("blocks finalize when pending/review/provider/empty included", () => {
    assert.equal(
      canFinalizeKnowledgeScope({
        status: "DRAFT",
        pendingCount: 1,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 2,
      }),
      false,
    );
    assert.equal(
      canFinalizeKnowledgeScope({
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 1,
        providerRequestedCount: 0,
        includedCount: 2,
      }),
      false,
    );
    assert.equal(
      canFinalizeKnowledgeScope({
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 1,
        includedCount: 2,
      }),
      false,
    );
    assert.equal(
      canFinalizeKnowledgeScope({
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 0,
      }),
      false,
    );
  });

  it("allows finalize when draft is fully decided with includes", () => {
    assert.equal(
      canFinalizeKnowledgeScope({
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 1,
      }),
      true,
    );
  });

  it("requires FINALIZED status for generation readiness", () => {
    assert.equal(
      isKnowledgeScopeReadyForGeneration({
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 3,
      }),
      false,
    );
    assert.equal(
      isKnowledgeScopeReadyForGeneration({
        status: "FINALIZED",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 3,
      }),
      true,
    );
  });

  it("accepts nested DTO counts via adapter", () => {
    const gate = toKnowledgeScopeGateSummary({
      id: "inv1",
      packId: "p",
      versionId: "v",
      sourceRevisionId: "r",
      workingCopyId: null,
      status: "FINALIZED",
      counts: {
        total: 3,
        included: 2,
        excluded: 1,
        excludedBySystem: 1,
        excludedByAdmin: 0,
        excludedByProvider: 0,
        pending: 0,
        reviewRequired: 0,
        providerRequested: 0,
      },
      finalizedAt: null,
      finalizedByUserId: null,
      createdAt: "",
      updatedAt: "",
    });
    assert.ok(gate);
    assert.equal(isKnowledgeScopeReadyForGeneration(gate), true);
  });
});

describe("worker input manifest", () => {
  it("includes INCLUDED only and excludes everything else", () => {
    const items = [
      { relativePath: "a.md", decision: "INCLUDED" as const },
      { relativePath: "b.exe", decision: "EXCLUDED" as const },
      { relativePath: "c.txt", decision: "PENDING" as const },
      { relativePath: "d.pdf", decision: "REVIEW_REQUIRED" as const },
    ];
    assert.deepEqual(listIncludedRelativePaths(items), ["a.md"]);
    const manifest = buildWorkerInputManifestFromItems(items);
    assert.deepEqual(manifest.includedPaths, ["a.md"]);
    assert.deepEqual(manifest.excludePaths, ["b.exe", "c.txt", "d.pdf"]);
  });

  it("merges admin exclude paths without duplicates", () => {
    assert.deepEqual(mergeAdminExcludePaths(["a/x", "b/y"], ["b/y", "c/z"]), [
      "a/x",
      "b/y",
      "c/z",
    ]);
  });
});
