/**
 * Persist Store workflow handoffs via PipelineRun markers (no schema migration).
 *
 * STORE_PROVIDER_REVIEW:
 *   PENDING  → admin requested provider confirm (PROVIDER_REVIEW_REQUESTED)
 *   PASS     → provider confirmed (PROVIDER_REVIEW_CONFIRMED)
 *   SKIPPED  → withdrawn / superseded
 *
 * STORE_SERVICE_VALIDATION:
 *   PASS     → admin marked service validation complete
 *   SKIPPED  → superseded after provider withdraw
 */

import { AuditAction, PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/artifact-state/latest-pack-artifact-query";
import { buildAdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import type {
  StoreProviderReviewPhase,
  StoreServiceValidationPhase,
} from "@/lib/store-workflow-status";
import { resolveStoreServiceChannelGates } from "@/lib/store-workflow-handoff-gates";
import {
  encodeProviderChangesRequestSummary,
  parseProviderChangesRequestSummary,
  type ProviderChangesRequestPayload,
} from "@/lib/provider-review-workbench";
import {
  STORE_PROVIDER_SUPPLEMENT_TRIGGER,
  buildAdminSupplementQueueDisplay,
  buildInitialProviderSupplementState,
  changeTypeLabel,
  encodeProviderSupplementRequestState,
  isOpenProviderSupplementPhase,
  mapAdminPhaseToPipelineStatus,
  mapSupplementStatusToAdminPhase,
  OPEN_SUPPLEMENT_PIPELINE_STATUSES,
  parseProviderSupplementRequestState,
  type ProviderSupplementAdminPhase,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import {
  encodeProviderReviewConfirmSummary,
  parseProviderReviewRevisionBinding,
  type ProviderReviewRevisionBinding,
} from "@/lib/store-workflow-provider-review-binding";
import { recordProviderAudit } from "@/lib/provider-audit";

/** Same trigger string as worker-zip-import-provider-service (avoid circular import). */
const WORKER_ZIP_REQUEST_TRIGGER = "WORKER_ZIP_REQUEST";
const WORKER_ZIP_IMPORT_TRIGGER = "WORKER_ZIP_IMPORT";

export const STORE_PROVIDER_REVIEW_TRIGGER = "STORE_PROVIDER_REVIEW";
export const STORE_SERVICE_VALIDATION_TRIGGER = "STORE_SERVICE_VALIDATION";

type PrismaClientLike = typeof prisma;

export type StoreWorkflowMarkerSnapshot = {
  providerReviewPhase: StoreProviderReviewPhase;
  serviceValidationPhase: StoreServiceValidationPhase;
  providerReviewRequestedAt: string | null;
  providerReviewConfirmedAt: string | null;
  serviceValidationPassedAt: string | null;
  /** Raw PipelineRun.summary for the latest provider-review marker. */
  providerReviewSummary: string | null;
  /** Parsed 보완요청 payload when the latest marker encodes one. */
  providerChangesRequest: ProviderChangesRequestPayload | null;
  /** Latest STORE_PROVIDER_SUPPLEMENT admin-processing phase. */
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  providerSupplement: ProviderSupplementRequestState | null;
  providerSupplementSubmittedAt: string | null;
};

function emptyMarkerSnapshot(): StoreWorkflowMarkerSnapshot {
  return {
    providerReviewPhase: "NONE",
    serviceValidationPhase: "NONE",
    providerReviewRequestedAt: null,
    providerReviewConfirmedAt: null,
    serviceValidationPassedAt: null,
    providerReviewSummary: null,
    providerChangesRequest: null,
    providerSupplementPhase: "NONE",
    providerSupplement: null,
    providerSupplementSubmittedAt: null,
  };
}

function mapProviderReviewStatus(status: string | undefined | null): StoreProviderReviewPhase {
  if (status === "PENDING" || status === "RUNNING") return "REQUESTED";
  if (status === "PASS") return "CONFIRMED";
  if (status === "SKIPPED") return "WITHDRAWN";
  return "NONE";
}

async function loadLatestSupplementMarker(
  packId: string,
  client: PrismaClientLike,
): Promise<{
  status: string;
  summary: string | null;
  createdAt: Date;
  finishedAt: Date | null;
} | null> {
  return client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: { in: [...OPEN_SUPPLEMENT_PIPELINE_STATUSES, "SKIPPED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, summary: true, createdAt: true, finishedAt: true },
  });
}

function applySupplementToSnapshot(
  base: StoreWorkflowMarkerSnapshot,
  supplementRun: {
    status: string;
    summary: string | null;
    createdAt: Date;
    finishedAt: Date | null;
  } | null,
): StoreWorkflowMarkerSnapshot {
  if (!supplementRun) return base;
  const state = parseProviderSupplementRequestState(supplementRun.summary);
  const phase =
    state?.adminPhase ?? mapSupplementStatusToAdminPhase(supplementRun.status);
  return {
    ...base,
    providerSupplementPhase: phase === "NONE" ? "NONE" : phase,
    providerSupplement: state,
    providerSupplementSubmittedAt:
      state?.submittedAt ?? supplementRun.createdAt.toISOString(),
    providerChangesRequest: state
      ? {
          changeType: state.changeType,
          targetKind: state.targetKind,
          targetLabel: state.targetLabel ?? undefined,
          details: state.details,
        }
      : base.providerChangesRequest,
  };
}

async function assertProviderConfirmEvidence(
  packId: string,
  client: PrismaClientLike,
): Promise<
  | { ok: true; binding: ProviderReviewRevisionBinding }
  | { ok: false; error: string; message: string }
> {
  const latestZip = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: WORKER_ZIP_IMPORT_TRIGGER,
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, status: true },
  });
  if (!latestZip || latestZip.status !== "PASS") {
    return {
      ok: false,
      error: "GENERATION_OR_QUALITY_NOT_READY",
      message: "생성 결과 또는 품질점검 결과가 준비되지 않았습니다.",
    };
  }

  const generation = await client.searchIndexGeneration.findFirst({
    where: {
      packId,
      pipelineRunId: latestZip.id,
      status: "READY",
      staleAt: null,
      retiredAt: null,
    },
    select: { id: true, versionId: true },
  });
  if (!generation) {
    return {
      ok: false,
      error: "GENERATION_OR_QUALITY_NOT_READY",
      message: "생성 결과 또는 품질점검 결과가 준비되지 않았습니다.",
    };
  }

  const [structure, chunk, knowledge] = await Promise.all([
    client.structureCoverageReport.findFirst({
      where: { packId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
    client.chunkQualityReport.findFirst({
      where: { packId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
    client.knowledgeQualityReport.findFirst({
      where: { packId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
  ]);
  const reports = [structure, chunk, knowledge].filter(Boolean);
  if (reports.length === 0 || reports.some((r) => r!.status === "FAIL")) {
    return {
      ok: false,
      error: "GENERATION_OR_QUALITY_NOT_READY",
      message: "생성 결과 또는 품질점검 결과가 준비되지 않았습니다.",
    };
  }

  return {
    ok: true,
    binding: {
      v: 1,
      indexGenerationId: generation.id,
      versionId: generation.versionId,
      pipelineRunId: latestZip.id,
      reviewedAt: new Date().toISOString(),
    },
  };
}

/** Current READY draft generation for a pack/version — used by publish gate. */
export async function resolveCurrentPublishTargetGeneration(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<{ id: string; versionId: string; pipelineRunId: string | null } | null> {
  const latestZip = await client.pipelineRun.findFirst({
    where: { packId, triggerType: WORKER_ZIP_IMPORT_TRIGGER, status: "PASS" },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true },
  });
  if (!latestZip) return null;
  const generation = await client.searchIndexGeneration.findFirst({
    where: {
      packId,
      pipelineRunId: latestZip.id,
      status: "READY",
      scope: "DRAFT",
      staleAt: null,
      retiredAt: null,
    },
    select: { id: true, versionId: true, pipelineRunId: true },
  });
  if (!generation) return null;
  return {
    id: generation.id,
    versionId: generation.versionId,
    pipelineRunId: generation.pipelineRunId,
  };
}

/**
 * Provider confirm is only valid for the current READY draft generation.
 * Missing/legacy binding or generation mismatch → stale (cannot publish).
 */
export async function assertProviderReviewBindingCurrent(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<
  | { ok: true; binding: ProviderReviewRevisionBinding }
  | { ok: false; error: string; message: string; code: string }
> {
  const markers = await resolveStoreWorkflowMarkers(packId, client);
  if (markers.providerReviewPhase !== "CONFIRMED") {
    return {
      ok: false,
      error: "PROVIDER_CONFIRM_REQUIRED",
      code: "PROVIDER_CONFIRM_REQUIRED",
      message: "제공자 확인이 완료된 뒤에만 승인할 수 있습니다.",
    };
  }
  const binding = parseProviderReviewRevisionBinding(markers.providerReviewSummary);
  if (!binding) {
    return {
      ok: false,
      error: "PROVIDER_REVIEW_STALE",
      code: "PROVIDER_REVIEW_STALE",
      message:
        "제공자 검토가 현재 검색 Revision에 귀속되지 않았습니다. 다시 검토를 요청하세요.",
    };
  }
  const current = await resolveCurrentPublishTargetGeneration(packId, client);
  if (!current || current.id !== binding.indexGenerationId) {
    return {
      ok: false,
      error: "PROVIDER_REVIEW_STALE",
      code: "PROVIDER_REVIEW_STALE",
      message:
        "이전 Revision에 대한 제공자 검토는 현재 게시 대상에 사용할 수 없습니다. 다시 검토하세요.",
    };
  }
  if (current.versionId !== binding.versionId) {
    return {
      ok: false,
      error: "PROVIDER_REVIEW_STALE",
      code: "PROVIDER_REVIEW_STALE",
      message:
        "제공자 검토 Version이 현재 게시 대상과 일치하지 않습니다. 다시 검토하세요.",
    };
  }
  return { ok: true, binding };
}

export async function resolveStoreWorkflowMarkers(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<StoreWorkflowMarkerSnapshot> {
  const trimmed = packId.trim();
  if (!trimmed) return emptyMarkerSnapshot();

  const [providerMarker, serviceMarker, supplementMarker] = await Promise.all([
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
        status: { in: ["PENDING", "RUNNING", "PASS", "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, finishedAt: true, summary: true },
    }),
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
        status: { in: ["PASS", "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { status: true, finishedAt: true, createdAt: true },
    }),
    loadLatestSupplementMarker(trimmed, client),
  ]);

  const providerReviewPhase = mapProviderReviewStatus(providerMarker?.status);
  const effectiveProviderPhase =
    providerReviewPhase === "WITHDRAWN" ? "WITHDRAWN" : providerReviewPhase;

  // P2: service validation is independent of provider review (SV runs first).
  const serviceValidationPhase: StoreServiceValidationPhase =
    serviceMarker?.status === "PASS" ? "PASSED" : "NONE";

  const providerReviewSummary = providerMarker?.summary?.trim() || null;

  const base: StoreWorkflowMarkerSnapshot = {
    providerReviewPhase: effectiveProviderPhase,
    serviceValidationPhase,
    providerReviewRequestedAt:
      effectiveProviderPhase === "REQUESTED" || effectiveProviderPhase === "CONFIRMED"
        ? (providerMarker?.createdAt?.toISOString() ?? null)
        : null,
    providerReviewConfirmedAt:
      effectiveProviderPhase === "CONFIRMED"
        ? (providerMarker?.finishedAt?.toISOString() ??
          providerMarker?.createdAt?.toISOString() ??
          null)
        : null,
    serviceValidationPassedAt:
      serviceValidationPhase === "PASSED"
        ? (serviceMarker?.finishedAt?.toISOString() ??
          serviceMarker?.createdAt?.toISOString() ??
          null)
        : null,
    providerReviewSummary,
    providerChangesRequest: parseProviderChangesRequestSummary(providerReviewSummary),
    providerSupplementPhase: "NONE",
    providerSupplement: null,
    providerSupplementSubmittedAt: null,
  };

  return applySupplementToSnapshot(base, supplementMarker);
}

export async function batchResolveStoreWorkflowMarkers(
  packIds: string[],
  client: PrismaClientLike = prisma,
): Promise<Map<string, StoreWorkflowMarkerSnapshot>> {
  const unique = [...new Set(packIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, StoreWorkflowMarkerSnapshot>();
  if (unique.length === 0) return map;

  for (const id of unique) map.set(id, emptyMarkerSnapshot());

  const [providerRuns, serviceRuns, supplementRuns] = await Promise.all([
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
        status: { in: ["PENDING", "RUNNING", "PASS", "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        packId: true,
        status: true,
        createdAt: true,
        finishedAt: true,
        summary: true,
      },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
        status: { in: ["PASS", "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true, status: true, createdAt: true, finishedAt: true },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
        status: { in: [...OPEN_SUPPLEMENT_PIPELINE_STATUSES, "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        packId: true,
        status: true,
        summary: true,
        createdAt: true,
        finishedAt: true,
      },
    }),
  ]);

  const latestProvider = new Map<string, (typeof providerRuns)[number]>();
  for (const run of providerRuns) {
    if (!latestProvider.has(run.packId)) latestProvider.set(run.packId, run);
  }
  const latestService = new Map<string, (typeof serviceRuns)[number]>();
  for (const run of serviceRuns) {
    if (!latestService.has(run.packId)) latestService.set(run.packId, run);
  }
  const latestSupplement = new Map<string, (typeof supplementRuns)[number]>();
  for (const run of supplementRuns) {
    if (!latestSupplement.has(run.packId)) latestSupplement.set(run.packId, run);
  }

  for (const packId of unique) {
    const providerMarker = latestProvider.get(packId);
    const serviceMarker = latestService.get(packId);
    const providerReviewPhase = mapProviderReviewStatus(providerMarker?.status);
    // P2: service validation is independent of provider review (SV runs first).
    const serviceValidationPhase: StoreServiceValidationPhase =
      serviceMarker?.status === "PASS" ? "PASSED" : "NONE";
    const providerReviewSummary = providerMarker?.summary?.trim() || null;
    const base: StoreWorkflowMarkerSnapshot = {
      providerReviewPhase,
      serviceValidationPhase,
      providerReviewRequestedAt:
        providerReviewPhase === "REQUESTED" || providerReviewPhase === "CONFIRMED"
          ? (providerMarker?.createdAt?.toISOString() ?? null)
          : null,
      providerReviewConfirmedAt:
        providerReviewPhase === "CONFIRMED"
          ? (providerMarker?.finishedAt?.toISOString() ??
            providerMarker?.createdAt?.toISOString() ??
            null)
          : null,
      serviceValidationPassedAt:
        serviceValidationPhase === "PASSED"
          ? (serviceMarker?.finishedAt?.toISOString() ??
            serviceMarker?.createdAt?.toISOString() ??
            null)
          : null,
      providerReviewSummary,
      providerChangesRequest: parseProviderChangesRequestSummary(providerReviewSummary),
      providerSupplementPhase: "NONE",
      providerSupplement: null,
      providerSupplementSubmittedAt: null,
    };
    map.set(
      packId,
      applySupplementToSnapshot(base, latestSupplement.get(packId) ?? null),
    );
  }

  return map;
}

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

export type AdminProviderReturnedPackListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  withdrawnAt: string;
  packStatus: string;
  providerReviewPhase: "WITHDRAWN" | "NONE" | "REQUESTED" | "CONFIRMED";
  serviceValidationPhase: "NONE" | "PASSED";
  providerSupplementPhase: ProviderSupplementAdminPhase | "NONE";
  changesRequest: ProviderChangesRequestPayload | null;
  changeTypeLabel: string | null;
  targetCount: number;
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

/**
 * Admin inbox: provider structured 보완요청 (STORE_PROVIDER_SUPPLEMENT).
 * Also backfills legacy WITHDRAWN+changesRequest packs without a supplement marker.
 */
export async function listAdminProviderReturnedPacks(input?: {
  prismaClient?: PrismaClientLike;
}): Promise<AdminProviderReturnedPackListItem[]> {
  const client = input?.prismaClient ?? prisma;

  const supplementRuns = await client.pipelineRun.findMany({
    where: {
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: { in: [...OPEN_SUPPLEMENT_PIPELINE_STATUSES] },
      pack: { status: PackStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      status: true,
      summary: true,
      createdAt: true,
      finishedAt: true,
      pack: {
        select: {
          status: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
          providerProfile: { select: { displayName: true } },
          versions: {
            orderBy: latestKnowledgePackVersionOrderBy,
            take: 1,
            select: { version: true },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: AdminProviderReturnedPackListItem[] = [];

  for (const run of supplementRuns) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    const state = parseProviderSupplementRequestState(run.summary);
    const phase =
      state?.adminPhase ?? mapSupplementStatusToAdminPhase(run.status);
    if (phase === "NONE" || phase === "WITHDRAWN") continue;
    const display = buildAdminSupplementQueueDisplay(phase);
    const version = run.pack?.versions?.[0] ?? null;
    const changesRequest = state
      ? {
          changeType: state.changeType,
          targetKind: state.targetKind,
          targetLabel: state.targetLabel ?? undefined,
          details: state.details,
        }
      : null;
    const view = buildAdminWorkInboxItemViewModel({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
      sourceKind: "OTHER",
      workerZipPhase: null,
      providerReviewPhase: "WITHDRAWN",
      providerSupplementPhase: phase,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      versionLabel: version?.version ?? null,
    });

    items.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      withdrawnAt:
        state?.submittedAt ??
        run.finishedAt?.toISOString() ??
        run.createdAt.toISOString(),
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
      providerReviewPhase: "WITHDRAWN",
      serviceValidationPhase: view.serviceValidationPhase,
      providerSupplementPhase: phase,
      changesRequest,
      changeTypeLabel: state ? changeTypeLabel(state.changeType) : null,
      targetCount: changesRequest ? 1 : 0,
      workflowStatus: view.workflowStatus,
      displayStatus: display.displayStatus,
      adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED",
      ctaLabel: display.ctaLabel,
      isWaitingForAdmin: display.isWaitingForAdmin,
    });
  }

  // Legacy: WITHDRAWN packs with changesRequest JSON but no supplement marker yet.
  const legacyRuns = await client.pipelineRun.findMany({
    where: {
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      status: "SKIPPED",
      pack: { status: PackStatus.DRAFT },
      ...(seen.size > 0 ? { packId: { notIn: [...seen] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      summary: true,
      createdAt: true,
      finishedAt: true,
      pack: {
        select: {
          status: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
          providerProfile: { select: { displayName: true } },
          versions: {
            orderBy: latestKnowledgePackVersionOrderBy,
            take: 1,
            select: { version: true },
          },
        },
      },
    },
  });

  for (const run of legacyRuns) {
    if (seen.has(run.packId)) continue;
    const changesRequest = parseProviderChangesRequestSummary(run.summary);
    if (!changesRequest) continue;
    seen.add(run.packId);

    // Lazily create pending supplement marker so admin can accept/process.
    const state = buildInitialProviderSupplementState({
      changesRequest,
      submittedAt:
        run.finishedAt?.toISOString() ?? run.createdAt.toISOString(),
      clientId: "legacy-backfill",
    });
    await client.pipelineRun.create({
      data: {
        packId: run.packId,
        triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
        triggeredByClientId: "legacy-backfill",
        status: "PENDING",
        startedAt: run.createdAt,
        summary: encodeProviderSupplementRequestState(state),
      },
    });

    const display = buildAdminSupplementQueueDisplay("PENDING");
    const version = run.pack?.versions?.[0] ?? null;
    items.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      withdrawnAt: state.submittedAt,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
      providerReviewPhase: "WITHDRAWN",
      serviceValidationPhase: "NONE",
      providerSupplementPhase: "PENDING",
      changesRequest,
      changeTypeLabel: changeTypeLabel(state.changeType),
      targetCount: 1,
      workflowStatus: "PROVIDER_WITHDRAWN",
      displayStatus: display.displayStatus,
      adminQueueGroup: "PROVIDER_SUPPLEMENT_REQUIRED",
      ctaLabel: display.ctaLabel,
      isWaitingForAdmin: true,
    });
  }

  return items;
}

type SupplementActionResult =
  | { ok: true; state: ProviderSupplementRequestState }
  | { ok: false; error: string; message: string };

async function loadOpenSupplementRun(
  packId: string,
  client: PrismaClientLike,
): Promise<{
  id: string;
  status: string;
  summary: string | null;
} | null> {
  return client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: { in: ["PENDING", "RUNNING", "WARNING"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, summary: true },
  });
}

export async function acceptAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "접수할 제공자 보완 요청이 없습니다.",
    };
  }
  if (run.status !== "PENDING") {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_PENDING",
      message: "접수 대기 상태의 요청만 접수할 수 있습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    adminPhase: "ACCEPTED",
    acceptedAt: now,
    acceptedByClientId: input.clientId,
    history: [
      ...state.history,
      { at: now, action: "ACCEPT", byRole: "ADMIN" },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("ACCEPTED"),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function resolveAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  resolutionNote: string;
  nextAdminStep?: "NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK";
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const note = input.resolutionNote?.trim() ?? "";
  if (!note) {
    return {
      ok: false,
      error: "RESOLUTION_NOTE_REQUIRED",
      message: "보완 처리 내용을 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "처리할 제공자 보완 요청이 없습니다.",
    };
  }
  if (run.status !== "RUNNING" && run.status !== "WARNING") {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_RESOLVABLE",
      message: "접수 완료 후에만 보완 처리를 완료할 수 있습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    adminPhase: "RESOLVED",
    acceptedAt: state.acceptedAt ?? now,
    acceptedByClientId: state.acceptedByClientId ?? input.clientId,
    resolvedAt: now,
    resolutionNote: note,
    nextAdminStep: input.nextAdminStep ?? "NONE",
    history: [
      ...state.history,
      { at: now, action: "RESOLVE", byRole: "ADMIN", note: note.slice(0, 200) },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("RESOLVED"),
      finishedAt: new Date(),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function rejectAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  rejectionReason: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const reason = input.rejectionReason?.trim() ?? "";
  if (!reason) {
    return {
      ok: false,
      error: "REJECTION_REASON_REQUIRED",
      message: "반려 사유를 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "반려할 제공자 보완 요청이 없습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    adminPhase: "REJECTED",
    rejectedAt: now,
    rejectionReason: reason,
    history: [
      ...state.history,
      { at: now, action: "REJECT", byRole: "ADMIN", note: reason.slice(0, 200) },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("REJECTED"),
      finishedAt: new Date(),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function clarifyAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  clarifyMessage: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const message = input.clarifyMessage?.trim() ?? "";
  if (!message) {
    return {
      ok: false,
      error: "CLARIFY_MESSAGE_REQUIRED",
      message: "추가 확인 요청 내용을 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "추가 확인을 요청할 보완 요청이 없습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    adminPhase: "CLARIFY",
    acceptedAt: state.acceptedAt ?? now,
    acceptedByClientId: state.acceptedByClientId ?? input.clientId,
    clarifyAt: now,
    clarifyMessage: message,
    history: [
      ...state.history,
      {
        at: now,
        action: "CLARIFY",
        byRole: "ADMIN",
        note: message.slice(0, 200),
      },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("CLARIFY"),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function addProviderSupplementNote(input: {
  packId: string;
  clientId: string;
  note: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const text = input.note?.trim() ?? "";
  if (!text) {
    return {
      ok: false,
      error: "NOTE_REQUIRED",
      message: "추가 의견을 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "의견을 남길 보완 요청이 없습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    providerNotes: [
      ...state.providerNotes,
      { at: now, text, clientId: input.clientId },
    ],
    history: [
      ...state.history,
      { at: now, action: "NOTE", byRole: "PROVIDER", note: text.slice(0, 200) },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: { summary: encodeProviderSupplementRequestState(next) },
  });
  return { ok: true, state: next };
}

export async function withdrawProviderSupplementRequest(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const run = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, summary: true },
  });
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_WITHDRAWABLE",
      message: "접수 대기 중인 보완 요청만 철회할 수 있습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    adminPhase: "WITHDRAWN",
    history: [
      ...state.history,
      { at: now, action: "WITHDRAW", byRole: "PROVIDER" },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("WITHDRAWN"),
      finishedAt: new Date(),
      summary: encodeProviderSupplementRequestState(next),
    },
  });
  return { ok: true, state: next };
}

/**
 * After admin resolves a provider 보완요청, re-open provider review handoff
 * so the provider can confirm the fixed generation result.
 */
export async function requestProviderReviewAgainAfterSupplement(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();

  const run = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: "PASS",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, summary: true },
  });
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_RESOLVED",
      message: "보완 완료된 요청만 제공자 재검토를 요청할 수 있습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state || state.adminPhase !== "RESOLVED") {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_RESOLVED",
      message: "보완 완료된 요청만 제공자 재검토를 요청할 수 있습니다.",
    };
  }

  const reviewResult = await requestProviderStoreReview({
    packId,
    clientId: input.clientId,
    prismaClient: client,
  });
  if (!reviewResult.ok) {
    return {
      ok: false,
      error: reviewResult.error,
      message: reviewResult.message,
    };
  }

  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    history: [
      ...state.history,
      {
        at: now,
        action: "REQUEST_REVIEW_AGAIN",
        byRole: "ADMIN",
        note: "제공자 재검토 요청",
      },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function markAdminServiceValidationPassed(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      message: string;
      missingChannels?: string[];
      providerSupplementPhase?: string;
    }
> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const markers = await resolveStoreWorkflowMarkers(packId, client);
  if (isOpenProviderSupplementPhase(markers.providerSupplementPhase)) {
    return {
      ok: false,
      error: "PROVIDER_SUPPLEMENT_OPEN",
      message: "제공자 보완요청이 처리되지 않아 서비스 검증을 완료할 수 없습니다.",
      providerSupplementPhase: markers.providerSupplementPhase,
    };
  }
  if (markers.serviceValidationPhase === "PASSED") return { ok: true };

  const channelGates = await resolveStoreServiceChannelGates(packId, client);
  if (!channelGates.allPassed) {
    const bindingHint =
      channelGates.bindingStatus !== "CURRENT"
        ? channelGates.bindingReason ??
          "최신 산출물 기준 API/MCP/ZIP 검증을 다시 수행해야 합니다."
        : null;
    const channelReason = channelGates.channels.find((c) => !c.passed)?.reasonCode;
    return {
      ok: false,
      error:
        channelReason === "WORKER_ZIP_GENERATION_MISSING"
          ? "WORKER_ZIP_GENERATION_MISSING"
          : channelReason === "WORKER_ZIP_NOT_PASSED"
            ? "WORKER_ZIP_NOT_PASSED"
            : channelGates.bindingStatus === "MISSING"
              ? "BINDING_MISSING"
              : channelGates.bindingStatus === "STALE"
                ? "STALE_BINDING"
                : channelGates.bindingStatus === "NOT_READY"
                  ? "BINDING_NOT_READY"
                  : "SERVICE_CHANNELS_INCOMPLETE",
      message:
        bindingHint ??
        `API·MCP·ZIP/RAG Export 검증이 모두 통과해야 합니다. 미검증: ${channelGates.missingLabels.join(", ")}`,
      missingChannels: channelGates.missingLabels,
    };
  }

  await client.pipelineRun.create({
    data: {
      packId,
      triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
      triggeredByClientId: input.clientId,
      status: "PASS",
      finishedAt: new Date(),
      summary: "관리자 서비스 검증 통과 (API·MCP·ZIP/RAG Export)",
    },
  });

  try {
    await recordProviderAudit({
      action: AuditAction.ADMIN_REVIEW_UPDATE,
      entityType: "KnowledgePack",
      entityId: packId,
      metadata: {
        action: "SERVICE_VALIDATION_PASSED",
        actorClientId: input.clientId,
        channels: channelGates.channels.map((c) => ({
          channel: c.channel,
          passed: c.passed,
        })),
      },
    });
  } catch {
    // Test doubles may omit AuditLog.
  }

  return { ok: true };
}
