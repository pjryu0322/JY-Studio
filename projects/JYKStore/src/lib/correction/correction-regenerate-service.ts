/**
 * Correction regenerate → overlay re-apply → Auto Quality → mark REGENERATED.
 */
import { AuditAction } from "@prisma/client";
import {
  appendCorrectionAuditEvent,
  recordCorrectionProviderAudit,
} from "@/lib/correction/correction-audit";
import { reapplyCorrectionOverlays } from "@/lib/correction/correction-apply-service";
import { toCorrectionCaseDto } from "@/lib/correction/correction-mapper";
import {
  CorrectionServiceError,
  type CorrectionCaseDto,
} from "@/lib/correction/correction-types";
import { prisma } from "@/lib/prisma";
import { runAdminWorkerZipGeneration } from "@/lib/python-worker/worker-zip-import-provider-service";
import { refreshWorkerZipReviewReadiness } from "@/lib/python-worker/worker-zip-quality-refresh-service";
import { buildAdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import {
  generationOutcomeRequiresCorrection,
  resolveGenerationOutcome,
} from "@/lib/workflow/generation-outcome";

export type CorrectionRegenerateResult = {
  cases: CorrectionCaseDto[];
  regeneratedCount: number;
  overlaysReapplied: number;
  generation: {
    ok: boolean;
    pipelineRunId: string | null;
    importedChunkCount: number | null;
  };
  quality: {
    ok: boolean;
    outcome: string | null;
    correctionStillRequired: boolean;
  };
};

export async function regenerateAfterCorrection(input: {
  packId: string;
  actorUserId: string;
  clientId: string;
  caseIds?: string[];
  skipFullGeneration?: boolean;
  prismaClient?: typeof prisma;
}): Promise<CorrectionRegenerateResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  if (!packId) {
    throw new CorrectionServiceError("PACK_ID_REQUIRED", "packId가 필요합니다.", 400);
  }

  const where = {
    packId,
    status: "APPLIED" as const,
    ...(input.caseIds?.length ? { id: { in: input.caseIds } } : {}),
  };
  const applied = await client.correctionCase.findMany({ where });
  if (applied.length === 0) {
    throw new CorrectionServiceError(
      "NO_APPLIED_CASES",
      "재생성할 APPLIED 보정 케이스가 없습니다.",
      409,
    );
  }

  const needsFullGeneration = applied.some((row) => row.targetType === "FILE");
  const runFull = !input.skipFullGeneration && needsFullGeneration;

  let generationOk = true;
  let pipelineRunId: string | null = null;
  let importedChunkCount: number | null = null;

  if (runFull) {
    const gen = await runAdminWorkerZipGeneration({
      adminUserId: input.actorUserId,
      clientId: input.clientId,
      packId,
      prismaClient: client,
    });
    generationOk = gen.ok;
    pipelineRunId = gen.pipelineRunId ?? null;
    importedChunkCount = gen.importedChunkCount ?? null;
    if (!gen.ok) {
      throw new CorrectionServiceError(
        gen.error?.code ?? "GENERATION_FAILED",
        gen.error?.message ?? "재생성에 실패했습니다.",
        500,
      );
    }
  }

  const versionId = applied[0]!.versionId;
  const overlays = await reapplyCorrectionOverlays({
    packId,
    versionId,
    prismaClient: client,
  });

  const quality = await refreshWorkerZipReviewReadiness({
    packId,
    reviewerClientId: input.clientId,
    prismaClient: client,
  });
  if (!quality.ok) {
    throw new CorrectionServiceError(
      quality.error ?? "QUALITY_REFRESH_FAILED",
      quality.message ?? "Auto Quality 재실행에 실패했습니다.",
      500,
    );
  }

  const gate = buildAdminQualityGateSnapshot(quality.refresh.detail);
  const outcome = resolveGenerationOutcome({
    workerZipPhase: "COMPLETED",
    qualityCompleted: gate.completed,
    hasBlockers: gate.hasBlockers,
    failCount: gate.failCount,
    hasWarnings: gate.hasWarnings,
  });

  const now = new Date();
  const updatedCases: CorrectionCaseDto[] = [];
  for (const row of applied) {
    const updated = await client.correctionCase.update({
      where: { id: row.id },
      data: {
        status: "REGENERATED",
        regeneratedAt: now,
        generationRunId: pipelineRunId,
      },
    });
    await appendCorrectionAuditEvent({
      caseId: row.id,
      actorUserId: input.actorUserId,
      action: "REGENERATE",
      fromStatus: "APPLIED",
      toStatus: "REGENERATED",
      detail: {
        fullGeneration: runFull,
        pipelineRunId,
        overlaysReapplied: overlays.reapplied,
        outcome,
      },
      client,
    });
    await recordCorrectionProviderAudit({
      action: AuditAction.ADMIN_CORRECTION_REGENERATE,
      caseId: row.id,
      packId,
      actorUserId: input.actorUserId,
      metadata: { fullGeneration: runFull, outcome },
      client,
    });
    updatedCases.push(toCorrectionCaseDto(updated));
  }

  return {
    cases: updatedCases,
    regeneratedCount: updatedCases.length,
    overlaysReapplied: overlays.reapplied,
    generation: {
      ok: generationOk,
      pipelineRunId,
      importedChunkCount,
    },
    quality: {
      ok: true,
      outcome,
      correctionStillRequired: generationOutcomeRequiresCorrection(outcome),
    },
  };
}
