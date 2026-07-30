import { createHash } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { sha256Hex } from "@/lib/object-storage/checksum";
import {
  RAG_EXPORT_POLICY_VERSION,
  RAG_EXPORT_REQUIRED_FILES,
  RAG_EXPORT_SCHEMA_VERSION,
  RAG_EXPORT_ZIP_EPOCH,
} from "@/lib/exports/rag-export-constants";
import {
  validateRagExportZipBytes,
  type RagExportValidationResult,
} from "@/lib/exports/rag-export-validator";

// validateRagExportZipBytes is async — callers must await.

export type RagExportBuildInput = {
  packId: string;
  versionId: string;
  /** When set, must match current SearchIndexGeneration / pipeline binding. */
  expectedPipelineRunId?: string;
  expectedSearchIndexGenerationId?: string;
  expectedNormalizedDocumentId?: string;
  expectedFingerprint?: string;
  /** Include zipBytes (default true). */
  includeZipBytes?: boolean;
};

export type RagExportPackage = {
  fileName: string;
  mediaType: "application/zip";
  schemaVersion: typeof RAG_EXPORT_SCHEMA_VERSION;
  policyVersion: typeof RAG_EXPORT_POLICY_VERSION;
  exportFingerprint: string;
  chunkCount: number;
  sourceCount: number;
  fileSize: number;
  files: Record<(typeof RAG_EXPORT_REQUIRED_FILES)[number], string>;
  fileChecksums: Record<string, string>;
  zipBytes?: Uint8Array;
  validation: RagExportValidationResult;
  generation: {
    pipelineRunId: string;
    searchIndexGenerationId: string;
    normalizedDocumentId: string;
    fingerprint: string;
    chunkGenerationId: string;
  };
};

export class RagExportBuildError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RagExportBuildError";
    this.code = code;
  }
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function metaNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asMeta(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function safeFileStem(packId: string, versionLabel: string): string {
  const raw = `${packId}-${versionLabel}-rag-export`
    .replace(/[^\w.\-가-힣]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || "rag-export";
}

function buildChecksumsFile(checksums: Record<string, string>): string {
  const lines = RAG_EXPORT_REQUIRED_FILES.filter((f) => f !== "checksums.sha256").map(
    (name) => `${checksums[name]}  ${name}`,
  );
  return `${lines.join("\n")}\n`;
}

function computeExportFingerprint(input: {
  packVersion: string;
  generationFingerprint: string;
  fileChecksums: Record<string, string>;
}): string {
  const ordered = RAG_EXPORT_REQUIRED_FILES.filter((f) => f !== "checksums.sha256")
    .map((name) => `${name}:${input.fileChecksums[name] ?? ""}`)
    .join("|");
  return createHash("sha256")
    .update(
      [
        RAG_EXPORT_SCHEMA_VERSION,
        RAG_EXPORT_POLICY_VERSION,
        input.packVersion,
        input.generationFingerprint,
        ordered,
      ].join("\n"),
      "utf8",
    )
    .digest("hex");
}

function buildReadme(input: {
  packName: string;
  packId: string;
  version: string;
  chunkCount: number;
  sourceCount: number;
}): string {
  return `# JYKStore RAG Export

이 패키지는 외부 RAG 환경에 반입할 수 있는 Chunk·Metadata 묶음입니다.

- Pack: ${input.packName} (\`${input.packId}\`)
- Version: ${input.version}
- Schema: ${RAG_EXPORT_SCHEMA_VERSION}
- Policy: ${RAG_EXPORT_POLICY_VERSION}
- Chunks: ${input.chunkCount}
- Sources: ${input.sourceCount}

## 파일

| 파일 | 설명 |
|------|------|
| manifest.json | 패키지·생성·검색 메타데이터 |
| chunks.jsonl | Chunk 본문 (한 줄당 1건) |
| sources.json | 출처 문서 메타데이터 |
| evaluation.json | 자동 검색 평가 요약 |
| README.md | 이 문서 |
| checksums.sha256 | 파일별 SHA-256 |

## chunks.jsonl Import 예시

\`\`\`ts
import { readFileSync } from "node:fs";
const lines = readFileSync("chunks.jsonl", "utf8").trim().split("\\n");
const chunks = lines.map((line) => JSON.parse(line));
\`\`\`

## Source Trace

각 Chunk의 \`source.sourceId\`는 \`sources.json\`의 항목과 일치합니다.
\`pageStart\` / \`pageEnd\`로 원문 위치를 추적할 수 있습니다.

## Embedding

이 패키지에는 Embedding Vector가 포함되지 않습니다 (\`vectorsIncluded=false\`).
반입 환경의 Embedding 모델로 재임베딩하는 것을 권장합니다.

## 원본 파일

원본 PDF/DOCX 등 Binary는 기본 포함되지 않습니다 (\`sourceFilesIncluded=false\`).

## Checksum 검증

\`\`\`bash
sha256sum -c checksums.sha256
\`\`\`
`;
}

/**
 * Build a deterministic RAG Export ZIP for Provider validation and Public download.
 * Does not include original binaries or embedding vectors.
 */
export async function buildRagExportPackage(
  input: RagExportBuildInput,
): Promise<RagExportPackage> {
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId },
    select: {
      packId: true,
      name: true,
    },
  });
  if (!pack) {
    throw new RagExportBuildError("RAG_EXPORT_BUILD_FAILED", "지식팩을 찾을 수 없습니다.");
  }

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { id: input.versionId, packId: input.packId },
    select: { id: true, version: true, language: true },
  });
  if (!version) {
    throw new RagExportBuildError("RAG_EXPORT_BUILD_FAILED", "지식팩 버전을 찾을 수 없습니다.");
  }

  const generation = await prisma.searchIndexGeneration.findFirst({
    where: {
      packId: input.packId,
      versionId: version.id,
      // Public consume path passes PROMOTED; Provider DOWNLOAD validation may still be READY.
      status: { in: ["READY", "PROMOTED"] },
      staleAt: null,
      retiredAt: null,
      ...(input.expectedSearchIndexGenerationId
        ? { id: input.expectedSearchIndexGenerationId }
        : {}),
      ...(input.expectedPipelineRunId ? { pipelineRunId: input.expectedPipelineRunId } : {}),
    },
    orderBy: [{ promotedAt: "desc" }, { createdAt: "desc" }],
  });
  if (!generation) {
    throw new RagExportBuildError(
      "RAG_EXPORT_BUILD_FAILED",
      "게시된 검색 인덱스를 찾을 수 없습니다.",
    );
  }
  if (
    input.expectedFingerprint &&
    generation.fingerprint !== input.expectedFingerprint
  ) {
    throw new RagExportBuildError(
      "RAG_EXPORT_BINDING_STALE",
      "현재 검색데이터가 변경되었습니다. RAG Export 검증을 다시 실행해 주세요.",
    );
  }
  if (
    input.expectedNormalizedDocumentId &&
    generation.normalizedDocumentId !== input.expectedNormalizedDocumentId
  ) {
    throw new RagExportBuildError(
      "RAG_EXPORT_BINDING_STALE",
      "현재 검색데이터가 변경되었습니다. RAG Export 검증을 다시 실행해 주세요.",
    );
  }
  if (generation.chunkCount < 1 || generation.embeddedCount !== generation.chunkCount) {
    throw new RagExportBuildError(
      "RAG_EXPORT_BUILD_FAILED",
      "검색 Chunk·Vector가 준비되지 않았습니다.",
    );
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      isActive: true,
      chunkGenerationId: generation.chunkGenerationId,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      sourceDocument: {
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          documentVersion: true,
        },
      },
    },
  });
  if (chunks.length < 1) {
    throw new RagExportBuildError("RAG_EXPORT_CHUNK_EMPTY", "내보낼 Chunk가 없습니다.");
  }

  const sourceDocs = await prisma.sourceDocument.findMany({
    where: { versionId: version.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      documentVersion: true,
    },
  });

  const distribution = await prisma.packDistributionMetadata.findFirst({
    where: { packId: input.packId, versionId: version.id },
    select: {
      licenseName: true,
      licenseUrl: true,
      usageTerms: true,
      rightsBasis: true,
      contentType: true,
      sourcePublisherName: true,
      sourceDocumentVersion: true,
      sourceRetrievedAt: true,
    },
  });

  const evalStep = await prisma.pipelineStepLog.findFirst({
    where: { runId: generation.pipelineRunId, step: "SEARCH_EVALUATING" },
    select: { status: true, details: true, finishedAt: true },
  });
  const retrievalEval = await prisma.retrievalEvaluationRun.findFirst({
    where: {
      packId: input.packId,
      versionId: version.id,
      status: "PASS",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      totalCaseCount: true,
      passCaseCount: true,
      warningCaseCount: true,
      failCaseCount: true,
    },
  });
  const evalDetails = asMeta(evalStep?.details);
  const evalStatus =
    evalStep?.status === "PASS" || retrievalEval?.status === "PASS"
      ? "PASS"
      : evalStep?.status === "FAIL"
        ? "FAIL"
        : "UNKNOWN";
  if (evalStatus !== "PASS") {
    throw new RagExportBuildError(
      "RAG_EXPORT_BUILD_FAILED",
      "자동 검색 평가가 통과된 상태에서만 RAG Export를 생성할 수 있습니다.",
    );
  }
  const rankingPolicy =
    (typeof evalDetails?.retrievalRankingPolicyVersion === "string"
      ? evalDetails.retrievalRankingPolicyVersion
      : null) || RETRIEVAL_RANKING_POLICY_VERSION;
  if (evalStep?.status === "PASS" && rankingPolicy !== RETRIEVAL_RANKING_POLICY_VERSION) {
    throw new RagExportBuildError(
      "RAG_EXPORT_BINDING_STALE",
      "검색 순위 정책이 변경되었습니다. 자동 평가 후 RAG Export를 다시 실행해 주세요.",
    );
  }

  const sourceIdByDocId = new Map<string, string>();
  const sourcesPayload = sourceDocs.map((doc, idx) => {
    const sourceId = `source-${idx + 1}`;
    sourceIdByDocId.set(doc.id, sourceId);
    return {
      sourceId,
      title: doc.title,
      documentVersion: doc.documentVersion ?? distribution?.sourceDocumentVersion ?? null,
      publisher: distribution?.sourcePublisherName ?? null,
      sourceUrl: doc.sourceUrl ?? null,
      licenseName: distribution?.licenseName ?? null,
      licenseUrl: distribution?.licenseUrl ?? null,
      retrievedAt: distribution?.sourceRetrievedAt?.toISOString() ?? null,
      originalFileIncluded: false,
    };
  });

  // Ensure every chunk source is represented even if SourceDocument row was soft-orphaned.
  for (const chunk of chunks) {
    if (!chunk.sourceDocumentId) continue;
    if (sourceIdByDocId.has(chunk.sourceDocumentId)) continue;
    const sourceId = `source-${sourcesPayload.length + 1}`;
    sourceIdByDocId.set(chunk.sourceDocumentId, sourceId);
    sourcesPayload.push({
      sourceId,
      title: chunk.sourceDocument?.title ?? chunk.title,
      documentVersion:
        chunk.sourceDocument?.documentVersion ?? distribution?.sourceDocumentVersion ?? null,
      publisher: distribution?.sourcePublisherName ?? null,
      sourceUrl: chunk.sourceDocument?.sourceUrl ?? null,
      licenseName: distribution?.licenseName ?? null,
      licenseUrl: distribution?.licenseUrl ?? null,
      retrievedAt: null,
      originalFileIncluded: false,
    });
  }

  const chunkLines: string[] = [];
  for (const chunk of chunks) {
    if (!chunk.content.trim()) {
      throw new RagExportBuildError(
        "RAG_EXPORT_CHUNK_EMPTY",
        `Chunk content가 비어 있습니다: ${chunk.id}`,
      );
    }
    if (!chunk.sourceDocumentId || !sourceIdByDocId.has(chunk.sourceDocumentId)) {
      throw new RagExportBuildError(
        "RAG_EXPORT_SOURCE_TRACE_INVALID",
        `Chunk에 출처가 없습니다: ${chunk.id}`,
      );
    }
    const meta = asMeta(chunk.metadata);
    const pageStart = metaNumber(meta, "pageStart") ?? metaNumber(meta, "page");
    const pageEnd = metaNumber(meta, "pageEnd") ?? pageStart;
    if (pageStart != null && pageEnd != null && pageStart > pageEnd) {
      throw new RagExportBuildError(
        "RAG_EXPORT_SOURCE_TRACE_INVALID",
        `pageStart > pageEnd: ${chunk.id}`,
      );
    }
    const familyKey = metaString(meta, "familyKey");
    const record = {
      chunkId: chunk.id,
      title: chunk.title,
      content: chunk.content,
      chunkType: chunk.chunkType,
      section: chunk.section,
      tags: chunk.tags,
      source: {
        sourceId: sourceIdByDocId.get(chunk.sourceDocumentId)!,
        title: chunk.sourceDocument?.title ?? null,
        pageStart,
        pageEnd,
      },
      metadata: {
        language: version.language ?? null,
        sortOrder: chunk.sortOrder,
        familyKey,
      },
    };
    chunkLines.push(JSON.stringify(record));
  }

  const generatedAt = "1970-01-01T00:00:00.000Z"; // deterministic; fingerprint ignores wall clock
  const manifest = {
    schemaVersion: RAG_EXPORT_SCHEMA_VERSION,
    exportPolicyVersion: RAG_EXPORT_POLICY_VERSION,
    generatedAt,
    pack: {
      packId: pack.packId,
      name: pack.name,
      version: version.version,
      versionId: version.id,
      language: version.language ?? null,
      contentType: distribution?.contentType ?? "DOCUMENT",
    },
    generation: {
      normalizedDocumentFingerprint: generation.fingerprint,
      chunkCount: chunks.length,
      sourceCount: sourcesPayload.length,
      searchIndexGenerationId: generation.id,
      pipelineRunId: generation.pipelineRunId,
      scope: generation.scope,
      status: generation.status,
    },
    retrieval: {
      rankingPolicyVersion: rankingPolicy,
      embeddingProvider: generation.embeddingProvider,
      embeddingModel: generation.embeddingModel,
      embeddingRevision: generation.embeddingModelRevision,
      dimension: generation.embeddingDimension,
      distanceMetric: generation.distanceMetric,
      vectorsIncluded: false,
    },
    files: RAG_EXPORT_REQUIRED_FILES.map((name) => ({ name })),
    rights: {
      licenseName: distribution?.licenseName ?? null,
      licenseUrl: distribution?.licenseUrl ?? null,
      usageTerms: distribution?.usageTerms ?? null,
      rightsBasis: distribution?.rightsBasis ?? null,
      sourceFilesIncluded: false,
    },
  };

  const evaluation = {
    rankingPolicyVersion: rankingPolicy,
    status: evalStatus,
    totalCases:
      typeof evalDetails?.totalCases === "number"
        ? evalDetails.totalCases
        : typeof evalDetails?.caseCount === "number"
          ? evalDetails.caseCount
          : retrievalEval?.totalCaseCount ?? 0,
    passedCases:
      typeof evalDetails?.passedCases === "number"
        ? evalDetails.passedCases
        : retrievalEval?.passCaseCount ?? 0,
    warningCases:
      typeof evalDetails?.warningCases === "number"
        ? evalDetails.warningCases
        : retrievalEval?.warningCaseCount ?? 0,
    failedCases:
      typeof evalDetails?.failedCases === "number"
        ? evalDetails.failedCases
        : retrievalEval?.failCaseCount ?? 0,
    evaluatedAt:
      evalStep?.finishedAt?.toISOString() ??
      retrievalEval?.createdAt.toISOString() ??
      generatedAt,
  };

  const sourcesFile = {
    schemaVersion: RAG_EXPORT_SCHEMA_VERSION,
    sources: sourcesPayload,
  };

  const files: Record<(typeof RAG_EXPORT_REQUIRED_FILES)[number], string> = {
    "manifest.json": stableJson(manifest),
    "chunks.jsonl": `${chunkLines.join("\n")}\n`,
    "sources.json": stableJson(sourcesFile),
    "evaluation.json": stableJson(evaluation),
    "README.md": buildReadme({
      packName: pack.name,
      packId: pack.packId,
      version: version.version,
      chunkCount: chunks.length,
      sourceCount: sourcesPayload.length,
    }),
    "checksums.sha256": "",
  };

  const fileChecksums: Record<string, string> = {};
  for (const name of RAG_EXPORT_REQUIRED_FILES) {
    if (name === "checksums.sha256") continue;
    fileChecksums[name] = sha256Hex(utf8(files[name]));
  }
  files["checksums.sha256"] = buildChecksumsFile(fileChecksums);
  fileChecksums["checksums.sha256"] = sha256Hex(utf8(files["checksums.sha256"]));

  const exportFingerprint = computeExportFingerprint({
    packVersion: version.version,
    generationFingerprint: generation.generationFingerprint || generation.fingerprint,
    fileChecksums,
  });

  const zip = new JSZip();
  for (const name of RAG_EXPORT_REQUIRED_FILES) {
    zip.file(name, files[name], { date: RAG_EXPORT_ZIP_EPOCH, unixPermissions: 0o644 });
  }
  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const validation = await validateRagExportZipBytes(zipBytes);
  if (!validation.valid) {
    throw new RagExportBuildError(
      validation.issueCodes[0] ?? "RAG_EXPORT_BUILD_FAILED",
      `RAG Export 자체 검증에 실패했습니다: ${validation.issueCodes.join(", ")}`,
    );
  }

  const fileName = `${safeFileStem(pack.packId, version.version)}.zip`;
  return {
    fileName,
    mediaType: "application/zip",
    schemaVersion: RAG_EXPORT_SCHEMA_VERSION,
    policyVersion: RAG_EXPORT_POLICY_VERSION,
    exportFingerprint,
    chunkCount: chunks.length,
    sourceCount: sourcesPayload.length,
    fileSize: zipBytes.byteLength,
    files,
    fileChecksums,
    zipBytes: input.includeZipBytes === false ? undefined : zipBytes,
    validation,
    generation: {
      pipelineRunId: generation.pipelineRunId,
      searchIndexGenerationId: generation.id,
      normalizedDocumentId: generation.normalizedDocumentId,
      fingerprint: generation.fingerprint,
      chunkGenerationId: generation.chunkGenerationId,
    },
  };
}

export function ragExportDetailsFromPackage(pkg: RagExportPackage): Record<string, unknown> {
  return {
    downloadMode: "RAG_EXPORT",
    ragExportPolicyVersion: pkg.policyVersion,
    ragExportSchemaVersion: pkg.schemaVersion,
    exportFingerprint: pkg.exportFingerprint,
    fileId: pkg.exportFingerprint,
    fileName: pkg.fileName,
    mediaType: pkg.mediaType,
    mimeType: pkg.mediaType,
    fileSize: pkg.fileSize,
    chunkCount: pkg.chunkCount,
    sourceCount: pkg.sourceCount,
    requiredFilesPresent: pkg.validation.requiredFilesPresent,
    manifestValid: pkg.validation.manifestValid,
    chunksJsonlValid: pkg.validation.chunksJsonlValid,
    sourceTraceValid: pkg.validation.sourceTraceValid,
    checksumsValid: pkg.validation.checksumsValid,
    vectorsIncluded: false,
    sourceFilesIncluded: false,
    storageVerified: true,
  };
}

export function isRagExportRunDetails(details: unknown): boolean {
  const d =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : null;
  if (!d) return false;
  return (
    d.downloadMode === "RAG_EXPORT" &&
    d.ragExportPolicyVersion === RAG_EXPORT_POLICY_VERSION &&
    d.ragExportSchemaVersion === RAG_EXPORT_SCHEMA_VERSION &&
    typeof d.exportFingerprint === "string" &&
    d.exportFingerprint.length > 0 &&
    d.checksumsValid === true &&
    d.sourceTraceValid === true &&
    d.manifestValid === true &&
    d.chunksJsonlValid === true
  );
}
