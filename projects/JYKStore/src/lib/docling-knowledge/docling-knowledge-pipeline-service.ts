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
import { rebuildPackEmbeddings } from "@/lib/chunk-embedding-service";
import {
  DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION,
  runDoclingRetrievalEvaluation,
} from "@/lib/docling-knowledge/docling-knowledge-eval";
import {
  createKnowledgeRunBinding,
  humanSummaryFromBinding,
  parseKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  activateDraftIndexGeneration,
  buildKnowledgeFromNormalizedDocument,
  ensureDoclingOriginSourceDocument,
  failDraftIndexGeneration,
} from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
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
  finishPipelineRun,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";
import { touchKnowledgeRunHeartbeat } from "@/workers/knowledge-pipeline-job-claim";

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
  primaryCta: "start" | "retry" | "distribution" | "warning_retry" | "none";
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

function bindingMatchesActive(input: {
  binding: KnowledgeRunBinding | null;
  versionId: string;
  ndId: string;
  fingerprint: string | null;
  bundleId: string;
}): boolean {
  if (!input.binding || !input.fingerprint) return false;
  return (
    input.binding.versionId === input.versionId &&
    input.binding.normalizedDocumentId === input.ndId &&
    input.binding.fingerprint === input.fingerprint &&
    input.binding.bundleId === input.bundleId
  );
}

/**
 * Server gate: fingerprint/version/ND-bound PASS only.
 * Pack pipelineStatus alone is never sufficient.
 */
export async function isDoclingKnowledgePipelinePassed(packId: string): Promise<boolean> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true },
  });
  if (!pack) return false;

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    select: { id: true },
  });
  if (!version) return false;

  const { bundle, nd } = await loadActiveDoclingContext(packId, version.id);
  if (!bundle || !nd?.fingerprint) return false;

  const latestPass = await prisma.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "PASS",
    },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  if (!latestPass) return false;

  const readyStep = latestPass.steps.find((s) => s.step === "READY_FOR_REVIEW");
  const evalStep = latestPass.steps.find((s) => s.step === "SEARCH_EVALUATING");
  if (readyStep?.status !== "PASS") return false;
  if (evalStep?.status !== "PASS") {
    if (
      !(
        DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION &&
        evalStep?.status === "WARNING"
      )
    ) {
      return false;
    }
  }

  const binding =
    parseKnowledgeRunBinding(latestPass.summary) ??
    (() => {
      const details = asRecord(readyStep.details);
      if (!details) return null;
      return {
        v: 1 as const,
        versionId: String(details.versionId ?? ""),
        normalizedDocumentId: String(details.normalizedDocumentId ?? ""),
        fingerprint: String(details.fingerprint ?? ""),
        bundleId: String(details.bundleId ?? ""),
        indexGenerationId: String(details.indexGenerationId ?? ""),
        heartbeatAt: null,
        cancelRequestedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        attempt: 0,
        failureCode: null,
        failureMessage: null,
        requestedByUserId: null,
        requestedByClientId: null,
        userMessage: null,
      };
    })();

  return bindingMatchesActive({
    binding,
    versionId: version.id,
    ndId: nd.id,
    fingerprint: nd.fingerprint,
    bundleId: bundle.id,
  });
}

export async function getDoclingKnowledgePipelineStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  DoclingKnowledgePipelineStatusDto | { error: "PROFILE_REQUIRED" | "NOT_FOUND" }
> {
  const owned = await loadOwnedPack(input);
  if ("error" in owned && owned.error) {
    return { error: owned.error };
  }
  if (!("pack" in owned) || !owned.pack) {
    return { error: "NOT_FOUND" };
  }
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
      primaryCta: "none",
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

  const binding = parseKnowledgeRunBinding(latest?.summary);
  const ndFingerprint = nd?.fingerprint ?? null;
  const stale = Boolean(
    latest &&
      providerConfirmed &&
      nd &&
      bundle &&
      (!binding ||
        !bindingMatchesActive({
          binding,
          versionId: version.id,
          ndId: nd.id,
          fingerprint: ndFingerprint,
          bundleId: bundle.id,
        })),
  );

  const passed = await isDoclingKnowledgePipelinePassed(input.packId);
  const running = latest?.status === "RUNNING" || latest?.status === "PENDING";
  const failed =
    latest?.status === "FAIL" ||
    latest?.status === "SKIPPED" ||
    owned.pack.pipelineStatus === "FAILED";
  const evalStep = latest?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  const warningOnly =
    !passed &&
    latest?.status === "PASS" &&
    evalStep?.status === "WARNING" &&
    !stale;

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

  let primaryCta: DoclingKnowledgePipelineStatusDto["primaryCta"] = "none";
  if (running) primaryCta = "none";
  else if (passed) primaryCta = "distribution";
  else if (warningOnly) primaryCta = "warning_retry";
  else if (failed || stale) primaryCta = "retry";
  else if (providerConfirmed && owned.pack.status === PackStatus.DRAFT) primaryCta = "start";

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
    canStart:
      providerConfirmed &&
      owned.pack.status === PackStatus.DRAFT &&
      !running &&
      primaryCta === "start",
    canRetry:
      providerConfirmed &&
      owned.pack.status === PackStatus.DRAFT &&
      !running &&
      (primaryCta === "retry" || primaryCta === "warning_retry"),
    canOpenDistribution: passed && owned.pack.status === PackStatus.DRAFT,
    primaryCta,
    lockReason,
    summary: humanSummaryFromBinding(binding, "") || null,
  };
}

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
) {
  const active = await assertRunStillActive(runId);
  if (!active && status === "RUNNING") return { cancelled: true as const };
  if (!active && (status === "PASS" || status === "WARNING" || status === "FAIL")) {
    // Allow terminal write only if run still RUNNING was checked — if cancelled mid-flight, skip overwrite.
    const run = await prisma.pipelineRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    if (run?.status !== "RUNNING") return { cancelled: true as const };
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
}): Promise<void> {
  let binding = input.binding;
  const versionId = binding.versionId;
  const indexGenerationId = binding.indexGenerationId;

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
    binding = await touchKnowledgeRunHeartbeat({
      runId: input.runId,
      binding,
      userMessage,
    });
    if (binding.cancelRequestedAt) return false;
    const still = await assertRunStillActive(input.runId);
    return Boolean(still);
  };

  if (!(await heartbeat("문서 구조 확인 준비"))) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  const nd = await prisma.normalizedDocument.findFirst({
    where: {
      id: binding.normalizedDocumentId,
      isActive: true,
      fingerprint: binding.fingerprint,
    },
  });
  if (!nd) {
    await markStep(
      input.packId,
      input.runId,
      "STRUCTURE_VALIDATING",
      "FAIL",
      "활성 NormalizedDocument가 없거나 fingerprint가 일치하지 않습니다.",
      { code: "NORMALIZED_DOCUMENT_MISMATCH" },
    );
    await failRun(
      input.packId,
      input.runId,
      "NormalizedDocument missing or fingerprint mismatch",
      binding,
      "FINGERPRINT_MISMATCH",
    );
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "STRUCTURE_VALIDATING",
    "RUNNING",
    "문서 구조를 확인하는 중…",
  );
  const sections = (Array.isArray(nd.sectionsJson) ? nd.sectionsJson : []) as unknown as NormalizedSection[];
  const tables = (Array.isArray(nd.tablesJson) ? nd.tablesJson : []) as unknown as NormalizedTable[];
  const figures = (Array.isArray(nd.figuresJson) ? nd.figuresJson : []) as unknown as NormalizedFigure[];
  const readingOrder = Array.isArray(nd.readingOrderJson)
    ? (nd.readingOrderJson as unknown as Array<{ index: number; ref: string; kind: string | null }>)
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
    await failRun(input.packId, input.runId, "Structure validation failed", binding);
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

  if (!(await heartbeat("지식 단위 생성 중"))) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "KNOWLEDGE_CHECKING",
    "RUNNING",
    "지식 단위를 생성하는 중…",
  );

  const sourceDocumentId = await ensureDoclingOriginSourceDocument({
    versionId,
    packId: input.packId,
    title: nd.title,
    fingerprint: nd.fingerprint,
  });

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
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(input.packId, input.runId, message.slice(0, 500), binding, "KNOWLEDGE_GENERATION_FAILED");
    return;
  }

  if (built.unitCount === 0) {
    await markStep(
      input.packId,
      input.runId,
      "KNOWLEDGE_CHECKING",
      "FAIL",
      "지식 단위를 생성하지 못했습니다. 정규화 결과의 본문·표·그림 샘플을 확인한 뒤 다시 처리해 주세요.",
      { ...built },
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(input.packId, input.runId, "Knowledge unit generation failed", binding);
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "KNOWLEDGE_CHECKING",
    built.warnings.length > 0 || built.coverage.bodyCoverage < 0.99 ? "WARNING" : "PASS",
    `지식 단위 ${built.unitCount}개를 생성했습니다.`,
    {
      unitCount: built.unitCount,
      byType: built.byType,
      excludedCount: built.excludedCount,
      warnings: built.warnings,
      coverage: built.coverage,
      sampleUnits: built.sampleUnits,
    },
  );

  if (!(await heartbeat("검색 데이터 생성 중"))) {
    await cancelledExit("취소되어 중단되었습니다.");
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    return;
  }

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
      { chunkCount: 0, code: "CHUNK_GENERATION_FAILED" },
    );
    await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    await failRun(input.packId, input.runId, "Chunk generation failed", binding, "CHUNK_GENERATION_FAILED");
    return;
  }

  // Activate draft generation only after units+chunks validated (before embedding).
  const activated = await activateDraftIndexGeneration({
    versionId,
    indexGenerationId,
  });

  const activeChunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId,
      isActive: true,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
    },
    select: { content: true, metadata: true },
  });
  const lengths = activeChunks
    .filter((c) => asRecord(c.metadata)?.indexGenerationId === indexGenerationId)
    .map((c) => c.content.length);
  const avg =
    lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : 0;
  await markStep(
    input.packId,
    input.runId,
    "CHUNKING",
    built.coverage.provenanceMissing > 0 ? "WARNING" : "PASS",
    `검색 Chunk ${built.chunkCount}개를 생성했습니다.`,
    {
      chunkCount: built.chunkCount,
      averageLength: avg,
      minLength: lengths.length ? Math.min(...lengths) : 0,
      maxLength: lengths.length ? Math.max(...lengths) : 0,
      shortCount: lengths.filter((n) => n < 80).length,
      longCount: lengths.filter((n) => n > 3500).length,
      mergedCount: built.mergedCount,
      activatedChunkCount: activated.activatedChunkCount,
      sampleChunks: built.sampleChunks,
      coverage: built.coverage,
    },
  );

  if (!(await heartbeat("검색 인덱스 생성 중"))) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "INDEXING",
    "RUNNING",
    "검색 인덱스를 생성하는 중…",
  );
  const embeddings = await rebuildPackEmbeddings({
    packId: input.packId,
    versionId,
    force: true,
    chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
    indexGenerationId,
    pipelineRunId: input.runId,
    fingerprint: nd.fingerprint ?? undefined,
  });
  if (!embeddings) {
    await markStep(
      input.packId,
      input.runId,
      "INDEXING",
      "FAIL",
      "검색 인덱스(Embedding) 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      { code: "INDEX_BUILD_FAILED" },
    );
    await failRun(input.packId, input.runId, "Index build failed", binding, "INDEX_BUILD_FAILED");
    return;
  }
  await markStep(
    input.packId,
    input.runId,
    "INDEXING",
    "PASS",
    `Draft 검색 Index를 생성했습니다. (처리 ${embeddings.processedCount}건)`,
    {
      draft: true,
      indexGenerationId,
      indexScope: "DRAFT",
      embeddingProvider: "local",
      ...embeddings,
    },
  );

  if (!(await heartbeat("검색 결과 검증 중"))) {
    await cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "SEARCH_EVALUATING",
    "RUNNING",
    "검색 결과를 검증하는 중…",
  );
  const evaluation = await runDoclingRetrievalEvaluation({
    packId: input.packId,
    versionId,
    indexGenerationId,
  });
  if (evaluation.status === "FAIL") {
    await markStep(
      input.packId,
      input.runId,
      "SEARCH_EVALUATING",
      "FAIL",
      "검색 결과가 기준을 충족하지 못했습니다. 미통과 질문을 확인한 후 검색 데이터를 다시 생성해 주세요.",
      evaluation as unknown as Record<string, unknown>,
    );
    await failRun(
      input.packId,
      input.runId,
      "Retrieval evaluation below threshold",
      binding,
      "RETRIEVAL_EVALUATION_FAILED",
    );
    return;
  }
  if (evaluation.status === "WARNING") {
    await markStep(
      input.packId,
      input.runId,
      "SEARCH_EVALUATING",
      "WARNING",
      "검색 검증에 보완이 필요합니다. 유통정보로 진행하려면 재검증 후 PASS가 필요합니다.",
      evaluation as unknown as Record<string, unknown>,
    );
    // WARNING does not open distribution (policy constant).
    await finishPipelineRun({
      runId: input.runId,
      status: "WARNING",
      summary: serializeKnowledgeRunBinding({
        ...binding,
        userMessage: `검색 검증 보완 필요 (units=${built.unitCount}, chunks=${built.chunkCount})`,
        lockOwner: null,
        lockExpiresAt: null,
      }),
    });
    await updatePackPipelineStatus({
      packId: input.packId,
      pipelineStatus: "FAILED",
      message: "Docling knowledge pipeline warning — needs re-eval",
    });
    return;
  }

  await markStep(
    input.packId,
    input.runId,
    "SEARCH_EVALUATING",
    "PASS",
    "검색 결과 검증을 통과했습니다.",
    evaluation as unknown as Record<string, unknown>,
  );

  await markStep(
    input.packId,
    input.runId,
    "READY_FOR_REVIEW",
    "PASS",
    "지식 데이터 생성 완료",
    {
      fingerprint: nd.fingerprint,
      versionId,
      normalizedDocumentId: nd.id,
      bundleId: binding.bundleId,
      indexGenerationId,
    },
  );
  await finishPipelineRun({
    runId: input.runId,
    status: "PASS",
    summary: serializeKnowledgeRunBinding({
      ...binding,
      userMessage: `지식 데이터 생성 완료 (units=${built.unitCount}, chunks=${built.chunkCount})`,
      lockOwner: null,
      lockExpiresAt: null,
    }),
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

/** @deprecated Prefer worker claim — kept for tests that call execute directly. */
export async function executeDoclingKnowledgePipelineByIds(input: {
  runId: string;
  packId: string;
  versionId: string;
  normalizedDocumentId: string;
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
  await executeDoclingKnowledgePipeline({
    runId: input.runId,
    packId: input.packId,
    binding,
  });
}
