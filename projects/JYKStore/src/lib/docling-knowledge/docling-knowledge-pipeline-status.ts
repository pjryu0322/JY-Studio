/**
 * Docling knowledge pipeline status reads and pass gates.
 * Execute/start orchestration stays in docling-knowledge-pipeline-service.
 */
import { PackStatus } from "@prisma/client";
import { humanSummaryFromBinding, parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  isFullKnowledgePipelineStagesPassed,
  isSearchFoundationStagesPassed,
  isStructureStagesPassed,
} from "@/lib/docling-knowledge/docling-knowledge-stage-pass";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
  DOCLING_KNOWLEDGE_STAGES,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  asPipelineRecord,
  bindingMatchesActive,
  loadActiveDoclingContext,
  loadLatestKnowledgePipelineContext,
  loadOwnedPackForKnowledgePipeline,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-shared";
import {
  resolveDoclingKnowledgeActionFlags,
  resolveDoclingKnowledgeLockReason,
  resolveDoclingKnowledgePrimaryCta,
  resolveDoclingKnowledgeStageNextAction,
  type DoclingKnowledgePipelineStatusDto,
  type DoclingKnowledgeStageView,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-status-policy";
import { prisma } from "@/lib/prisma";

export type {
  DoclingKnowledgePipelineStatusDto,
  DoclingKnowledgeStageView,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-status-policy";

export { resolveDoclingKnowledgeStageNextAction } from "@/lib/docling-knowledge/docling-knowledge-pipeline-status-policy";

/** STRUCTURE + KU + Chunk on current Pack·Version·Bundle·ND binding. */
export async function isDoclingStructurePassed(packId: string): Promise<boolean> {
  const ctx = await loadLatestKnowledgePipelineContext(packId);
  if (!ctx) return false;
  return isStructureStagesPassed({
    steps: ctx.steps,
    pipelineCurrent: ctx.pipelineCurrent,
  });
}

/** SEARCH_INDEX + RETRIEVAL_EVALUATION on current binding (implies structure). */
export async function isDoclingSearchFoundationPassed(packId: string): Promise<boolean> {
  const ctx = await loadLatestKnowledgePipelineContext(packId);
  if (!ctx) return false;
  return isSearchFoundationStagesPassed({
    steps: ctx.steps,
    pipelineCurrent: ctx.pipelineCurrent,
  });
}

/**
 * Server gate: fingerprint/version/ND-bound PASS only.
 * Pack pipelineStatus alone is never sufficient.
 * Equals search-foundation + READY_FOR_REVIEW on a PASS run (historical `passed`).
 */
export async function isDoclingKnowledgePipelinePassed(packId: string): Promise<boolean> {
  const ctx = await loadLatestKnowledgePipelineContext(packId);
  if (!ctx || ctx.runStatus !== "PASS") return false;
  return isFullKnowledgePipelineStagesPassed({
    steps: ctx.steps,
    pipelineCurrent: ctx.pipelineCurrent,
  });
}

export async function getDoclingKnowledgePipelineStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<
  DoclingKnowledgePipelineStatusDto | { error: "PROFILE_REQUIRED" | "NOT_FOUND" }
> {
  const owned = await loadOwnedPackForKnowledgePipeline(input);
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
      structurePassed: false,
      searchFoundationPassed: false,
      pipelineCurrent: false,
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
  const pipelineCurrent = Boolean(providerConfirmed && nd && bundle && !stale);
  const stepLikes =
    latest?.steps.map((s) => ({
      step: s.step,
      status: s.status,
      details: asPipelineRecord(s.details),
    })) ?? [];
  const structurePassed = isStructureStagesPassed({
    steps: stepLikes,
    pipelineCurrent,
  });
  const searchFoundationPassed = isSearchFoundationStagesPassed({
    steps: stepLikes,
    pipelineCurrent,
  });
  const running = latest?.status === "RUNNING" || latest?.status === "PENDING";
  const failed =
    latest?.status === "FAIL" ||
    latest?.status === "SKIPPED" ||
    owned.pack.pipelineStatus === "FAILED";
  const evalStep = latest?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  const warningOnly =
    !passed &&
    !stale &&
    !running &&
    (latest?.status === "WARNING" || evalStep?.status === "WARNING");

  const packIsDraft = owned.pack.status === PackStatus.DRAFT;
  const stages: DoclingKnowledgeStageView[] = DOCLING_KNOWLEDGE_STAGES.map((s, index) => {
    const step = latest?.steps.find((x) => x.step === s.pipelineStep);
    const status = stale ? "STALE" : (step?.status ?? "PENDING");
    const priorFailed =
      !stale &&
      DOCLING_KNOWLEDGE_STAGES.slice(0, index).some((prior) => {
        const priorStep = latest?.steps.find((x) => x.step === prior.pipelineStep);
        return priorStep?.status === "FAIL";
      });
    const details = asPipelineRecord(step?.details);
    const failureCode =
      (typeof details?.code === "string" ? details.code : null) ??
      (Array.isArray(details?.blockers) &&
      details.blockers[0] &&
      typeof (details.blockers[0] as { code?: unknown }).code === "string"
        ? String((details.blockers[0] as { code: string }).code)
        : null);
    const nextAction = resolveDoclingKnowledgeStageNextAction({
      stageId: s.id,
      status,
      providerConfirmed,
      running,
      priorFailed,
      failureCode,
    });
    return {
      id: s.id,
      label: s.label,
      description: s.description,
      pipelineStep: s.pipelineStep,
      status,
      message: step?.message ?? null,
      startedAt: step?.startedAt?.toISOString() ?? null,
      finishedAt: step?.finishedAt?.toISOString() ?? null,
      details,
      nextAction,
    };
  });

  const primaryCta = resolveDoclingKnowledgePrimaryCta({
    running,
    passed,
    structurePassed,
    searchFoundationPassed,
    stale,
    failed,
    warningOnly,
    providerConfirmed,
    packIsDraft,
  });
  const actionFlags = resolveDoclingKnowledgeActionFlags({
    providerConfirmed,
    packIsDraft,
    running,
    passed,
    primaryCta,
  });

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
    structurePassed,
    searchFoundationPassed,
    pipelineCurrent,
    stages,
    ...actionFlags,
    primaryCta,
    lockReason: resolveDoclingKnowledgeLockReason({
      providerConfirmed,
      structurePassed,
      searchFoundationPassed,
    }),
    summary: humanSummaryFromBinding(binding, "") || null,
  };
}
