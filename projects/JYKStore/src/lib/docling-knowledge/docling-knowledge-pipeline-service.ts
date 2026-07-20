/**
 * Docling knowledge pipeline public facade.
 * Status/pass gates live in *-status*; execute orchestration in *-execute*.
 */
import { AuditAction, PackStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  createKnowledgeRunBinding,
  parseKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  DOCLING_KNOWLEDGE_PIPELINE_STEPS,
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  loadActiveDoclingContext,
  loadOwnedPackForKnowledgePipeline,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-shared";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export {
  resolveDoclingKnowledgeStageNextAction,
  type DoclingKnowledgeStageView,
  type DoclingKnowledgePipelineStatusDto,
  isDoclingStructurePassed,
  isDoclingSearchFoundationPassed,
  isDoclingKnowledgePipelinePassed,
  getDoclingKnowledgePipelineStatus,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-status";

export { executeDoclingKnowledgePipeline } from "@/lib/docling-knowledge/docling-knowledge-pipeline-execute";

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
  const owned = await loadOwnedPackForKnowledgePipeline(input);
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
  const { executeDoclingKnowledgePipeline } = await import(
    "@/lib/docling-knowledge/docling-knowledge-pipeline-execute"
  );
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
