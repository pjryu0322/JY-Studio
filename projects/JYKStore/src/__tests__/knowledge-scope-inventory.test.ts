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
  buildInventorySourceFingerprint,
  fingerprintsMatch,
} from "@/lib/knowledge-scope/inventory-source-fingerprint";
import {
  buildWorkerInputManifestFromItems,
  listIncludedRelativePaths,
  mergeAdminExcludePaths,
} from "@/lib/knowledge-scope/inventory-worker-manifest";
import {
  generationOutcomeAllowsServiceValidation,
  generationOutcomeRequiresCorrection,
  resolveGenerationOutcome,
} from "@/lib/workflow/generation-outcome";

const bound = {
  workingCopyId: "swc_1",
  inventorySourceFingerprint: "fp_abc",
};

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

  it("marks ordinary documents without a Worker parser as EXCLUDED", () => {
    const result = classifyInventoryAutoDecision({
      relativePath: "docs/guide.md",
      fileName: "guide.md",
      extension: ".md",
      sizeBytes: 2048,
    });
    assert.equal(result.decision, "EXCLUDED");
    assert.equal(result.exclusionReasonCode, "UNSUPPORTED");
    assert.equal(result.overrideAllowed, false);
  });

  it("marks supported PDF as PENDING knowledge candidate", () => {
    const result = classifyInventoryAutoDecision({
      relativePath: "docs/manual.pdf",
      fileName: "manual.pdf",
      extension: ".pdf",
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

describe("P3.1 knowledge scope WC binding gates", () => {
  it("blocks finalize/generation without Working Copy binding", () => {
    assert.equal(
      canFinalizeKnowledgeScope({
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 2,
      }),
      false,
    );
    assert.equal(
      isKnowledgeScopeReadyForGeneration({
        status: "FINALIZED",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 2,
      }),
      false,
    );
  });

  it("blocks finalize when pending/review/provider/empty included", () => {
    assert.equal(
      canFinalizeKnowledgeScope({
        ...bound,
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
        ...bound,
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
        ...bound,
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
        ...bound,
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 0,
      }),
      false,
    );
  });

  it("allows finalize when draft is WC-bound and fully decided", () => {
    assert.equal(
      canFinalizeKnowledgeScope({
        ...bound,
        status: "DRAFT",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 1,
      }),
      true,
    );
  });

  it("requires FINALIZED + WC binding for generation readiness", () => {
    assert.equal(
      isKnowledgeScopeReadyForGeneration({
        ...bound,
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
        ...bound,
        status: "FINALIZED",
        pendingCount: 0,
        reviewRequiredCount: 0,
        providerRequestedCount: 0,
        includedCount: 3,
      }),
      true,
    );
  });

  it("accepts nested DTO counts via adapter and requires fingerprint", () => {
    const unbound = toKnowledgeScopeGateSummary({
      id: "inv1",
      packId: "p",
      versionId: "v",
      sourceRevisionId: "r",
      workingCopyId: null,
      inventorySourceFingerprint: null,
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
    assert.ok(unbound);
    assert.equal(isKnowledgeScopeReadyForGeneration(unbound), false);

    const boundDto = toKnowledgeScopeGateSummary({
      id: "inv1",
      packId: "p",
      versionId: "v",
      sourceRevisionId: "r",
      workingCopyId: "swc_1",
      inventorySourceFingerprint: "fp",
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
    assert.equal(isKnowledgeScopeReadyForGeneration(boundDto), true);
  });
});

describe("P3.1 inventory source fingerprint", () => {
  it("is stable for same path/size set regardless of input order", () => {
    const a = buildInventorySourceFingerprint([
      { relativePath: "b/x.md", sizeBytes: 10 },
      { relativePath: "a/y.md", sizeBytes: 20 },
    ]);
    const b = buildInventorySourceFingerprint([
      { relativePath: "a/y.md", sizeBytes: 20 },
      { relativePath: "b/x.md", sizeBytes: 10 },
    ]);
    assert.equal(a, b);
    assert.equal(fingerprintsMatch(a, b), true);
  });

  it("changes when file set changes", () => {
    const a = buildInventorySourceFingerprint([{ relativePath: "a.md", sizeBytes: 1 }]);
    const b = buildInventorySourceFingerprint([{ relativePath: "a.md", sizeBytes: 2 }]);
    assert.equal(fingerprintsMatch(a, b), false);
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

describe("P4 generation outcome", () => {
  it("maps blocker to CORRECTION_REQUIRED and warning-only to SUCCEEDED_WITH_WARNINGS", () => {
    assert.equal(
      resolveGenerationOutcome({
        workerZipPhase: "COMPLETED",
        qualityCompleted: true,
        hasBlockers: true,
        failCount: 0,
        hasWarnings: true,
      }),
      "CORRECTION_REQUIRED",
    );
    assert.equal(
      resolveGenerationOutcome({
        workerZipPhase: "COMPLETED",
        qualityCompleted: true,
        hasBlockers: false,
        failCount: 0,
        hasWarnings: true,
      }),
      "SUCCEEDED_WITH_WARNINGS",
    );
    assert.equal(
      generationOutcomeRequiresCorrection("CORRECTION_REQUIRED"),
      true,
    );
    assert.equal(
      generationOutcomeAllowsServiceValidation("SUCCEEDED_WITH_WARNINGS"),
      true,
    );
    assert.equal(generationOutcomeAllowsServiceValidation("CORRECTION_REQUIRED"), false);
  });

  it("maps worker failure and clean success", () => {
    assert.equal(
      resolveGenerationOutcome({
        workerZipPhase: "FAILED",
        qualityCompleted: false,
        hasBlockers: false,
        failCount: 0,
        hasWarnings: false,
      }),
      "FAILED",
    );
    assert.equal(
      resolveGenerationOutcome({
        workerZipPhase: "COMPLETED",
        qualityCompleted: true,
        hasBlockers: false,
        failCount: 0,
        hasWarnings: false,
      }),
      "SUCCEEDED",
    );
  });
});
