/**
 * STRUCTURE stage runner for Docling knowledge pipeline.
 */
import type {
  NormalizedFigure,
  NormalizedSection,
  NormalizedTable,
} from "@/lib/adapters/docling/docling-types";
import { DoclingImportBundleStatus } from "@prisma/client";
import { asPipelineRecord } from "@/lib/docling-knowledge/docling-knowledge-pipeline-shared";
import type {
  DoclingPipelineExecutionContext,
  StageResult,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-execution-context";
import {
  failBindingMismatch,
  failPipelineRun,
  markPipelineStep,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-failure";
import { evaluateNormalizedDocumentStructureQuality } from "@/lib/docling-import/docling-quality-gate";
import { prisma } from "@/lib/prisma";
import { logSafeRouteError } from "@/lib/safe-logging";

/** Import-only gate codes that must never fail the knowledge STRUCTURE stage. */
const IMPORT_ONLY_QUALITY_CODES = new Set([
  "REQUIRED_FILES_MISSING",
  "FILE_CHECKSUM_MISSING",
  "MARKDOWN_BASE64_PRESENT",
]);

export type StructureStageMaterials = {
  nd: NonNullable<Awaited<ReturnType<typeof prisma.normalizedDocument.findFirst>>>;
  boundBundle: NonNullable<
    Awaited<ReturnType<typeof prisma.doclingImportBundle.findFirst>>
  > & { files: Array<{ role: string }> };
};

export async function runStructureStage(
  ctx: DoclingPipelineExecutionContext,
): Promise<StageResult & { materials?: StructureStageMaterials }> {
  const { packId, runId, lockOwner, versionId } = ctx;

  const boundBundle = await prisma.doclingImportBundle.findFirst({
    where: { id: ctx.binding.bundleId },
    include: { files: { select: { role: true } } },
  });
  if (
    !boundBundle ||
    boundBundle.versionId !== versionId ||
    boundBundle.packId !== packId
  ) {
    await failBindingMismatch({
      packId,
      runId,
      lockOwner,
      binding: ctx.binding,
      code: "DOCLING_BUNDLE_MISMATCH",
    });
    return { ok: false };
  }
  if (!boundBundle.isActive || boundBundle.status !== DoclingImportBundleStatus.REVIEW_READY) {
    await failBindingMismatch({
      packId,
      runId,
      lockOwner,
      binding: ctx.binding,
      code: "DOCLING_BUNDLE_NOT_READY",
    });
    return { ok: false };
  }

  const nd = await prisma.normalizedDocument.findFirst({
    where: { id: ctx.binding.normalizedDocumentId, isActive: true },
  });
  if (!nd) {
    await failBindingMismatch({
      packId,
      runId,
      lockOwner,
      binding: ctx.binding,
      code: "NORMALIZED_DOCUMENT_MISMATCH",
    });
    return { ok: false };
  }
  if (
    nd.versionId !== versionId ||
    nd.bundleId !== boundBundle.id ||
    nd.packId !== packId ||
    nd.id !== ctx.binding.normalizedDocumentId
  ) {
    await failBindingMismatch({
      packId,
      runId,
      lockOwner,
      binding: ctx.binding,
      code: "NORMALIZED_DOCUMENT_MISMATCH",
    });
    return { ok: false };
  }
  if (!nd.fingerprint || nd.fingerprint !== ctx.binding.fingerprint) {
    await failBindingMismatch({
      packId,
      runId,
      lockOwner,
      binding: ctx.binding,
      code: "FINGERPRINT_MISMATCH",
    });
    return { ok: false };
  }

  if (!(await ctx.assertOwned())) {
    await ctx.cancelledExit("취소되어 중단되었습니다.");
    return { ok: false };
  }

  await markPipelineStep({
    packId,
    runId,
    step: "STRUCTURE_VALIDATING",
    status: "RUNNING",
    message: "문서 구조를 확인하는 중…",
    lockOwner,
  });

  const sections = (Array.isArray(nd.sectionsJson) ? nd.sectionsJson : []) as unknown as NormalizedSection[];
  const tables = (Array.isArray(nd.tablesJson) ? nd.tablesJson : []) as unknown as NormalizedTable[];
  const figures = (Array.isArray(nd.figuresJson) ? nd.figuresJson : []) as unknown as NormalizedFigure[];
  const readingOrder = Array.isArray(nd.readingOrderJson)
    ? (nd.readingOrderJson as unknown as Array<{ index: number; ref: string; kind: string | null }>)
    : [];
  let quality = evaluateNormalizedDocumentStructureQuality({
    title: nd.title,
    language: nd.language,
    sections,
    tables,
    figures,
    readingOrder,
    hasNormalizedDocument: true,
    markdownPreview: null,
  });
  const leakedImportBlockers = quality.blockers.filter((b) => IMPORT_ONLY_QUALITY_CODES.has(b.code));
  if (leakedImportBlockers.length > 0) {
    logSafeRouteError({
      scope: "docling-knowledge-structure",
      method: "PIPELINE",
      path: "STRUCTURE_VALIDATING",
      error: {
        code: "STRUCTURE_IMPORT_GATE_LEAK",
        message: `import-only quality codes leaked into STRUCTURE_ONLY: ${leakedImportBlockers
          .map((b) => b.code)
          .join(",")}; packId=${packId}; versionId=${versionId}; bundleId=${boundBundle.id}; normalizedDocumentId=${nd.id}; fingerprint=${nd.fingerprint ?? ""}; validationScope=STRUCTURE_ONLY; bundleStatus=${boundBundle.status}; registeredFileRoles=${boundBundle.files.map((f) => f.role).join(",")}`,
      },
    });
    const blockers = quality.blockers.filter((b) => !IMPORT_ONLY_QUALITY_CODES.has(b.code));
    quality = { ...quality, blockers, ok: blockers.length === 0 };
  }

  const summaryJson = asPipelineRecord(nd.structureSummaryJson);
  const structureDetails = {
    headingCount: Number(summaryJson?.headingCount ?? quality.summary.headingCount ?? 0),
    paragraphCount: Number(summaryJson?.paragraphCount ?? quality.summary.paragraphCount ?? 0),
    tableCount: Number(summaryJson?.tableCount ?? tables.length),
    figureCount: Number(summaryJson?.figureCount ?? figures.length),
    blockerCount: quality.blockers.length,
    warningCount: quality.warnings.length,
    blockers: quality.blockers.slice(0, 8),
    warnings: quality.warnings.slice(0, 8),
  };

  if (quality.blockers.length > 0 || !quality.ok) {
    await markPipelineStep({
      packId,
      runId,
      step: "STRUCTURE_VALIDATING",
      status: "FAIL",
      message:
        "문서 구조에 치명적 문제가 있어 지식 단위를 생성할 수 없습니다. 표시된 위치를 확인한 후 파일을 교체하거나 다시 처리해 주세요.",
      details: structureDetails,
      lockOwner,
    });
    await failPipelineRun({
      packId,
      runId,
      userMessage: "Structure validation failed",
      binding: ctx.binding,
    });
    return { ok: false };
  }

  await markPipelineStep({
    packId,
    runId,
    step: "STRUCTURE_VALIDATING",
    status: "PASS",
    message:
      quality.warnings.length > 0
        ? `문서 구조 확인을 통과했습니다. 확인사항 ${quality.warnings.length}건이 있습니다.`
        : "문서 구조 확인을 통과했습니다.",
    details: { ...structureDetails, advisory: quality.warnings.length > 0 },
    lockOwner,
  });

  return { ok: true, materials: { nd, boundBundle } };
}
