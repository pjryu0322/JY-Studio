/**
 * Resolve StoreWorkflowMarkerSnapshot(s) from PipelineRun markers (no schema migration).
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
import { parseProviderChangesRequestSummary } from "@/lib/provider-review-workbench";
import {
  STORE_PROVIDER_SUPPLEMENT_TRIGGER,
  mapSupplementStatusToAdminPhase,
  OPEN_SUPPLEMENT_PIPELINE_STATUSES,
  parseProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
} from "./constants";
import type { PrismaClientLike, StoreWorkflowMarkerSnapshot } from "./types";

export function emptyMarkerSnapshot(): StoreWorkflowMarkerSnapshot {
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

export function mapProviderReviewStatus(
  status: string | undefined | null,
): StoreProviderReviewPhase {
  if (status === "PENDING" || status === "RUNNING") return "REQUESTED";
  if (status === "PASS") return "CONFIRMED";
  if (status === "SKIPPED") return "WITHDRAWN";
  return "NONE";
}

export async function loadLatestSupplementMarker(
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

export function applySupplementToSnapshot(
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
