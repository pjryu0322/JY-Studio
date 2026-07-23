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

import { prisma } from "@/lib/prisma";
import type {
  StoreProviderReviewPhase,
  StoreServiceValidationPhase,
} from "@/lib/store-workflow-status";
import { resolveStoreServiceChannelGates } from "@/lib/store-workflow-handoff-gates";
import {
  encodeProviderChangesRequestSummary,
  type ProviderChangesRequestPayload,
} from "@/lib/provider-review-workbench";

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
};

async function assertProviderConfirmEvidence(
  packId: string,
  client: PrismaClientLike,
): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
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
    select: { id: true },
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

  return { ok: true };
}

function mapProviderReviewStatus(status: string | undefined | null): StoreProviderReviewPhase {
  if (status === "PENDING" || status === "RUNNING") return "REQUESTED";
  if (status === "PASS") return "CONFIRMED";
  if (status === "SKIPPED") return "WITHDRAWN";
  return "NONE";
}

export async function resolveStoreWorkflowMarkers(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<StoreWorkflowMarkerSnapshot> {
  const trimmed = packId.trim();
  if (!trimmed) {
    return {
      providerReviewPhase: "NONE",
      serviceValidationPhase: "NONE",
      providerReviewRequestedAt: null,
      providerReviewConfirmedAt: null,
      serviceValidationPassedAt: null,
    };
  }

  const [providerMarker, serviceMarker] = await Promise.all([
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
        status: { in: ["PENDING", "RUNNING", "PASS", "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, finishedAt: true },
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
  ]);

  const providerReviewPhase = mapProviderReviewStatus(providerMarker?.status);
  // WITHDRAWN only when latest marker is SKIPPED and there is no newer open/pass —
  // findFirst already returns latest; treat SKIPPED as WITHDRAWN for CTA until new request.
  const effectiveProviderPhase =
    providerReviewPhase === "WITHDRAWN" ? "WITHDRAWN" : providerReviewPhase;

  const serviceValidationPhase: StoreServiceValidationPhase =
    serviceMarker?.status === "PASS" && effectiveProviderPhase === "CONFIRMED"
      ? "PASSED"
      : "NONE";

  return {
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
  };
}

export async function batchResolveStoreWorkflowMarkers(
  packIds: string[],
  client: PrismaClientLike = prisma,
): Promise<Map<string, StoreWorkflowMarkerSnapshot>> {
  const unique = [...new Set(packIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, StoreWorkflowMarkerSnapshot>();
  if (unique.length === 0) return map;

  const empty = (): StoreWorkflowMarkerSnapshot => ({
    providerReviewPhase: "NONE",
    serviceValidationPhase: "NONE",
    providerReviewRequestedAt: null,
    providerReviewConfirmedAt: null,
    serviceValidationPassedAt: null,
  });

  for (const id of unique) map.set(id, empty());

  const [providerRuns, serviceRuns] = await Promise.all([
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
        status: { in: ["PENDING", "RUNNING", "PASS", "SKIPPED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true, status: true, createdAt: true, finishedAt: true },
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
  ]);

  const latestProvider = new Map<string, (typeof providerRuns)[number]>();
  for (const run of providerRuns) {
    if (!latestProvider.has(run.packId)) latestProvider.set(run.packId, run);
  }
  const latestService = new Map<string, (typeof serviceRuns)[number]>();
  for (const run of serviceRuns) {
    if (!latestService.has(run.packId)) latestService.set(run.packId, run);
  }

  for (const packId of unique) {
    const providerMarker = latestProvider.get(packId);
    const serviceMarker = latestService.get(packId);
    const providerReviewPhase = mapProviderReviewStatus(providerMarker?.status);
    const serviceValidationPhase: StoreServiceValidationPhase =
      serviceMarker?.status === "PASS" && providerReviewPhase === "CONFIRMED"
        ? "PASSED"
        : "NONE";
    map.set(packId, {
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
    });
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

  await client.pipelineRun.update({
    where: { id: open.id },
    data: {
      status: "PASS",
      finishedAt: new Date(),
      summary: "제공자가 생성 결과 검토를 확인 완료했습니다.",
      triggeredByClientId: input.clientId,
    },
  });

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

  return { ok: true };
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
    }
> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const markers = await resolveStoreWorkflowMarkers(packId, client);
  if (markers.providerReviewPhase !== "CONFIRMED") {
    return {
      ok: false,
      error: "PROVIDER_CONFIRM_REQUIRED",
      message: "제공자 확인 완료 후에만 서비스 검증을 완료할 수 있습니다.",
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

  return { ok: true };
}
