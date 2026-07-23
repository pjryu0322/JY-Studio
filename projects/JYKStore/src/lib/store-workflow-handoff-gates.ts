/**
 * Admin Store handoff gates — server-side resolvers.
 * Pure policy lives in store-workflow-handoff-gates-policy.ts (client-safe).
 */

import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  resolveValidationBindingState,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import { resolveRunCurrentValidity } from "@/lib/distribution/service-validation-policy";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import {
  getProviderWorkerZipRequestState,
  resolveAdminDraftPack,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import { WORKER_ZIP_IMPORT_TRIGGER } from "@/lib/python-worker/worker-zip-step-log";
import { SEARCH_GENERATION_VALIDATABLE_STATUSES } from "@/lib/search-generation/search-generation-types";

export {
  canRequestProviderReviewHandoff,
  isWorkerKnowledgeGenerationCompleted,
} from "@/lib/store-workflow-handoff-gates-policy";

export type StoreServiceChannelId = "API" | "MCP" | "DOWNLOAD";

export type StoreServiceChannelGateReasonCode =
  | "NOT_VALIDATED"
  | "RUN_NOT_PASS"
  | "EMPTY_RESULTS"
  | "STALE_BINDING"
  | "BINDING_MISSING"
  | "BINDING_NOT_READY"
  | "FINGERPRINT_MISMATCH"
  | "INDEX_GENERATION_MISMATCH"
  | "DOWNLOAD_TEST_INCOMPLETE"
  | "NO_VERSION";

export type StoreServiceChannelGate = {
  channel: StoreServiceChannelId;
  label: string;
  passed: boolean;
  reason: string | null;
  reasonCode: StoreServiceChannelGateReasonCode | null;
};

export type StoreValidationBindingStatus =
  | "CURRENT"
  | "MISSING"
  | "STALE"
  | "NOT_READY";

export type StoreServiceChannelGateSnapshot = {
  allPassed: boolean;
  /** Alias used by tests / callers — same as allPassed. */
  serviceValidationReady: boolean;
  bindingStatus: StoreValidationBindingStatus;
  bindingReason: string | null;
  bindingSource: "DOCLING_KNOWLEDGE" | "WORKER_ZIP" | null;
  bindingFingerprint: string | null;
  bindingIndexGenerationId: string | null;
  channels: StoreServiceChannelGate[];
  missingLabels: string[];
};

const CHANNEL_LABELS: Record<StoreServiceChannelId, string> = {
  API: "API",
  MCP: "MCP",
  DOWNLOAD: "ZIP/RAG Export",
};

type PrismaClientLike = typeof prisma;

export async function resolveAdminWorkerZipPhaseForPack(input: {
  packId: string;
  adminUserId: string;
  clientId: string;
}): Promise<AdminWorkerZipPhase> {
  try {
    const state = await getProviderWorkerZipRequestState({
      userId: input.adminUserId,
      clientId: input.clientId,
      packId: input.packId,
      resolvePack: resolveAdminDraftPack,
    });
    return state.requestStatus as AdminWorkerZipPhase;
  } catch {
    return "NONE";
  }
}

/**
 * Resolve the current knowledge binding for Store service-validation gates.
 * Prefers Docling knowledge pipeline binding; falls back to latest READY
 * SearchIndexGeneration from a PASS WORKER_ZIP_IMPORT run (or latest READY gen).
 */
export async function resolveStoreValidationBinding(input: {
  packId: string;
  versionId: string;
  prismaClient?: PrismaClientLike;
}): Promise<{
  status: StoreValidationBindingStatus;
  binding: Pick<
    CurrentValidationBinding,
    "fingerprint" | "indexGenerationId" | "pipelineRunId" | "versionId"
  > | null;
  source: "DOCLING_KNOWLEDGE" | "WORKER_ZIP" | null;
  reason: string | null;
}> {
  const client = input.prismaClient ?? prisma;
  const docling = await resolveValidationBindingState(client, {
    packId: input.packId,
    versionId: input.versionId,
  });
  if (docling.status === "CURRENT" && docling.binding) {
    return {
      status: "CURRENT",
      binding: {
        fingerprint: docling.binding.fingerprint,
        indexGenerationId: docling.binding.indexGenerationId,
        pipelineRunId: docling.binding.pipelineRunId,
        versionId: docling.binding.versionId,
      },
      source: "DOCLING_KNOWLEDGE",
      reason: null,
    };
  }

  const latestZipPass = await client.pipelineRun.findFirst({
    where: {
      packId: input.packId,
      triggerType: WORKER_ZIP_IMPORT_TRIGGER,
      status: "PASS",
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  const generation =
    (latestZipPass
      ? await client.searchIndexGeneration.findFirst({
          where: {
            packId: input.packId,
            versionId: input.versionId,
            pipelineRunId: latestZipPass.id,
            status: { in: [...SEARCH_GENERATION_VALIDATABLE_STATUSES] },
            staleAt: null,
            retiredAt: null,
          },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            fingerprint: true,
            pipelineRunId: true,
            versionId: true,
            status: true,
          },
        })
      : null) ??
    (await client.searchIndexGeneration.findFirst({
      where: {
        packId: input.packId,
        versionId: input.versionId,
        status: { in: [...SEARCH_GENERATION_VALIDATABLE_STATUSES] },
        staleAt: null,
        retiredAt: null,
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        fingerprint: true,
        pipelineRunId: true,
        versionId: true,
        status: true,
      },
    }));

  if (generation?.fingerprint && generation.id) {
    return {
      status: "CURRENT",
      binding: {
        fingerprint: generation.fingerprint,
        indexGenerationId: generation.id,
        pipelineRunId: generation.pipelineRunId,
        versionId: generation.versionId,
      },
      source: "WORKER_ZIP",
      reason: null,
    };
  }

  if (docling.status === "NOT_READY") {
    return {
      status: "NOT_READY",
      binding: null,
      source: null,
      reason: "최신 지식데이터 생성이 아직 완료되지 않았습니다.",
    };
  }
  if (docling.status === "STALE" || latestZipPass) {
    return {
      status: "STALE",
      binding: null,
      source: null,
      reason: "최신 지식데이터 기준 validation binding이 없습니다. 재검증이 필요합니다.",
    };
  }
  return {
    status: "MISSING",
    binding: null,
    source: null,
    reason: "validation binding이 없습니다. 최신 지식데이터 기준 검증이 필요합니다.",
  };
}

function failAllChannels(
  reason: string,
  reasonCode: StoreServiceChannelGateReasonCode,
  bindingStatus: StoreValidationBindingStatus,
  bindingReason: string | null,
): StoreServiceChannelGateSnapshot {
  const channels: StoreServiceChannelGate[] = (
    ["API", "MCP", "DOWNLOAD"] as StoreServiceChannelId[]
  ).map((channel) => ({
    channel,
    label: CHANNEL_LABELS[channel],
    passed: false,
    reason,
    reasonCode,
  }));
  return {
    allPassed: false,
    serviceValidationReady: false,
    bindingStatus,
    bindingReason,
    bindingSource: null,
    bindingFingerprint: null,
    bindingIndexGenerationId: null,
    channels,
    missingLabels: channels.map((c) => c.label),
  };
}

/**
 * Classify a PASS run against the current binding for Store gates.
 * Exported for unit tests (no DB).
 */
export function classifyStoreServiceChannelRun(input: {
  channel: StoreServiceChannelId;
  run: {
    status: string;
    fingerprint: string | null;
    indexGenerationId: string | null;
    invalidatedAt?: Date | string | null;
    details?: unknown;
  } | null;
  bindingFingerprint: string;
  bindingIndexGenerationId: string;
  resultItemCount?: number | null;
  downloadTestReady?: boolean;
}): Omit<StoreServiceChannelGate, "channel" | "label"> {
  if (!input.run) {
    return { passed: false, reason: "실행 기록 없음", reasonCode: "NOT_VALIDATED" };
  }
  if (input.run.status !== "PASS") {
    return {
      passed: false,
      reason: `결과 ${input.run.status}`,
      reasonCode: "RUN_NOT_PASS",
    };
  }

  const validity = resolveRunCurrentValidity({
    run: {
      status: input.run.status,
      fingerprint: input.run.fingerprint,
      indexGenerationId: input.run.indexGenerationId,
      invalidatedAt:
        input.run.invalidatedAt instanceof Date
          ? input.run.invalidatedAt
          : input.run.invalidatedAt
            ? new Date(input.run.invalidatedAt)
            : null,
      channel: input.channel,
      details: input.run.details,
    },
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
    resultItemCount: input.resultItemCount,
    expectedRankingPolicyVersion:
      input.channel === "API" || input.channel === "MCP"
        ? RETRIEVAL_RANKING_POLICY_VERSION
        : null,
  });

  if (validity !== "CURRENT") {
    if (
      input.bindingFingerprint &&
      (!input.run.fingerprint || input.run.fingerprint !== input.bindingFingerprint)
    ) {
      return {
        passed: false,
        reason: "fingerprint 불일치 (재검증 필요)",
        reasonCode: "FINGERPRINT_MISMATCH",
      };
    }
    if (
      input.bindingIndexGenerationId &&
      (!input.run.indexGenerationId ||
        input.run.indexGenerationId !== input.bindingIndexGenerationId)
    ) {
      return {
        passed: false,
        reason: "indexGeneration 불일치 (재검증 필요)",
        reasonCode: "INDEX_GENERATION_MISMATCH",
      };
    }
    if (
      (input.channel === "API" || input.channel === "MCP") &&
      (input.resultItemCount ?? 0) < 1
    ) {
      return {
        passed: false,
        reason: "검색 결과 없음",
        reasonCode: "EMPTY_RESULTS",
      };
    }
    return {
      passed: false,
      reason: "STALE (최신 지식데이터 기준 재검증 필요)",
      reasonCode: "STALE_BINDING",
    };
  }

  if (input.channel === "DOWNLOAD" && !input.downloadTestReady) {
    return {
      passed: false,
      reason: "Export 다운로드 테스트 미완료",
      reasonCode: "DOWNLOAD_TEST_INCOMPLETE",
    };
  }

  return { passed: true, reason: null, reasonCode: null };
}

/**
 * Admin-side API/MCP/DOWNLOAD readiness for Store service-validation complete.
 * Requires a current knowledge binding (Docling or Worker ZIP) and PASS+CURRENT
 * runs that match that binding for all three channels.
 */
export async function resolveStoreServiceChannelGates(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<StoreServiceChannelGateSnapshot> {
  const trimmed = packId.trim();
  if (!trimmed) {
    return failAllChannels("packId가 필요합니다.", "NOT_VALIDATED", "MISSING", "packId 없음");
  }

  const pack = await client.knowledgePack.findUnique({
    where: { packId: trimmed },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
    },
  });
  const version = pack?.versions[0];
  if (!version) {
    return failAllChannels("버전이 없습니다.", "NO_VERSION", "MISSING", "버전 없음");
  }

  const bindingResolved = await resolveStoreValidationBinding({
    packId: trimmed,
    versionId: version.id,
    prismaClient: client,
  });

  if (bindingResolved.status !== "CURRENT" || !bindingResolved.binding) {
    const reasonCode: StoreServiceChannelGateReasonCode =
      bindingResolved.status === "NOT_READY"
        ? "BINDING_NOT_READY"
        : bindingResolved.status === "STALE"
          ? "STALE_BINDING"
          : "BINDING_MISSING";
    const reason =
      bindingResolved.reason ?? "최신 지식데이터 기준 API/MCP/ZIP 검증이 필요합니다.";
    return {
      ...failAllChannels(reason, reasonCode, bindingResolved.status, reason),
      bindingSource: bindingResolved.source,
    };
  }

  const bindingFingerprint = bindingResolved.binding.fingerprint;
  const bindingIndexGenerationId = bindingResolved.binding.indexGenerationId;
  const channels: StoreServiceChannelGate[] = [];

  for (const channel of ["API", "MCP", "DOWNLOAD"] as StoreServiceChannelId[]) {
    const run = await client.serviceValidationRun.findFirst({
      where: { versionId: version.id, channel },
      orderBy: { createdAt: "desc" },
    });
    const resultItemCount =
      run && (channel === "API" || channel === "MCP")
        ? await client.serviceValidationResultItem.count({ where: { runId: run.id } })
        : null;
    let downloadTestReady = false;
    if (run && channel === "DOWNLOAD") {
      const downloadTest = await client.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      downloadTestReady = Boolean(downloadTest?.responseReady);
    }

    const classified = classifyStoreServiceChannelRun({
      channel,
      run: run
        ? {
            status: run.status,
            fingerprint: run.fingerprint,
            indexGenerationId: run.indexGenerationId,
            invalidatedAt: run.invalidatedAt,
            details: run.details,
          }
        : null,
      bindingFingerprint,
      bindingIndexGenerationId,
      resultItemCount,
      downloadTestReady,
    });

    channels.push({
      channel,
      label: CHANNEL_LABELS[channel],
      ...classified,
    });
  }

  const missingLabels = channels.filter((c) => !c.passed).map((c) => c.label);
  const allPassed = missingLabels.length === 0;
  return {
    allPassed,
    serviceValidationReady: allPassed,
    bindingStatus: "CURRENT",
    bindingReason: null,
    bindingSource: bindingResolved.source,
    bindingFingerprint,
    bindingIndexGenerationId,
    channels,
    missingLabels,
  };
}
