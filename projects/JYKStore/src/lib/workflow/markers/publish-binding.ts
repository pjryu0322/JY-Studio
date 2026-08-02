/**
 * Publish-target generation resolution + provider-review revision binding checks.
 */

import { prisma } from "@/lib/prisma";
import {
  parseProviderReviewRevisionBinding,
  type ProviderReviewRevisionBinding,
} from "@/lib/store-workflow-provider-review-binding";
import { WORKER_ZIP_IMPORT_TRIGGER } from "./constants";
import type { PrismaClientLike } from "./types";
import { resolveStoreWorkflowMarkers } from "./resolve";

export async function assertProviderConfirmEvidence(
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
