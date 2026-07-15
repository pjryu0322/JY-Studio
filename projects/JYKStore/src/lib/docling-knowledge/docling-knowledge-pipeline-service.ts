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
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import { buildKnowledgeFromNormalizedDocument } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import {
  DOCLING_KNOWLEDGE_PIPELINE_STEPS,
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_KNOWLEDGE_STAGES,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
  type DoclingKnowledgeStageId,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { evaluateNormalizedDocumentQuality } from "@/lib/docling-import/docling-quality-gate";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { runRetrievalForEvaluation } from "@/lib/retrieval-service";

export type DoclingKnowledgeStageView = {
  id: DoclingKnowledgeStageId;
  label: string;
  description: string;
  pipelineStep: string;
  status: string;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  details: Record<string, unknown> | null;
  nextAction: string | null;
};

export type DoclingKnowledgePipelineStatusDto = {
  packId: string;
  enabled: boolean;
  providerConfirmed: boolean;
  pipelineStatus: string | null;
  runId: string | null;
  runStatus: string | null;
  fingerprint: string | null;
  stale: boolean;
  passed: boolean;
  stages: DoclingKnowledgeStageView[];
  canStart: boolean;
  canRetry: boolean;
  canOpenDistribution: boolean;
  lockReason: string | null;
  summary: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function loadOwnedPack(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) return { error: "PROFILE_REQUIRED" as const };

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: { distributionMetadata: true },
      },
    },
  });
  if (!pack) return { error: "NOT_FOUND" as const };
  return { profile, pack };
}

async function loadActiveDoclingContext(packId: string, versionId: string) {
  const bundle = await prisma.doclingImportBundle.findFirst({
    where: {
      packId,
      versionId,
      isActive: true,
      status: DoclingImportBundleStatus.REVIEW_READY,
    },
    include: {
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });
  return { bundle, nd: bundle?.normalizedDocuments[0] ?? null };
}

export async function isDoclingKnowledgePipelinePassed(packId: string): Promise<boolean> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { pipelineStatus: true },
  });
  if (!pack) return false;
  if (
    pack.pipelineStatus === "READY_FOR_REVIEW" ||
    pack.pipelineStatus === "REVIEWING" ||
    pack.pipelineStatus === "APPROVED" ||
    pack.pipelineStatus === "PUBLISHED"
  ) {
    return true;
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  if (!latest || latest.status !== "PASS") return false;
  const evalStep = latest.steps.find((s) => s.step === "SEARCH_EVALUATING");
  return evalStep?.status === "PASS" || evalStep?.status === "WARNING";
}

export async function getDoclingKnowledgePipelineStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  DoclingKnowledgePipelineStatusDto | { error: "PROFILE_REQUIRED" | "NOT_FOUND" }
> {
  const owned = await loadOwnedPack(input);
  if ("error" in owned) return owned;
  const version = owned.pack.versions[0];

  if (!version) {
    return {
      packId: input.packId,
      enabled: true,
      providerConfirmed: false,
      pipelineStatus: owned.pack.pipelineStatus,
      runId: null,
      runStatus: null,
      fingerprint: null,
      stale: false,
      passed: false,
      stages: DOCLING_KNOWLEDGE_STAGES.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        pipelineStep: s.pipelineStep,
        status: "PENDING",
        message: null,
        startedAt: null,
        finishedAt: null,
        details: null,
        nextAction: "자료 등록에서 정규화 결과를 확인해 주세요.",
      })),
      canStart: false,
      canRetry: false,
      canOpenDistribution: false,
      lockReason: "자료 등록과 대표 샘플 확인이 필요합니다.",
      summary: null,
    };
  }

  const { bundle, nd } = await loadActiveDoclingContext(input.packId, version.id);
  const providerConfirmed = Boolean(bundle && nd);
  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });

  const readyStep = latest?.steps.find((s) => s.step === "READY_FOR_REVIEW");
  const detailsFingerprint = asRecord(readyStep?.details)?.fingerprint;
  const ndFingerprint = nd?.fingerprint ?? null;
  const stale = Boolean(
    typeof detailsFingerprint === "string" &&
      ndFingerprint &&
      detailsFingerprint !== ndFingerprint,
  );
  const evalStep = latest?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  const passed =
    !stale &&
    (owned.pack.pipelineStatus === "READY_FOR_REVIEW" ||
      owned.pack.pipelineStatus === "REVIEWING" ||
      owned.pack.pipelineStatus === "APPROVED" ||
      owned.pack.pipelineStatus === "PUBLISHED" ||
      (latest?.status === "PASS" &&
        (evalStep?.status === "PASS" || evalStep?.status === "WARNING")));

  const running = latest?.status === "RUNNING";
  const failed = latest?.status === "FAIL" || owned.pack.pipelineStatus === "FAILED";

  const stages: DoclingKnowledgeStageView[] = DOCLING_KNOWLEDGE_STAGES.map((s) => {
    const step = latest?.steps.find((x) => x.step === s.pipelineStep);
    const status = stale ? "STALE" : (step?.status ?? "PENDING");
    let nextAction: string | null = null;
    if (status === "FAIL") {
      nextAction =
        s.id === "STRUCTURE"
          ? "표시된 구조 문제를 확인한 뒤 파일을 교체하거나 다시 처리해 주세요."
          : s.id === "RETRIEVAL_EVALUATION"
            ? "미통과 질문을 확인한 뒤 검색 데이터를 다시 생성하거나 재검증해 주세요."
            : "실패 원인을 확인한 뒤 해당 단계부터 다시 실행해 주세요.";
    } else if (status === "STALE") {
      nextAction = "원본 또는 정규화 결과가 변경되었습니다. 지식 데이터를 다시 생성해 주세요.";
    } else if (status === "PENDING" && providerConfirmed && !running) {
      nextAction = "지식 데이터 생성을 시작해 주세요.";
    }
    return {
      id: s.id,
      label: s.label,
      description: s.description,
      pipelineStep: s.pipelineStep,
      status,
      message: step?.message ?? null,
      startedAt: step?.startedAt?.toISOString() ?? null,
      finishedAt: step?.finishedAt?.toISOString() ?? null,
      details: asRecord(step?.details),
      nextAction,
    };
  });

  let lockReason: string | null = null;
  if (!providerConfirmed) {
    lockReason =
      "자료 등록에서 대표 샘플 확인을 완료해야 지식 데이터 생성을 시작할 수 있습니다.";
  } else if (!passed) {
    lockReason = "지식 데이터 생성이 완료되면 유통정보를 입력할 수 있습니다.";
  }

  return {
    packId: input.packId,
    enabled: true,
    providerConfirmed,
    pipelineStatus: owned.pack.pipelineStatus,
    runId: latest?.id ?? null,
    runStatus: latest?.status ?? null,
    fingerprint: ndFingerprint,
    stale,
    passed,
    stages,
    canStart: providerConfirmed && owned.pack.status === PackStatus.DRAFT && !running,
    canRetry:
      providerConfirmed &&
      owned.pack.status === PackStatus.DRAFT &&
      (failed || stale || (!running && providerConfirmed)),
    canOpenDistribution: passed && owned.pack.status === PackStatus.DRAFT,
    lockReason,
    summary: latest?.summary ?? null,
  };
}

async function markStep(
  packId: string,
  runId: string,
  step: PipelineStatus,
  status: PipelineStepStatus,
  message?: string,
  details?: Record<string, unknown>,
) {
  await completePipelineStep({ runId, step, status, message, details });
  if (status === "RUNNING") {
    await updatePackPipelineStatus({ packId, pipelineStatus: step });
  }
}

async function failRun(packId: string, runId: string, summary: string) {
  await finishPipelineRun({ runId, status: "FAIL", summary });
  await updatePackPipelineStatus({ packId, pipelineStatus: "FAILED", message: summary });
}

async function runDoclingRetrievalSmoke(input: {
  packId: string;
  versionId: string;
}): Promise<{
  status: "PASS" | "WARNING" | "FAIL";
  questionCount: number;
  passedCount: number;
  failedCount: number;
  recallAt5: number;
  top3HitRate: number;
  provenanceRate: number;
  failures: Array<{ query: string; expectedChunkId: string }>;
}> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      isActive: true,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
    },
    orderBy: { sortOrder: "asc" },
    take: 8,
    select: { id: true, title: true },
  });

  const failures: Array<{ query: string; expectedChunkId: string }> = [];
  let top3Hits = 0;
  let provenanceHits = 0;

  for (const chunk of chunks) {
    const query = chunk.title.trim();
    if (!query) continue;
    const ranked = await runRetrievalForEvaluation({
      knowledgePackId: input.packId,
      versionId: input.versionId,
      query,
      retrievalMode: "hybrid",
      topK: 5,
    });
    const ids = ranked.map((r) => r.chunkId);
    const hitAt5 = ids.includes(chunk.id);
    const hitAt3 = ids.slice(0, 3).includes(chunk.id);
    if (hitAt5) provenanceHits += 1;
    else failures.push({ query, expectedChunkId: chunk.id });
    if (hitAt3) top3Hits += 1;
  }

  const questionCount = chunks.filter((c) => c.title.trim()).length;
  const passedCount = questionCount - failures.length;
  const recallAt5 = questionCount > 0 ? passedCount / questionCount : 0;
  const top3HitRate = questionCount > 0 ? top3Hits / questionCount : 0;
  const provenanceRate = questionCount > 0 ? provenanceHits / questionCount : 0;

  let status: "PASS" | "WARNING" | "FAIL" = "PASS";
  if (questionCount === 0 || recallAt5 < 0.8 || top3HitRate < 0.75 || provenanceRate < 1) {
    status = recallAt5 < 0.5 ? "FAIL" : "WARNING";
  }
  if (failures.length === 0 && questionCount > 0) status = "PASS";

  return {
    status,
    questionCount,
    passedCount,
    failedCount: failures.length,
    recallAt5,
    top3HitRate,
    provenanceRate,
    failures: failures.slice(0, 5),
  };
}

export async function startDoclingKnowledgePipeline(input: {
  userId: string;
  clientId: string;
  packId: string;
  forceRestart?: boolean;
}): Promise<
  | { ok: true; runId: string; alreadyRunning?: boolean }
  | {
      error: "PROFILE_REQUIRED" | "NOT_FOUND" | "NOT_DRAFT" | "NOT_READY";
      message: string;
    }
> {
  const owned = await loadOwnedPack(input);
  if ("error" in owned) return owned;
  if (owned.pack.status !== PackStatus.DRAFT) {
    return {
      error: "NOT_DRAFT",
      message: "초안 상태에서만 지식 데이터 생성을 시작할 수 있습니다.",
    };
  }
  const version = owned.pack.versions[0];
  if (!version) return { error: "NOT_READY", message: "버전이 없습니다." };

  const { bundle, nd } = await loadActiveDoclingContext(input.packId, version.id);
  if (!bundle || !nd) {
    return {
      error: "NOT_READY",
      message:
        "자료 등록에서 대표 샘플 확인을 완료한 뒤 지식 데이터 생성을 시작할 수 있습니다.",
    };
  }

  const existing = await prisma.pipelineRun.findFirst({
    where: {
      packId: input.packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "RUNNING",
    },
    orderBy: { startedAt: "desc" },
  });
  if (existing && !input.forceRestart) {
    return { ok: true, runId: existing.id, alreadyRunning: true };
  }

  const created = await createPipelineRun({
    packId: input.packId,
    triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
    triggeredByClientId: input.clientId,
    steps: DOCLING_KNOWLEDGE_PIPELINE_STEPS,
  });
  if ("error" in created) {
    return { error: "NOT_FOUND", message: "Pack을 찾을 수 없습니다." };
  }

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "DoclingKnowledgePipeline",
    entityId: created.runId,
    actorUserId: input.userId,
    metadata: {
      packId: input.packId,
      trigger: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      fingerprint: nd.fingerprint,
    },
  }).catch(() => undefined);

  void executeDoclingKnowledgePipeline({
    runId: created.runId,
    packId: input.packId,
    versionId: version.id,
    normalizedDocumentId: nd.id,
  }).catch(async (error) => {
    const message = error instanceof Error ? error.message : "pipeline failed";
    await failRun(input.packId, created.runId, message.slice(0, 500)).catch(() => undefined);
  });

  return { ok: true, runId: created.runId };
}

export async function executeDoclingKnowledgePipeline(input: {
  runId: string;
  packId: string;
  versionId: string;
  normalizedDocumentId: string;
}): Promise<void> {
  const nd = await prisma.normalizedDocument.findFirst({
    where: { id: input.normalizedDocumentId, isActive: true },
  });
  if (!nd) {
    await markStep(
      input.packId,
      input.runId,
      "STRUCTURE_VALIDATING",
      "FAIL",
      "활성 NormalizedDocument가 없습니다.",
    );
    await failRun(input.packId, input.runId, "NormalizedDocument missing");
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "STRUCTURE_VALIDATING",
    "RUNNING",
    "문서 구조를 확인하는 중…",
  );
  const sections = (Array.isArray(nd.sectionsJson) ? nd.sectionsJson : []) as NormalizedSection[];
  const tables = (Array.isArray(nd.tablesJson) ? nd.tablesJson : []) as NormalizedTable[];
  const figures = (Array.isArray(nd.figuresJson) ? nd.figuresJson : []) as NormalizedFigure[];
  const readingOrder = Array.isArray(nd.readingOrderJson)
    ? (nd.readingOrderJson as Array<{ index: number; ref: string; kind: string | null }>)
    : [];
  const quality = evaluateNormalizedDocumentQuality({
    title: nd.title,
    language: nd.language,
    sections,
    tables,
    figures,
    readingOrder,
    files: [],
    hasNormalizedDocument: true,
    markdownPreview: null,
  });
  const summaryJson = asRecord(nd.structureSummaryJson);
  const structureDetails = {
    headingCount: Number(summaryJson?.headingCount ?? 0),
    paragraphCount: Number(summaryJson?.paragraphCount ?? 0),
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
    );
    await failRun(input.packId, input.runId, "Structure validation failed");
    return;
  }
  await markStep(
    input.packId,
    input.runId,
    "STRUCTURE_VALIDATING",
    quality.warnings.length > 0 ? "WARNING" : "PASS",
    quality.warnings.length > 0
      ? "구조 확인을 통과했지만 확인이 필요한 경고가 있습니다."
      : "문서 구조 확인을 통과했습니다.",
    structureDetails,
  );

  await markStep(
    input.packId,
    input.runId,
    "KNOWLEDGE_CHECKING",
    "RUNNING",
    "지식 단위를 생성하는 중…",
  );
  const built = await buildKnowledgeFromNormalizedDocument({
    versionId: input.versionId,
    normalizedDocumentId: nd.id,
    fingerprint: nd.fingerprint,
    title: nd.title,
    sectionsJson: nd.sectionsJson,
    tablesJson: nd.tablesJson,
    figuresJson: nd.figuresJson,
  });
  if (built.unitCount === 0) {
    await markStep(
      input.packId,
      input.runId,
      "KNOWLEDGE_CHECKING",
      "FAIL",
      "지식 단위를 생성하지 못했습니다. 정규화 결과의 본문·표·그림 샘플을 확인한 뒤 다시 처리해 주세요.",
      { ...built },
    );
    await failRun(input.packId, input.runId, "Knowledge unit generation failed");
    return;
  }
  await markStep(
    input.packId,
    input.runId,
    "KNOWLEDGE_CHECKING",
    built.warnings.length > 0 ? "WARNING" : "PASS",
    `지식 단위 ${built.unitCount}개를 생성했습니다.`,
    {
      unitCount: built.unitCount,
      byType: built.byType,
      excludedCount: built.excludedCount,
      warnings: built.warnings,
    },
  );

  await markStep(
    input.packId,
    input.runId,
    "CHUNKING",
    "RUNNING",
    "검색 데이터를 생성하는 중…",
  );
  if (built.chunkCount === 0) {
    await markStep(
      input.packId,
      input.runId,
      "CHUNKING",
      "FAIL",
      "검색용 Chunk를 생성하지 못했습니다. 지식 단위 내용을 확인한 뒤 다시 생성해 주세요.",
      { chunkCount: 0 },
    );
    await failRun(input.packId, input.runId, "Chunk generation failed");
    return;
  }
  const activeChunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      isActive: true,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
    },
    select: { content: true },
  });
  const lengths = activeChunks.map((c) => c.content.length);
  const avg =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;
  await markStep(
    input.packId,
    input.runId,
    "CHUNKING",
    "PASS",
    `검색 Chunk ${built.chunkCount}개를 생성했습니다.`,
    {
      chunkCount: built.chunkCount,
      averageLength: avg,
      shortCount: lengths.filter((n) => n < 80).length,
      longCount: lengths.filter((n) => n > 3500).length,
      mergedCount: built.mergedCount,
    },
  );

  await markStep(
    input.packId,
    input.runId,
    "INDEXING",
    "RUNNING",
    "검색 인덱스를 생성하는 중…",
  );
  const embeddings = await rebuildPackEmbeddings({
    packId: input.packId,
    force: true,
  });
  if (!embeddings) {
    await markStep(
      input.packId,
      input.runId,
      "INDEXING",
      "FAIL",
      "검색 인덱스(Embedding) 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
    await failRun(input.packId, input.runId, "Index build failed");
    return;
  }
  await markStep(
    input.packId,
    input.runId,
    "INDEXING",
    "PASS",
    `Draft 검색 Index를 생성했습니다. (처리 ${embeddings.processedCount}건)`,
    { draft: true, ...embeddings },
  );

  await markStep(
    input.packId,
    input.runId,
    "SEARCH_EVALUATING",
    "RUNNING",
    "검색 결과를 검증하는 중…",
  );
  const smoke = await runDoclingRetrievalSmoke({
    packId: input.packId,
    versionId: input.versionId,
  });
  if (smoke.status === "FAIL") {
    await markStep(
      input.packId,
      input.runId,
      "SEARCH_EVALUATING",
      "FAIL",
      "검색 결과가 기준을 충족하지 못했습니다. 미통과 질문을 확인한 후 검색 데이터를 다시 생성해 주세요.",
      smoke as unknown as Record<string, unknown>,
    );
    await failRun(input.packId, input.runId, "Retrieval evaluation below threshold");
    return;
  }
  await markStep(
    input.packId,
    input.runId,
    "SEARCH_EVALUATING",
    smoke.status === "WARNING" ? "WARNING" : "PASS",
    smoke.status === "WARNING"
      ? "검색 검증을 통과했지만 보완이 권장됩니다."
      : "검색 결과 검증을 통과했습니다.",
    smoke as unknown as Record<string, unknown>,
  );

  await markStep(
    input.packId,
    input.runId,
    "READY_FOR_REVIEW",
    "PASS",
    "지식 데이터 생성 완료",
    { fingerprint: nd.fingerprint },
  );
  await finishPipelineRun({
    runId: input.runId,
    status: "PASS",
    summary: `지식 데이터 생성 완료 (units=${built.unitCount}, chunks=${built.chunkCount})`,
  });
  await updatePackPipelineStatus({
    packId: input.packId,
    pipelineStatus: "READY_FOR_REVIEW",
    message: "Docling knowledge pipeline passed",
  });
}

export function missingRequirementsForReview(input: {
  materialReady: boolean;
  knowledgePassed: boolean;
  distributionReady: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.materialReady) missing.push("DOCLING_REVIEW_READY");
  if (!input.knowledgePassed) missing.push("RETRIEVAL_EVALUATION_PASSED");
  if (!input.distributionReady) missing.push("DISTRIBUTION_INFO_COMPLETED");
  return missing;
}
