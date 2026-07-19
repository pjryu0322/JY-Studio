import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import {
  RAG_EXPORT_POLICY_VERSION,
  RAG_EXPORT_SCHEMA_VERSION,
} from "@/lib/exports/rag-export-constants";
import { validateRagExportZipBytes } from "@/lib/exports/rag-export-validator";
import { resolveRunCurrentValidity } from "@/lib/distribution/service-validation-service";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function makeMinimalZip(overrides?: {
  vectorsIncluded?: boolean;
  sourceFilesIncluded?: boolean;
  emptyChunk?: boolean;
  badChecksum?: boolean;
  omitManifest?: boolean;
}): Promise<Uint8Array> {
  const manifest = {
    schemaVersion: RAG_EXPORT_SCHEMA_VERSION,
    exportPolicyVersion: RAG_EXPORT_POLICY_VERSION,
    generatedAt: "1970-01-01T00:00:00.000Z",
    pack: { packId: "demo", name: "Demo", version: "1.0", language: "ko", contentType: "DOCUMENT" },
    generation: {
      normalizedDocumentFingerprint: "fp",
      chunkCount: 1,
      sourceCount: 1,
    },
    retrieval: {
      rankingPolicyVersion: "relevance_diversity_v2",
      embeddingProvider: "LOCAL_E5",
      embeddingModel: "m",
      embeddingRevision: "r",
      dimension: 384,
      distanceMetric: "cosine",
      vectorsIncluded: overrides?.vectorsIncluded ?? false,
    },
    files: [],
    rights: {
      licenseName: "MIT",
      licenseUrl: null,
      usageTerms: null,
      sourceFilesIncluded: overrides?.sourceFilesIncluded ?? false,
    },
  };
  const sources = {
    schemaVersion: RAG_EXPORT_SCHEMA_VERSION,
    sources: [
      {
        sourceId: "source-1",
        title: "Doc",
        documentVersion: null,
        publisher: null,
        sourceUrl: null,
        licenseName: "MIT",
        licenseUrl: null,
        retrievedAt: null,
        originalFileIncluded: false,
      },
    ],
  };
  const chunk = {
    chunkId: "c1",
    title: "T",
    content: overrides?.emptyChunk ? "   " : "본문",
    chunkType: "text",
    section: "1",
    tags: [],
    source: { sourceId: "source-1", title: "Doc", pageStart: 1, pageEnd: 1 },
    metadata: { language: "ko", sortOrder: 0, familyKey: null },
  };
  const evaluation = {
    rankingPolicyVersion: "relevance_diversity_v2",
    status: "PASS",
    totalCases: 1,
    passedCases: 1,
    warningCases: 0,
    failedCases: 0,
    evaluatedAt: "1970-01-01T00:00:00.000Z",
  };
  const { sha256Hex } = await import("@/lib/object-storage/checksum");
  const enc = new TextEncoder();
  const files: Record<string, string> = {
    "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "chunks.jsonl": `${JSON.stringify(chunk)}\n`,
    "sources.json": `${JSON.stringify(sources, null, 2)}\n`,
    "evaluation.json": `${JSON.stringify(evaluation, null, 2)}\n`,
    "README.md": "# readme\n",
  };
  const lines = Object.entries(files).map(
    ([name, body]) => `${sha256Hex(enc.encode(body))}  ${name}`,
  );
  files["checksums.sha256"] = `${lines.join("\n")}\n`;
  if (overrides?.badChecksum) {
    files["checksums.sha256"] = files["checksums.sha256"].replace(/^[a-f0-9]{64}/i, "0".repeat(64));
  }

  const zip = new JSZip();
  for (const [name, body] of Object.entries(files)) {
    if (overrides?.omitManifest && name === "manifest.json") continue;
    zip.file(name, body);
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("rag export validator", () => {
  it("accepts a well-formed ZIP package", async () => {
    const bytes = await makeMinimalZip();
    const result = await validateRagExportZipBytes(bytes);
    assert.equal(result.valid, true);
    assert.equal(result.chunkCount, 1);
    assert.equal(result.sourceCount, 1);
    assert.equal(result.schemaVersion, RAG_EXPORT_SCHEMA_VERSION);
    assert.equal(result.policyVersion, RAG_EXPORT_POLICY_VERSION);
  });

  it("rejects empty chunk content", async () => {
    const bytes = await makeMinimalZip({ emptyChunk: true });
    const result = await validateRagExportZipBytes(bytes);
    assert.equal(result.valid, false);
    assert.ok(result.issueCodes.includes("RAG_EXPORT_CHUNK_EMPTY"));
  });

  it("rejects checksum mismatch", async () => {
    const bytes = await makeMinimalZip({ badChecksum: true });
    const result = await validateRagExportZipBytes(bytes);
    assert.equal(result.valid, false);
    assert.ok(result.issueCodes.includes("RAG_EXPORT_CHECKSUM_MISMATCH"));
  });

  it("rejects unexpected vectorsIncluded", async () => {
    const bytes = await makeMinimalZip({ vectorsIncluded: true });
    const result = await validateRagExportZipBytes(bytes);
    assert.equal(result.valid, false);
    assert.ok(result.issueCodes.includes("RAG_EXPORT_VECTOR_INCLUDED_UNEXPECTEDLY"));
  });

  it("rejects missing required files", async () => {
    const bytes = await makeMinimalZip({ omitManifest: true });
    const result = await validateRagExportZipBytes(bytes);
    assert.equal(result.valid, false);
    assert.ok(result.issueCodes.includes("RAG_EXPORT_REQUIRED_FILE_MISSING"));
  });
});

describe("legacy DOWNLOAD run validity", () => {
  it("marks legacy original-file DOWNLOAD PASS as STALE", () => {
    const validity = resolveRunCurrentValidity({
      run: {
        status: "PASS",
        fingerprint: "fp",
        indexGenerationId: "gen",
        invalidatedAt: null,
        channel: "DOWNLOAD",
        details: {
          fileId: "file-1",
          fileName: "a.pdf",
          storageVerified: true,
        },
      },
      bindingFingerprint: "fp",
      bindingIndexGenerationId: "gen",
    });
    assert.equal(validity, "STALE");
  });

  it("keeps rag_export_v1 DOWNLOAD PASS as CURRENT when binding matches", () => {
    const validity = resolveRunCurrentValidity({
      run: {
        status: "PASS",
        fingerprint: "fp",
        indexGenerationId: "gen",
        invalidatedAt: null,
        channel: "DOWNLOAD",
        details: {
          downloadMode: "RAG_EXPORT",
          ragExportPolicyVersion: RAG_EXPORT_POLICY_VERSION,
          ragExportSchemaVersion: RAG_EXPORT_SCHEMA_VERSION,
          exportFingerprint: "abc",
          checksumsValid: true,
          sourceTraceValid: true,
          manifestValid: true,
          chunksJsonlValid: true,
        },
      },
      bindingFingerprint: "fp",
      bindingIndexGenerationId: "gen",
    });
    assert.equal(validity, "CURRENT");
  });
});

describe("provider UX copy for RAG Export", () => {
  const tab = readFileSync(
    join(process.cwd(), "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
    "utf8",
  );
  const dist = readFileSync(
    join(process.cwd(), "src/components/provider-distribution/ProviderDistributionTab.tsx"),
    "utf8",
  );

  it("renames DOWNLOAD channel to RAG Export package validation", () => {
    assert.match(tab, /RAG Export 패키지 검증/);
    assert.doesNotMatch(tab, /원본문서 다운로드 검증/);
    assert.match(tab, /RAG Export 다운로드/);
    assert.match(tab, /RAG Export 품질 확인/);
  });

  it("renames allowDownload UX to RAG Export 제공", () => {
    assert.match(dist, /RAG Export 제공/);
    assert.doesNotMatch(dist, /원본문서 다운로드 제공/);
  });
});
