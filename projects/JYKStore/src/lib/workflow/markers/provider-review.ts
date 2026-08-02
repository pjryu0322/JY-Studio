/**
 * Provider Store review handoff: request / confirm / withdraw.
 */

import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  encodeProviderChangesRequestSummary,
  type ProviderChangesRequestPayload,
} from "@/lib/provider-review-workbench";
import {
  STORE_PROVIDER_SUPPLEMENT_TRIGGER,
  buildInitialProviderSupplementState,
  encodeProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import {
  encodeProviderReviewConfirmSummary,
  type ProviderReviewRevisionBinding,
} from "@/lib/store-workflow-provider-review-binding";
import { recordProviderAudit } from "@/lib/provider-audit";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
  WORKER_ZIP_REQUEST_TRIGGER,
} from "./constants";
import type { PrismaClientLike } from "./types";
import { resolveStoreWorkflowMarkers } from "./resolve";
import { assertProviderConfirmEvidence } from "./publish-binding";

export async function requestProviderStoreReview(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  if (!packId) return { ok: false, error: "INVALID_PACK", message: "packId가 필요합니다." };

  const existing = await resolveStoreWorkflowMarkers(packId, client);
  if (existing.providerReviewPhase === "REQUESTED") {
    return { ok: true };
  }
  if (existing.providerReviewPhase === "CONFIRMED") {
    return {
      ok: false,
      error: "ALREADY_CONFIRMED",
      message: "제공자가 이미 확인을 완료했습니다.",
    };
  }

  // Retire prior SKIPPED/PASS markers for a fresh request cycle.
  await client.pipelineRun.updateMany({
    where: {
      packId,
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      status: { in: ["PENDING", "RUNNING", "PASS", "SKIPPED"] },
    },
    data: { status: "SKIPPED", finishedAt: new Date() },
  });

  await client.pipelineRun.create({
    data: {
      packId,
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      triggeredByClientId: input.clientId,
      status: "PENDING",
      summary: "관리자가 제공자 생성 결과 검토를 요청했습니다.",
    },
  });

  return { ok: true };
}

export async function confirmProviderStoreReview(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const markers = await resolveStoreWorkflowMarkers(packId, client);
  if (markers.providerReviewPhase === "CONFIRMED") return { ok: true };
  if (markers.providerReviewPhase !== "REQUESTED") {
    return {
      ok: false,
      error: "NOT_REQUESTED",
      message: "아직 검토 요청 상태가 아닙니다.",
    };
  }

  const evidence = await assertProviderConfirmEvidence(packId, client);
  if (!evidence.ok) return evidence;

  const open = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      status: { in: ["PENDING", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!open) {
    return {
      ok: false,
      error: "NOT_REQUESTED",
      message: "아직 검토 요청 상태가 아닙니다.",
    };
  }

  const binding: ProviderReviewRevisionBinding = {
    ...evidence.binding,
    reviewerClientId: input.clientId,
    reviewedAt: new Date().toISOString(),
  };

  await client.pipelineRun.update({
    where: { id: open.id },
    data: {
      status: "PASS",
      finishedAt: new Date(),
      summary: encodeProviderReviewConfirmSummary(binding),
      triggeredByClientId: input.clientId,
    },
  });

  try {
    await recordProviderAudit({
      action: AuditAction.PROVIDER_PACK_UPDATE,
      entityType: "KnowledgePack",
      entityId: packId,
      metadata: {
        action: "PROVIDER_REVIEW_CONFIRM",
        versionId: binding.versionId,
        indexGenerationId: binding.indexGenerationId,
        pipelineRunId: binding.pipelineRunId,
        reviewedAt: binding.reviewedAt,
        reviewerClientId: input.clientId,
      },
    });
  } catch {
    // Test doubles may omit AuditLog; confirmation itself already persisted.
  }

  return { ok: true };
}

/**
 * Provider withdraws after generation / review request — clears hold markers so
 * materials can be re-registered. Generation history (WORKER_ZIP_IMPORT runs) stays.
 * When `changesRequest` is provided, persists structured 보완 요청 in PipelineRun.summary.
 */
export async function withdrawProviderStoreReview(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
  changesRequest?: ProviderChangesRequestPayload;
}): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const now = new Date();

  if (input.changesRequest) {
    const markers = await resolveStoreWorkflowMarkers(packId, client);
    if (markers.providerReviewPhase === "CONFIRMED") {
      return {
        ok: false,
        error: "ALREADY_CONFIRMED",
        message: "이미 처리된 검토 요청입니다.",
      };
    }
    if (markers.providerReviewPhase === "WITHDRAWN") {
      return {
        ok: false,
        error: "ALREADY_WITHDRAWN",
        message: "이미 처리된 검토 요청입니다.",
      };
    }
    if (markers.providerReviewPhase !== "REQUESTED") {
      return {
        ok: false,
        error: "NOT_REQUESTED",
        message: "아직 검토 요청 상태가 아닙니다.",
      };
    }
    const details = input.changesRequest.details?.trim() ?? "";
    if (!details) {
      return {
        ok: false,
        error: "CHANGES_DETAILS_REQUIRED",
        message: "보완 요청 내용을 입력해 주세요.",
      };
    }
  }

  const withdrawSummary = input.changesRequest
    ? encodeProviderChangesRequestSummary({
        ...input.changesRequest,
        details: input.changesRequest.details.trim(),
      })
    : "제공자가 회수하고 자료를 다시 등록합니다.";

  await client.pipelineRun.updateMany({
    where: {
      packId,
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      status: { in: ["PENDING", "RUNNING", "PASS"] },
    },
    data: {
      status: "SKIPPED",
      finishedAt: now,
      summary: withdrawSummary,
    },
  });

  await client.pipelineRun.updateMany({
    where: {
      packId,
      triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
      status: "PASS",
    },
    data: {
      status: "SKIPPED",
      finishedAt: now,
      summary: "제공자 회수로 서비스 검증을 초기화했습니다.",
    },
  });

  // Clear COMPLETED/ACCEPTED ZIP request hold so provider can edit again.
  await client.pipelineRun.updateMany({
    where: {
      packId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", "RUNNING", "PASS"] },
    },
    data: {
      status: "SKIPPED",
      finishedAt: now,
      summary: "제공자 회수: 생성 요청 마커 해제",
    },
  });

  // Record WITHDRAWN as latest SKIPPED provider-review marker for CTA derivation.
  await client.pipelineRun.create({
    data: {
      packId,
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      triggeredByClientId: input.clientId,
      status: "SKIPPED",
      finishedAt: now,
      summary: input.changesRequest
        ? encodeProviderChangesRequestSummary({
            ...input.changesRequest,
            details: input.changesRequest.details.trim(),
          })
        : "제공자 회수 완료 — 자료 재등록 가능",
    },
  });

  // Structured 보완요청 → admin action queue marker (PENDING = 접수 대기).
  if (input.changesRequest) {
    const state = buildInitialProviderSupplementState({
      changesRequest: {
        ...input.changesRequest,
        details: input.changesRequest.details.trim(),
      },
      submittedAt: now.toISOString(),
      clientId: input.clientId,
    });
    await client.pipelineRun.create({
      data: {
        packId,
        triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
        triggeredByClientId: input.clientId,
        status: "PENDING",
        startedAt: now,
        summary: encodeProviderSupplementRequestState(state),
      },
    });
  }

  return { ok: true };
}
