/**
 * Docling knowledge pipeline start/execute orchestration.
 * Status DTOs, pass gates, and CTA policy live in *-status* / *-shared* modules.
 * Public imports remain stable via re-exports below.
 */
import type {
  NormalizedFigure,
  NormalizedSection,
  NormalizedTable,
} from "@/lib/adapters/docling/docling-types";
import {
  AuditAction,
  DoclingImportBundleStatus,
  PackStatus,
  type PipelineStatus,
  type PipelineStepStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  createKnowledgeRunBinding,
  parseKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  buildKnowledgeFromNormalizedDocument,
  ensureDoclingOriginSourceDocument,
  failDraftIndexGeneration,
} from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import {
  DOCLING_KNOWLEDGE_PIPELINE_STEPS,
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { evaluateNormalizedDocumentStructureQuality } from "@/lib/docling-import/docling-quality-gate";
import {
  asPipelineRecord,
  loadActiveDoclingContext,
  loadOwnedPackForKnowledgePipeline,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-shared";
import {
  BINDING_FAILURE_USER_MESSAGE,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-status-policy";
import {
  completePipelineStep,
  finishPipelineRun,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { logSafeRouteError } from "@/lib/safe-logging";
import {
  assertKnowledgeRunLock,
  touchKnowledgeRunHeartbeat,
} from "@/workers/knowledge-pipeline-job-claim";

export {
  resolveDoclingKnowledgeStageNextAction,
  type DoclingKnowledgeStageView,
  type DoclingKnowledgePipelineStatusDto,
  isDoclingStructurePassed,
  isDoclingSearchFoundationPassed,
  isDoclingKnowledgePipelinePassed,
  getDoclingKnowledgePipelineStatus,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-status";

/** Import-only gate codes that must never fail the knowledge STRUCTURE stage. */
const IMPORT_ONLY_QUALITY_CODES = new Set([
  "REQUIRED_FILES_MISSING",
  "FILE_CHECKSUM_MISSING",
  "MARKDOWN_BASE64_PRESENT",
]);

const asRecord = asPipelineRecord;
const loadOwnedPack = loadOwnedPackForKnowledgePipeline;

async function assertRunStillActive(runId: string): Promise<KnowledgeRunBinding | null> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    select: { status: true, summary: true },
  });
  if (!run || run.status !== "RUNNING") return null;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return null;
  if (binding.cancelRequestedAt) return null;
  return binding;
}

async function markStep(
  packId: string,
  runId: string,
  step: PipelineStatus,
  status: PipelineStepStatus,
  message?: string,
  details?: Record<string, unknown>,
  lockOwner?: string,
) {
  if (lockOwner) {
    const owned = await assertKnowledgeRunLock({ runId, lockOwner });
    if (!owned) return { cancelled: true as const };
  } else {
    const active = await assertRunStillActive(runId);
    if (!active && status === "RUNNING") return { cancelled: true as const };
    if (!active && (status === "PASS" || status === "WARNING" || status === "FAIL")) {
      const run = await prisma.pipelineRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });
      if (run?.status !== "RUNNING") return { cancelled: true as const };
    }
  }

  await completePipelineStep({ runId, step, status, message, details });
  if (status === "RUNNING") {
    await updatePackPipelineStatus({ packId, pipelineStatus: step });
  }
  return { cancelled: false as const };
}

async function failRun(
  packId: string,
  runId: string,
  summary: string,
  binding?: KnowledgeRunBinding | null,
  code?: string,
) {
  const next = binding
    ? serializeKnowledgeRunBinding({
        ...binding,
        failureCode: code ?? binding.failureCode,
        failureMessage: summary,
        userMessage: summary,
        lockOwner: null,
        lockExpiresAt: null,
      })
    : summary;
  await finishPipelineRun({ runId, status: "FAIL", summary: next });
  await updatePackPipelineStatus({ packId, pipelineStatus: "FAILED", message: summary });
}

export async function startDoclingKnowledgePipeline(input: {
  userId: string;
  clientId: string;
  packId: string;
  forceRestart?: boolean;
}): Promise<
  | { ok: true; runId: string; alreadyRunning?: boolean }
  | {
      error:
        | "PROFILE_REQUIRED"
        | "NOT_FOUND"
        | "NOT_DRAFT"
        | "NOT_READY"
        | "PIPELINE_ALREADY_RUNNING"
        | "PIPELINE_CANCEL_PENDING";
      message: string;
      code?: string;
    }
> {
  const owned = await loadOwnedPack(input);
  if ("error" in owned && owned.error) {
    return {
      error: owned.error,
      message:
        owned.error === "PROFILE_REQUIRED"
          ? "제공자 프로필이 필요합니다."
          : "Pack을 찾을 수 없습니다.",
    };
  }
  if (!("pack" in owned) || !owned.pack) {
    return { error: "NOT_FOUND", message: "Pack을 찾을 수 없습니다." };
  }
  if (owned.pack.status !== PackStatus.DRAFT) {
    return {
      error: "NOT_DRAFT",
      message: "초안 상태에서만 지식 데이터 생성을 시작할 수 있습니다.",
    };
  }
  const version = owned.pack.versions[0];
  if (!version) return { error: "NOT_READY", message: "버전이 없습니다." };

  const { bundle, nd } = await loadActiveDoclingContext(input.packId, version.id);
  const fingerprint = nd?.fingerprint ?? null;
  if (!bundle || !nd || !fingerprint) {
    return {
      error: "NOT_READY",
      message:
        "자료 등록에서 대표 샘플 확인을 완료한 뒤 지식 데이터 생성을 시작할 수 있습니다.",
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`knowledge-pipeline:${input.packId}`}))`;

    const existing = await tx.pipelineRun.findFirst({
      where: {
        packId: input.packId,
        triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
        status: { in: ["RUNNING", "PENDING"] },
      },
      orderBy: { startedAt: "desc" },
    });

    if (existing && !input.forceRestart) {
      return {
        ok: true as const,
        runId: existing.id,
        alreadyRunning: true,
      };
    }

    if (existing && input.forceRestart) {
      const bindingExisting = parseKnowledgeRunBinding(existing.summary);
      await tx.pipelineRun.update({
        where: { id: existing.id },
        data: {
          status: "SKIPPED",
          finishedAt: new Date(),
          summary: bindingExisting
            ? serializeKnowledgeRunBinding({
                ...bindingExisting,
                failureCode: "PIPELINE_CANCELLED",
                cancelRequestedAt: new Date().toISOString(),
                userMessage: "강제 재시작으로 취소되었습니다.",
                lockOwner: null,
                lockExpiresAt: null,
              })
            : "강제 재시작으로 취소되었습니다.",
        },
      });
    }

    const indexGenerationId = randomUUID().replace(/-/g, "").slice(0, 24);
    const binding = createKnowledgeRunBinding({
      versionId: version.id,
      normalizedDocumentId: nd.id,
      fingerprint,
      bundleId: bundle.id,
      indexGenerationId,
      requestedByUserId: input.userId,
      requestedByClientId: input.clientId,
    });

    const run = await tx.pipelineRun.create({
      data: {
        packId: input.packId,
        triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
        triggeredByClientId: input.clientId,
        status: "PENDING",
        summary: serializeKnowledgeRunBinding(binding),
        steps: {
          create: DOCLING_KNOWLEDGE_PIPELINE_STEPS.map((step) => ({
            packId: input.packId,
            step,
            status: "PENDING",
          })),
        },
      },
      select: { id: true },
    });

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "DoclingKnowledgePipeline",
      entityId: run.id,
      actorUserId: input.userId,
      metadata: {
        packId: input.packId,
        trigger: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
        fingerprint,
        indexGenerationId,
        forceRestart: Boolean(input.forceRestart),
      },
    }).catch(() => undefined);

    return { ok: true as const, runId: run.id };
  });
}

export async function executeDoclingKnowledgePipeline(input: {
  runId: string;
  packId: string;
  binding: KnowledgeRunBinding;
  lockOwner: string;
}): Promise<void> {
  let binding = input.binding;
  const versionId = binding.versionId;
  const indexGenerationId = binding.indexGenerationId;
  const lockOwner = input.lockOwner;

  const cancelledExit = async (message: string) => {
    await finishPipelineRun({
      runId: input.runId,
      status: "SKIPPED",
      summary: serializeKnowledgeRunBinding({
        ...binding,
        userMessage: message,
        failureCode: "PIPELINE_CANCELLED",
        lockOwner: null,
        lockExpiresAt: null,
      }),
    });
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
  };

  const heartbeat = async (userMessage: string) => {
    const next = await touchKnowledgeRunHeartbeat({
      runId: input.runId,
      lockOwner,
      userMessage,
    });
    if (!next) return false;
    binding = next;
    return true;
  };

  const assertOwned = async () => {
    const owned = await assertKnowledgeRunLock({ runId: input.runId, lockOwner });
    if (!owned) return false;
    binding = owned;
    return true;
  };

  if (!(await heartbeat("문서 구조 확인 준비"))) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  const failBinding = async (code: string) => {
    await markStep(
      input.packId,
      input.runId,
      "STRUCTURE_VALIDATING",
      "FAIL",
      BINDING_FAILURE_USER_MESSAGE,
      { code },
      lockOwner,
    );
    await failRun(input.packId, input.runId, BINDING_FAILURE_USER_MESSAGE, binding, code);
  };

  const boundBundle = await prisma.doclingImportBundle.findFirst({
    where: { id: binding.bundleId },
    include: { files: { select: { role: true } } },
  });
  if (
    !boundBundle ||
    boundBundle.versionId !== versionId ||
    boundBundle.packId !== input.packId
  ) {
    await failBinding("DOCLING_BUNDLE_MISMATCH");
    return;
  }
  if (
    !boundBundle.isActive ||
    boundBundle.status !== DoclingImportBundleStatus.REVIEW_READY
  ) {
    await failBinding("DOCLING_BUNDLE_NOT_READY");
    return;
  }

  const nd = await prisma.normalizedDocument.findFirst({
    where: {
      id: binding.normalizedDocumentId,
      isActive: true,
    },
  });
  if (!nd) {
    await failBinding("NORMALIZED_DOCUMENT_MISMATCH");
    return;
  }
  if (
    nd.versionId !== versionId ||
    nd.bundleId !== boundBundle.id ||
    nd.packId !== input.packId ||
    nd.id !== binding.normalizedDocumentId
  ) {
    await failBinding("NORMALIZED_DOCUMENT_MISMATCH");
    return;
  }
  if (!nd.fingerprint || nd.fingerprint !== binding.fingerprint) {
    await failBinding("FINGERPRINT_MISMATCH");
    return;
  }

  if (!(await assertOwned())) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "STRUCTURE_VALIDATING",
    "RUNNING",
    "문서 구조를 확인하는 중…",
    undefined,
    lockOwner,
  );
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
          .join(",")}; packId=${input.packId}; versionId=${versionId}; bundleId=${boundBundle.id}; normalizedDocumentId=${nd.id}; fingerprint=${nd.fingerprint ?? ""}; validationScope=STRUCTURE_ONLY; bundleStatus=${boundBundle.status}; registeredFileRoles=${boundBundle.files.map((f) => f.role).join(",")}`,
      },
    });
    const blockers = quality.blockers.filter((b) => !IMPORT_ONLY_QUALITY_CODES.has(b.code));
    quality = {
      ...quality,
      blockers,
      ok: blockers.length === 0,
    };
  }
  const summaryJson = asRecord(nd.structureSummaryJson);
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
    await markStep(
      input.packId,
      input.runId,
      "STRUCTURE_VALIDATING",
      "FAIL",
      "문서 구조에 치명적 문제가 있어 지식 단위를 생성할 수 없습니다. 표시된 위치를 확인한 후 파일을 교체하거나 다시 처리해 주세요.",
      structureDetails,
      lockOwner,
    );
    await failRun(input.packId, input.runId, "Structure validation failed", binding);
    return;
  }
  await markStep(
    input.packId,
    input.runId,
    "STRUCTURE_VALIDATING",
    "PASS",
    quality.warnings.length > 0
      ? `문서 구조 확인을 통과했습니다. 확인사항 ${quality.warnings.length}건이 있습니다.`
      : "문서 구조 확인을 통과했습니다.",
    {
      ...structureDetails,
      advisory: quality.warnings.length > 0,
    },
    lockOwner,
  );

  if (!(await heartbeat("지식 단위 생성 중")) || !(await assertOwned())) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "KNOWLEDGE_CHECKING",
    "RUNNING",
    "지식 단위를 생성하는 중…",
    undefined,
    lockOwner,
  );

  const sourceDocumentId = await ensureDoclingOriginSourceDocument({
    versionId,
    packId: input.packId,
    title: nd.title,
    fingerprint: nd.fingerprint,
  });

  if (!nd.fingerprint) {
    await markStep(
      input.packId,
      input.runId,
      "KNOWLEDGE_CHECKING",
      "FAIL",
      "정규화 문서 fingerprint가 없어 검색 세대를 만들 수 없습니다.",
      { code: "SEARCH_GENERATION_REQUIRED" },
      lockOwner,
    );
    await failRun(input.packId, input.runId, "Missing ND fingerprint", binding, "SEARCH_GENERATION_REQUIRED");
    return;
  }

  try {
    const { createSearchGenerationForPipeline } = await import(
      "@/lib/search-generation/search-generation-pipeline-sync"
    );
    await createSearchGenerationForPipeline({
      id: indexGenerationId,
      packId: input.packId,
      versionId,
      pipelineRunId: input.runId,
      normalizedDocumentId: nd.id,
      fingerprint: nd.fingerprint,
      chunkGenerationId: indexGenerationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "search generation create failed";
    await markStep(
      input.packId,
      input.runId,
      "KNOWLEDGE_CHECKING",
      "FAIL",
      "검색 인덱스 세대 생성에 실패했습니다.",
      { code: "SEARCH_GENERATION_REQUIRED" },
      lockOwner,
    );
    await failRun(input.packId, input.runId, message.slice(0, 500), binding, "SEARCH_GENERATION_REQUIRED");
    return;
  }

  let built;
  try {
    built = await buildKnowledgeFromNormalizedDocument({
      versionId,
      normalizedDocumentId: nd.id,
      fingerprint: nd.fingerprint,
      title: nd.title,
      sectionsJson: nd.sectionsJson,
      tablesJson: nd.tablesJson,
      figuresJson: nd.figuresJson,
      pipelineRunId: input.runId,
      indexGenerationId,
      sourceDocumentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "knowledge build failed";
    await markStep(
      input.packId,
      input.runId,
      "KNOWLEDGE_CHECKING",
      "FAIL",
      "지식 단위 생성에 실패했습니다.",
      { code: "KNOWLEDGE_GENERATION_FAILED" },
      lockOwner,
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(input.packId, input.runId, message.slice(0, 500), binding, "KNOWLEDGE_GENERATION_FAILED");
    return;
  }

  if (built.unitCount === 0 || built.stepStatus === "FAIL") {
    await markStep(
      input.packId,
      input.runId,
      "KNOWLEDGE_CHECKING",
      "FAIL",
      built.unitCount === 0
        ? "지식 단위를 생성하지 못했습니다. 정규화 결과의 본문·표·그림 샘플을 확인한 뒤 다시 처리해 주세요."
        : "지식 단위 Coverage 또는 출처 품질 기준을 충족하지 못했습니다. 제외 사유와 유효 본문 coverage를 확인한 뒤 다시 생성해 주세요.",
      {
        unitCount: built.unitCount,
        byType: built.byType,
        excludedCount: built.excludedCount,
        shortSectionMergedCount: built.shortSectionMergedCount,
        shortValidUnitCount: built.shortValidUnitCount,
        warnings: built.warnings,
        coverage: built.coverage,
        sampleUnits: built.sampleUnits,
        stepStatus: built.stepStatus,
      },
      lockOwner,
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(
      input.packId,
      input.runId,
      "Knowledge unit generation failed",
      binding,
      "KNOWLEDGE_COVERAGE_FAILED",
    );
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "KNOWLEDGE_CHECKING",
    built.stepStatus === "WARNING" ? "WARNING" : "PASS",
    built.stepStatus === "WARNING"
      ? `지식 단위 ${built.unitCount}개를 생성했지만 유효 본문 coverage가 보완 권장 구간입니다.`
      : `지식 단위 ${built.unitCount}개를 생성했습니다.`,
    {
      unitCount: built.unitCount,
      byType: built.byType,
      excludedCount: built.excludedCount,
      shortSectionMergedCount: built.shortSectionMergedCount,
      shortValidUnitCount: built.shortValidUnitCount,
      warnings: built.warnings,
      coverage: built.coverage,
      sampleUnits: built.sampleUnits,
      stepStatus: built.stepStatus,
    },
    lockOwner,
  );

  if (built.stepStatus === "WARNING") {
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await finishPipelineRun({
      runId: input.runId,
      status: "WARNING",
      summary: serializeKnowledgeRunBinding({
        ...binding,
        failureCode: "KNOWLEDGE_COVERAGE_WARNING",
        failureMessage: "Knowledge unit coverage below PASS threshold",
        userMessage:
          "지식 단위 품질이 보완 권장 구간입니다. 다시 생성하거나 원문을 확인한 뒤 재검증해 주세요.",
        lockOwner: null,
        lockExpiresAt: null,
      }),
    });
    await updatePackPipelineStatus({
      packId: input.packId,
      pipelineStatus: "FAILED",
      message: "지식 단위 Coverage 보완이 필요합니다.",
    });
    return;
  }

  if (!(await heartbeat("검색 단위 생성 중")) || !(await assertOwned())) {
    await cancelledExit("취소되어 중단되었습니다.");
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "CHUNKING",
    "RUNNING",
    "검색용 Chunk를 생성하는 중…",
    undefined,
    lockOwner,
  );
  if (built.chunkCount === 0) {
    const failCode =
      built.failureCode ??
      (built.tokenGateStatus === "FAIL"
        ? built.tokenGate.hardLimitExceededCount > 0
          ? "PASSAGE_TOKEN_LIMIT_EXCEEDED"
          : "PASSAGE_TARGET_TOKEN_EXCEEDED"
        : "CHUNK_GENERATION_FAILED");
    await markStep(
      input.packId,
      input.runId,
      "CHUNKING",
      "FAIL",
      failCode === "CHUNK_CONTENT_PRESERVATION_FAILED"
        ? "검색 단위 생성 과정에서 원문 범위를 완전히 보존하지 못했습니다. 관리자에게 문의 바랍니다."
        : failCode === "PASSAGE_TARGET_TOKEN_EXCEEDED" ||
            failCode === "PASSAGE_TOKEN_LIMIT_EXCEEDED"
          ? "검색 단위가 모델 입력 기준에 맞지 않습니다. 데이터 구조화를 다시 실행해 주세요."
          : "검색용 Chunk를 생성하지 못했습니다. 지식 단위 내용을 확인한 뒤 다시 생성해 주세요.",
      {
        chunkCount: 0,
        code: failCode,
        tokenGate: built.tokenGate,
        tokenGateStatus: built.tokenGateStatus,
        embeddingProfile: built.embeddingProfile,
        maxTokenCount: built.tokenGate.maxTokenCount,
        hardLimitExceededCount: built.tokenGate.hardLimitExceededCount,
        targetExceededCount: built.tokenGate.targetExceededCount,
      },
      lockOwner,
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(
      input.packId,
      input.runId,
      built.tokenGateStatus === "FAIL" ? "Passage token gate failed" : "Chunk generation failed",
      binding,
      failCode,
    );
    return;
  }

  const buildingChunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      metadata: { path: ["indexGenerationId"], equals: indexGenerationId },
    },
    select: { content: true, metadata: true },
  });
  const lengths = buildingChunks.map((c) => c.content.length);
  const avg =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;

  // Structure completion requires Token Gate PASS only (WARNING is not completable).
  if (built.tokenGateStatus !== "PASS") {
    await markStep(
      input.packId,
      input.runId,
      "CHUNKING",
      "FAIL",
      "검색 단위가 모델 입력 기준에 맞지 않습니다. 데이터 구조화를 다시 실행해 주세요.",
      {
        chunkCount: built.chunkCount,
        code: built.failureCode ?? "PASSAGE_TARGET_TOKEN_EXCEEDED",
        tokenGate: built.tokenGate,
        tokenGateStatus: built.tokenGateStatus,
        embeddingProfile: built.embeddingProfile,
        maxTokenCount: built.tokenGate.maxTokenCount,
        hardLimitExceededCount: built.tokenGate.hardLimitExceededCount,
        targetExceededCount: built.tokenGate.targetExceededCount,
      },
      lockOwner,
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(
      input.packId,
      input.runId,
      "Passage token gate not PASS",
      binding,
      built.failureCode ?? "PASSAGE_TARGET_TOKEN_EXCEEDED",
    );
    return;
  }

  const chunkStepStatus = built.coverage.provenanceMissing > 0 ? "WARNING" : "PASS";
  if (chunkStepStatus !== "PASS") {
    await markStep(
      input.packId,
      input.runId,
      "CHUNKING",
      "WARNING",
      `검색 Chunk ${built.chunkCount}개를 생성했지만 출처 추적이 불완전합니다.`,
      {
        chunkCount: built.chunkCount,
        averageLength: avg,
        minLength: lengths.length ? Math.min(...lengths) : 0,
        maxLength: lengths.length ? Math.max(...lengths) : 0,
        coverage: built.coverage,
        tokenGate: built.tokenGate,
        tokenGateStatus: built.tokenGateStatus,
        embeddingProfile: built.embeddingProfile,
      },
      lockOwner,
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await finishPipelineRun({
      runId: input.runId,
      status: "WARNING",
      summary: serializeKnowledgeRunBinding({
        ...binding,
        userMessage: `검색 Chunk 출처 보완 필요 (chunks=${built.chunkCount})`,
        lockOwner: null,
        lockExpiresAt: null,
      }),
    });
    await updatePackPipelineStatus({
      packId: input.packId,
      pipelineStatus: "FAILED",
      message: "Docling structure pipeline warning — provenance incomplete",
    });
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "CHUNKING",
    "PASS",
    `검색 Chunk ${built.chunkCount}개를 생성했습니다. Token Gate 통과.`,
    {
      chunkCount: built.chunkCount,
      averageLength: avg,
      minLength: lengths.length ? Math.min(...lengths) : 0,
      maxLength: lengths.length ? Math.max(...lengths) : 0,
      shortCount: lengths.filter((n) => n < 80).length,
      longCount: lengths.filter((n) => n > 3500).length,
      mergedCount: built.mergedCount,
      sampleChunks: built.sampleChunks,
      coverage: built.coverage,
      indexStatus: "BUILDING",
      tokenGate: built.tokenGate,
      tokenGateStatus: built.tokenGateStatus,
      embeddingProfile: built.embeddingProfile,
      maxTokenCount: built.tokenGate.maxTokenCount,
      withinTargetCount: built.tokenGate.withinTargetCount,
      targetExceededCount: built.tokenGate.targetExceededCount,
      hardLimitExceededCount: built.tokenGate.hardLimitExceededCount,
    },
    lockOwner,
  );

  // Publish chunkCount for later search-data enqueue. Claim requires attempt > 0
  // (structure creates attempt=0; user "검색데이터 생성" bumps attempt).
  await prisma.searchIndexGeneration.updateMany({
    where: { id: indexGenerationId, status: { in: ["PENDING", "EMBEDDING"] } },
    data: { chunkCount: built.chunkCount },
  });

  // Structure pipeline ends here — embedding / eval / DRAFT READY belong to search-data worker.
  await finishPipelineRun({
    runId: input.runId,
    status: "PASS",
    summary: serializeKnowledgeRunBinding({
      ...binding,
      userMessage: `데이터 구조화 완료 · 검색데이터 생성 대기 (units=${built.unitCount}, chunks=${built.chunkCount})`,
      lockOwner: null,
      lockExpiresAt: null,
    }),
  });
  const { markServiceValidationsStaleForVersion } = await import(
    "@/lib/distribution/mark-service-validations-stale"
  );
  await markServiceValidationsStaleForVersion(versionId);
  await updatePackPipelineStatus({
    packId: input.packId,
    pipelineStatus: "CHUNKING",
    message: "Docling structure pipeline passed — awaiting search data",
  });
}

export function missingRequirementsForReview(input: {
  materialReady: boolean;
  knowledgePassed: boolean;
  distributionReady: boolean;
  structurePassed?: boolean;
  searchFoundationPassed?: boolean;
  allPreparationChannelsPassed?: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.materialReady) missing.push("DOCLING_REVIEW_READY");
  const structurePassed = input.structurePassed ?? input.knowledgePassed;
  const searchFoundationPassed = input.searchFoundationPassed ?? input.knowledgePassed;
  if (!structurePassed) missing.push("DATA_STRUCTURE_PASSED");
  if (!searchFoundationPassed) missing.push("SEARCH_FOUNDATION_PASSED");
  // Compat: keep historical code when full knowledge gate fails
  if (!input.knowledgePassed) missing.push("RETRIEVAL_EVALUATION_PASSED");
  if (input.allPreparationChannelsPassed === false) {
    missing.push("PREPARATION_CHANNELS_PASSED");
  }
  if (!input.distributionReady) missing.push("DISTRIBUTION_INFO_COMPLETED");
  return missing;
}

/** @deprecated Prefer worker claim — kept for tests that call execute directly. */
export async function executeDoclingKnowledgePipelineByIds(input: {
  runId: string;
  packId: string;
  versionId: string;
  normalizedDocumentId: string;
  lockOwner?: string;
}): Promise<void> {
  const run = await prisma.pipelineRun.findUnique({ where: { id: input.runId } });
  const binding =
    parseKnowledgeRunBinding(run?.summary) ??
    createKnowledgeRunBinding({
      versionId: input.versionId,
      normalizedDocumentId: input.normalizedDocumentId,
      fingerprint: "unknown",
      bundleId: "unknown",
      indexGenerationId: randomUUID().replace(/-/g, "").slice(0, 24),
    });
  const lockOwner = input.lockOwner ?? binding.lockOwner ?? "test-owner";
  binding.lockOwner = lockOwner;
  binding.lockExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await prisma.pipelineRun.update({
    where: { id: input.runId },
    data: {
      status: "RUNNING",
      summary: serializeKnowledgeRunBinding(binding),
    },
  });
  await executeDoclingKnowledgePipeline({
    runId: input.runId,
    packId: input.packId,
    binding,
    lockOwner,
  });
}
