/**
 * Admin Store handoff gates — server-side resolvers.
 * Pure policy lives in store-workflow-handoff-gates-policy.ts (client-safe).
 */

import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { resolveCurrentValidationBindingTx } from "@/lib/distribution/service-validation-binding";
import { resolveRunCurrentValidity } from "@/lib/distribution/service-validation-policy";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import {
  getProviderWorkerZipRequestState,
  resolveAdminDraftPack,
} from "@/lib/python-worker/worker-zip-import-provider-service";

export {
  canRequestProviderReviewHandoff,
  isWorkerKnowledgeGenerationCompleted,
} from "@/lib/store-workflow-handoff-gates-policy";

export type StoreServiceChannelId = "API" | "MCP" | "DOWNLOAD";

export type StoreServiceChannelGate = {
  channel: StoreServiceChannelId;
  label: string;
  passed: boolean;
  reason: string | null;
};

export type StoreServiceChannelGateSnapshot = {
  allPassed: boolean;
  channels: StoreServiceChannelGate[];
  missingLabels: string[];
};

const CHANNEL_LABELS: Record<StoreServiceChannelId, string> = {
  API: "API",
  MCP: "MCP",
  DOWNLOAD: "ZIP/RAG Export",
};

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
 * Admin-side API/MCP/DOWNLOAD readiness for Store service-validation complete.
 * Requires latest PASS + CURRENT run per channel (DOWNLOAD also needs download test).
 * Provider channel confirmation is not required here — generation confirm is separate.
 */
export async function resolveStoreServiceChannelGates(
  packId: string,
  client: typeof prisma = prisma,
): Promise<StoreServiceChannelGateSnapshot> {
  const trimmed = packId.trim();
  const channels: StoreServiceChannelGate[] = [
    { channel: "API", label: CHANNEL_LABELS.API, passed: false, reason: "미검증" },
    { channel: "MCP", label: CHANNEL_LABELS.MCP, passed: false, reason: "미검증" },
    {
      channel: "DOWNLOAD",
      label: CHANNEL_LABELS.DOWNLOAD,
      passed: false,
      reason: "미검증",
    },
  ];

  if (!trimmed) {
    return {
      allPassed: false,
      channels,
      missingLabels: channels.map((c) => c.label),
    };
  }

  const pack = await client.knowledgePack.findUnique({
    where: { packId: trimmed },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
    },
  });
  const version = pack?.versions[0];
  if (!version) {
    return {
      allPassed: false,
      channels: channels.map((c) => ({
        ...c,
        reason: "버전이 없습니다.",
      })),
      missingLabels: channels.map((c) => c.label),
    };
  }

  let bindingFingerprint: string | null = null;
  let bindingIndexGenerationId: string | null = null;
  try {
    const binding = await resolveCurrentValidationBindingTx(client, {
      packId: trimmed,
      versionId: version.id,
    });
    bindingFingerprint = binding?.fingerprint ?? null;
    bindingIndexGenerationId = binding?.indexGenerationId ?? null;
  } catch {
    // Binding may be missing for early drafts; treat as not CURRENT.
  }

  for (const gate of channels) {
    const run = await client.serviceValidationRun.findFirst({
      where: { versionId: version.id, channel: gate.channel },
      orderBy: { createdAt: "desc" },
    });
    if (!run) {
      gate.passed = false;
      gate.reason = "실행 기록 없음";
      continue;
    }
    if (run.status !== "PASS") {
      gate.passed = false;
      gate.reason = `결과 ${run.status}`;
      continue;
    }

    const resultItemCount =
      gate.channel === "API" || gate.channel === "MCP"
        ? await client.serviceValidationResultItem.count({ where: { runId: run.id } })
        : null;
    if (
      (gate.channel === "API" || gate.channel === "MCP") &&
      (resultItemCount ?? 0) < 1
    ) {
      gate.passed = false;
      gate.reason = "검색 결과 없음";
      continue;
    }

    const validity = resolveRunCurrentValidity({
      run,
      bindingFingerprint,
      bindingIndexGenerationId,
      resultItemCount,
      expectedRankingPolicyVersion:
        gate.channel === "API" || gate.channel === "MCP"
          ? RETRIEVAL_RANKING_POLICY_VERSION
          : null,
    });
    if (validity !== "CURRENT") {
      gate.passed = false;
      gate.reason = validity === "STALE" ? "STALE (재검증 필요)" : "유효하지 않음";
      continue;
    }

    if (gate.channel === "DOWNLOAD") {
      const downloadTest = await client.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (!downloadTest?.responseReady) {
        gate.passed = false;
        gate.reason = "Export 다운로드 테스트 미완료";
        continue;
      }
    }

    gate.passed = true;
    gate.reason = null;
  }

  const missingLabels = channels.filter((c) => !c.passed).map((c) => c.label);
  return {
    allPassed: missingLabels.length === 0,
    channels,
    missingLabels,
  };
}
