import { prisma } from "@/lib/prisma";
import { buildDocumentBlocks } from "@/lib/chunking/blockBuilder";
import { buildChunksFromBlocks } from "@/lib/chunking/chunkEngine";
import { exportChunksToJsonl } from "@/lib/chunking/exporters/jsonl";
import { buildChunkDiffSummary } from "@/lib/chunking/reporting/chunkDiff";
import { generateChunkQualityReport } from "@/lib/chunking/reporting/chunkQualityReport";
import { buildQualityReport } from "@/lib/chunking/reporting/qualityReport";
import { removeHeaderFooterNoise } from "@/lib/chunking/rules/headerFooter";
import { estimateOcrQuality } from "@/lib/chunking/rules/ocrQuality";
import {
  CHUNK_PRESETS,
  DEFAULT_CHUNK_CONFIG,
  type Chunk,
  type ChunkConfig,
  type ChunkDiffSummary,
} from "@/lib/chunking/types";
import type { Prisma } from "@prisma/client";

export interface ChunkingPipelineInput {
  jobId: string;
  text: string;
  extractionMethod: string;
  message: string;
  chunkConfig?: Partial<ChunkConfig>;
  preset?: keyof typeof CHUNK_PRESETS;
  beforeChunks?: Chunk[];
}

export const CHUNK_PIPELINE_VERSION = "chunk-v2.1.0";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeConfig(
  config?: Partial<ChunkConfig>,
  preset?: keyof typeof CHUNK_PRESETS
): ChunkConfig {
  const base = preset ? CHUNK_PRESETS[preset] : DEFAULT_CHUNK_CONFIG;
  return {
    ...base,
    ...config,
    targetTokens: Math.max(100, config?.targetTokens ?? base.targetTokens),
    maxTokens: Math.max(120, config?.maxTokens ?? base.maxTokens),
    minTokens: Math.max(50, config?.minTokens ?? base.minTokens),
    overlapTokens: Math.max(0, config?.overlapTokens ?? base.overlapTokens),
    overlapSentences: Math.max(
      0,
      config?.overlapSentences ?? base.overlapSentences
    ),
    headerFooterThreshold: Math.min(
      0.8,
      Math.max(0.5, config?.headerFooterThreshold ?? base.headerFooterThreshold)
    ),
    enableConstraintRules:
      config?.enableConstraintRules ?? base.enableConstraintRules,
  };
}

export async function runChunkingPipeline({
  jobId,
  text,
  extractionMethod,
  message,
  chunkConfig,
  preset,
  beforeChunks,
}: ChunkingPipelineInput): Promise<void> {
  console.log("[chunkingPipeline] start", { jobId, extractionMethod, preset: preset ?? null });
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  const resolvedConfig = normalizeConfig(chunkConfig, preset);
  const { blocks: rawBlocks, tables } = buildDocumentBlocks(cleaned);
  const cleanedResult = removeHeaderFooterNoise(
    rawBlocks,
    resolvedConfig.headerFooterThreshold,
    0.12,
    0.12,
    Boolean(resolvedConfig.forcePositionalCleaning)
  );
  const ocrQuality =
    extractionMethod.includes("OCR") || extractionMethod.toLowerCase().includes("ocr")
      ? estimateOcrQuality(cleaned)
      : undefined;
  const chunks = buildChunksFromBlocks(cleanedResult.blocks, resolvedConfig, {
    pipelineVersion: CHUNK_PIPELINE_VERSION,
    docId: jobId,
    ocrQuality,
  });
  const qualityReport = generateChunkQualityReport(chunks);
  const report = buildQualityReport(chunks);
  const diff: ChunkDiffSummary | null = beforeChunks
    ? buildChunkDiffSummary(
        beforeChunks,
        chunks,
        cleanedResult.log.removed.slice(0, 5).map((r) => r.text)
      )
    : null;
  const jsonl = exportChunksToJsonl(chunks);
  console.log("[chunkingPipeline] generated chunks", {
    jobId,
    chunkCount: chunks.length,
    cleanedTextLength: cleaned.length,
  });

  const extractedMeta = toJsonValue({
    extractionMethod,
    text: cleaned,
    textLength: cleaned.length,
    blockCount: rawBlocks.length,
    cleanedBlockCount: cleanedResult.blocks.length,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });
  const chunksMeta = toJsonValue({
    count: chunks.length,
    chunks,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
    config: resolvedConfig,
  });
  const exportMeta = toJsonValue({
    artifactKey: "EXPORT_JSONL",
    format: "jsonl",
    content: jsonl,
    lineCount: jsonl ? jsonl.split("\n").length : 0,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });
  const diffMeta = diff
    ? toJsonValue({
        artifactKey: "CHUNK_DIFF_JSON",
        ...diff,
        pipelineVersion: CHUNK_PIPELINE_VERSION,
      })
    : null;
  const ocrMeta = toJsonValue({
    artifactKey: "OCR_QUALITY_JSON",
    quality: ocrQuality ?? null,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });
  const tablesArtifactMeta = toJsonValue({
    artifactKey: "TABLES_JSON",
    count: tables.length,
    tables,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });
  const reportArtifactMeta = toJsonValue({
    artifactKey: "CHUNK_REPORT_JSON",
    ...report,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });
  const chunkQualityArtifactMeta = toJsonValue({
    artifactKey: "CHUNK_QUALITY_JSON",
    ...qualityReport,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });
  const cleaningArtifactMeta = toJsonValue({
    artifactKey: "CLEANING_LOG_JSON",
    ...cleanedResult.log,
    pipelineVersion: CHUNK_PIPELINE_VERSION,
  });

  await prisma.$transaction(async (tx) => {
    await tx.artifact.deleteMany({
      where: {
        jobId,
        type: { in: ["EXTRACTED_TEXT", "CHUNKS_JSON"] },
      },
    });

    await tx.artifact.create({
      data: {
        jobId,
        type: "EXTRACTED_TEXT",
        path: `inline://jobs/${jobId}/extracted.txt`,
        meta: extractedMeta,
      },
    });

    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/chunks.json`,
        meta: chunksMeta,
      },
    });
    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/tables.json`,
        meta: tablesArtifactMeta,
      },
    });
    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/chunk-report.json`,
        meta: reportArtifactMeta,
      },
    });
    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/chunk-quality.json`,
        meta: chunkQualityArtifactMeta,
      },
    });
    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/cleaning-log.json`,
        meta: cleaningArtifactMeta,
      },
    });
    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/chunks.jsonl`,
        meta: exportMeta,
      },
    });
    await tx.artifact.create({
      data: {
        jobId,
        type: "CHUNKS_JSON",
        path: `inline://jobs/${jobId}/ocr-quality.json`,
        meta: ocrMeta,
      },
    });
    if (diffMeta) {
      await tx.artifact.create({
        data: {
          jobId,
          type: "CHUNKS_JSON",
          path: `inline://jobs/${jobId}/chunk-diff.json`,
          meta: diffMeta,
        },
      });
    }

    await tx.job.update({
      where: { id: jobId },
      data: {
        status: "DONE",
        progress: 100,
        message: `${message} (${CHUNK_PIPELINE_VERSION})`,
        errorDetail:
          chunks.length > 0
            ? `Chunking completed: ${chunks.length} chunks, ${cleaned.length} chars.`
            : "Chunking completed but no chunks were generated.",
      },
    });
  });
  console.log("[chunkingPipeline] done", { jobId, chunkCount: chunks.length });
}

