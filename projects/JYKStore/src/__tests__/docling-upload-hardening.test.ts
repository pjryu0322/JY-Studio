import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DoclingUploadSessionStatus } from "@prisma/client";
import { interpretCompleteSessionClaim } from "../lib/docling-import/docling-upload-session-service.ts";
import {
  computeDoclingRetryDelayMs,
  isDoclingJobClaimEligible,
  isDoclingTransientProcessingError,
} from "../workers/docling-processing-job-claim.ts";
import {
  computeHeadTailSha256FromSlices,
  fingerprintsMatch,
  sha256HexOfArrayBuffer,
} from "../lib/docling-import/docling-upload-fingerprint.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findResumeFingerprintMismatches, isDoclingUploadPollTerminalSuccess } from "../lib/docling-import/docling-multipart-client.ts";

const root = join(import.meta.dirname, "../..");

describe("docling upload complete claim (idempotency)", () => {
  it("proceeds when updateMany count is 1", () => {
    const d = interpretCompleteSessionClaim({
      claimCount: 1,
      reloadedStatus: DoclingUploadSessionStatus.COMPLETING,
      bundleId: null,
      processingJobId: null,
    });
    assert.equal(d.action, "proceed");
  });

  it("returns idempotent result when already COMPLETED with ids", () => {
    const d = interpretCompleteSessionClaim({
      claimCount: 0,
      reloadedStatus: DoclingUploadSessionStatus.COMPLETED,
      bundleId: "bundle-1",
      processingJobId: "job-1",
    });
    assert.equal(d.action, "idempotent");
    if (d.action === "idempotent") {
      assert.equal(d.bundleId, "bundle-1");
      assert.equal(d.processingJobId, "job-1");
    }
  });

  it("conflicts when already COMPLETING (parallel complete)", () => {
    const d = interpretCompleteSessionClaim({
      claimCount: 0,
      reloadedStatus: DoclingUploadSessionStatus.COMPLETING,
      bundleId: null,
      processingJobId: null,
    });
    assert.equal(d.action, "conflict");
    if (d.action === "conflict") {
      assert.equal(d.code, "DOCLING_UPLOAD_ALREADY_COMPLETING");
    }
  });

  it("conflicts for other non-claimable statuses", () => {
    const d = interpretCompleteSessionClaim({
      claimCount: 0,
      reloadedStatus: DoclingUploadSessionStatus.FAILED,
      bundleId: null,
      processingJobId: null,
    });
    assert.equal(d.action, "conflict");
  });
});

describe("docling processing job claim/backoff helpers", () => {
  it("claims PENDING always", () => {
    assert.equal(
      isDoclingJobClaimEligible({ status: "PENDING", nextRunAt: null, lockExpiresAt: null }),
      true,
    );
  });

  it("claims RETRY_WAIT only when nextRunAt elapsed", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    assert.equal(
      isDoclingJobClaimEligible(
        {
          status: "RETRY_WAIT",
          nextRunAt: new Date("2026-07-14T11:59:00.000Z"),
          lockExpiresAt: null,
        },
        now,
      ),
      true,
    );
    assert.equal(
      isDoclingJobClaimEligible(
        {
          status: "RETRY_WAIT",
          nextRunAt: new Date("2026-07-14T12:01:00.000Z"),
          lockExpiresAt: null,
        },
        now,
      ),
      false,
    );
  });

  it("claims RUNNING only when lock expired", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    assert.equal(
      isDoclingJobClaimEligible(
        {
          status: "RUNNING",
          nextRunAt: null,
          lockExpiresAt: new Date("2026-07-14T11:50:00.000Z"),
        },
        now,
      ),
      true,
    );
    assert.equal(
      isDoclingJobClaimEligible(
        {
          status: "RUNNING",
          nextRunAt: null,
          lockExpiresAt: new Date("2026-07-14T12:10:00.000Z"),
        },
        now,
      ),
      false,
    );
  });

  it("backoff is 30s then 2m then null", () => {
    assert.equal(computeDoclingRetryDelayMs(1, 3), 30_000);
    assert.equal(computeDoclingRetryDelayMs(2, 3), 120_000);
    assert.equal(computeDoclingRetryDelayMs(3, 3), null);
  });

  it("classifies transient vs permanent errors", () => {
    assert.equal(isDoclingTransientProcessingError("DOCLING_STORAGE_UNAVAILABLE"), true);
    assert.equal(isDoclingTransientProcessingError("DOCLING_SCHEMA_INVALID"), false);
  });
});

describe("docling upload fingerprints", () => {
  it("hashes array buffers stably", async () => {
    const a = new TextEncoder().encode("hello-fingerprint");
    const hex = await sha256HexOfArrayBuffer(a);
    assert.equal(hex.length, 64);
    assert.equal(await sha256HexOfArrayBuffer(a), hex);
  });

  it("detects same size different content via head/tail hash", async () => {
    const headA = new TextEncoder().encode("A".repeat(100));
    const headB = new TextEncoder().encode("B".repeat(100));
    const tail = new TextEncoder().encode("T".repeat(100));
    const fa = await computeHeadTailSha256FromSlices({
      size: 200,
      headBytes: headA,
      tailBytes: tail,
    });
    const fb = await computeHeadTailSha256FromSlices({
      size: 200,
      headBytes: headB,
      tailBytes: tail,
    });
    assert.notEqual(fa.headSha256, fb.headSha256);

    const selected = {
      name: "x.bin",
      size: 200,
      lastModified: 1,
      headSha256: fa.headSha256,
      tailSha256: fa.tailSha256,
    };
    assert.equal(
      fingerprintsMatch(selected, {
        name: "x.bin",
        size: 200,
        lastModified: 1,
        headSha256: fb.headSha256,
        tailSha256: fb.tailSha256,
      }),
      false,
    );
  });

  it("findResumeFingerprintMismatches flags content mismatch", async () => {
    const mismatches = findResumeFingerprintMismatches({
      selected: {
        SOURCE_ORIGINAL: {
          name: "a.pdf",
          size: 10,
          lastModified: 1,
          headSha256: "aa",
          tailSha256: "bb",
        },
        DOCLING_JSON: {
          name: "a.json",
          size: 10,
          lastModified: 1,
          headSha256: "cc",
          tailSha256: "dd",
        },
        DOCLING_MARKDOWN: {
          name: "a.md",
          size: 10,
          lastModified: 1,
          headSha256: "ee",
          tailSha256: "ff",
        },
      },
      sessionFiles: [
        {
          id: "1",
          role: "SOURCE_ORIGINAL",
          status: "PENDING",
          originalFileName: "a.pdf",
          mimeType: "application/pdf",
          fileExtension: ".pdf",
          declaredFileSize: 10,
          objectKey: "k",
          partSizeBytes: 1,
          partCount: 1,
          checksumSha256: null,
          lastModifiedMs: 1,
          headSha256: "ZZ",
          tailSha256: "bb",
          hasMultipartUpload: true,
        },
        {
          id: "2",
          role: "DOCLING_JSON",
          status: "PENDING",
          originalFileName: "a.json",
          mimeType: "application/json",
          fileExtension: ".json",
          declaredFileSize: 10,
          objectKey: "k2",
          partSizeBytes: 1,
          partCount: 1,
          checksumSha256: null,
          lastModifiedMs: 1,
          headSha256: "cc",
          tailSha256: "dd",
          hasMultipartUpload: true,
        },
        {
          id: "3",
          role: "DOCLING_MARKDOWN",
          status: "PENDING",
          originalFileName: "a.md",
          mimeType: "text/markdown",
          fileExtension: ".md",
          declaredFileSize: 10,
          objectKey: "k3",
          partSizeBytes: 1,
          partCount: 1,
          checksumSha256: null,
          lastModifiedMs: 1,
          headSha256: "ee",
          tailSha256: "ff",
          hasMultipartUpload: true,
        },
      ] as never,
    });
    assert.deepEqual(mismatches, ["SOURCE_ORIGINAL"]);
  });

  it("client source persists fingerprints in sessionStorage payload", () => {
    const client = readFileSync(
      join(root, "src/lib/docling-import/docling-multipart-client.ts"),
      "utf8",
    );
    assert.ok(client.includes("persistUploadSession"));
    assert.ok(client.includes("fingerprints"));
    assert.ok(client.includes("computeUploadFingerprints"));
    assert.ok(client.includes("findResumeFingerprintMismatches"));
    assert.ok(client.includes("DOCLING_RESUME_FINGERPRINT_MISMATCH_MESSAGE"));
  });

  it("treats inactive NORMALIZED staging as upload poll success", () => {
    assert.equal(
      isDoclingUploadPollTerminalSuccess({ status: "NORMALIZED", isActive: false }),
      true,
    );
    assert.equal(
      isDoclingUploadPollTerminalSuccess({ status: "REVIEW_READY", isActive: true }),
      true,
    );
    assert.equal(
      isDoclingUploadPollTerminalSuccess({ status: "NORMALIZING", isActive: false }),
      false,
    );
    const client = readFileSync(
      join(root, "src/lib/docling-import/docling-multipart-client.ts"),
      "utf8",
    );
    assert.ok(!client.includes("candidate.isActive)"));
    assert.ok(client.includes("isDoclingUploadPollTerminalSuccess"));
  });
});
