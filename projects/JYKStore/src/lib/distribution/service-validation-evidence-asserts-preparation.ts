/**
 * Fail-closed assertions that gate submit/approval on preparation-channel
 * service validation evidence.
 */
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  assertCompletePreparationValidationSnapshotEntry,
  type PreparationValidationSnapshotEntry,
} from "@/lib/distribution/preparation-validation-snapshot-entry";
import {
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
} from "@/lib/distribution/service-validation-policy";
import { findLatestServiceValidationRun } from "@/lib/distribution/service-validation-queries";
import {
  assertDownloadTestEvidenceReady,
  assertSharedApiMcpConfirmationEvidenceIfGrouped,
} from "@/lib/distribution/service-validation-evidence-asserts-helpers";

export type ServiceValidationSubmitSnapshotEntry = {
  status: string;
  runId: string;
  testedAt: string | null;
  providerConfirmationStatus: string;
  providerConfirmationId: string | null;
  confirmedAt: string | null;
};

type PreparationChannelRunContext = {
  run: Awaited<ReturnType<typeof findLatestServiceValidationRun>>;
  resultItemCount: number | null;
};

/** DB-only: latest run for the channel + its result-item count (API/MCP only). */
async function loadPreparationChannelRun(input: {
  versionId: string;
  channel: ServiceChannel;
}): Promise<PreparationChannelRunContext> {
  const run = await findLatestServiceValidationRun({
    versionId: input.versionId,
    channel: input.channel,
  });
  const resultItemCount =
    run && (input.channel === "API" || input.channel === "MCP")
      ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
      : null;
  return { run, resultItemCount };
}

/** Pure: current validity for a preparation-channel run (STALE when no run exists). */
export function resolvePreparationChannelValidity(input: {
  run: PreparationChannelRunContext["run"];
  resultItemCount: number | null;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): "CURRENT" | "STALE" {
  if (!input.run) return "STALE";
  return resolveRunCurrentValidity({
    run: input.run,
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
    resultItemCount: input.resultItemCount,
    expectedRankingPolicyVersion:
      input.channel === "API" || input.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
}

/** Pure: throws unless the run PASSed and is CURRENT. */
function assertPreparationChannelRunPassCurrent(
  run: PreparationChannelRunContext["run"],
  validity: "CURRENT" | "STALE",
  channel: ServiceChannel,
): asserts run is NonNullable<PreparationChannelRunContext["run"]> {
  if (run && run.status === "PASS" && validity === "CURRENT") return;
  throw new PayloadServiceError(
    validity === "STALE" || run?.status === "STALE"
      ? "SERVICE_VALIDATION_STALE"
      : "SERVICE_VALIDATION_REQUIRED",
    validity === "STALE"
      ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
      : `${channel} 제공 방식의 검증이 필요합니다.`,
    400,
  );
}

/** Pure: throws when the run no longer matches the expected pipeline/document/index binding. */
function assertPreparationChannelRunMatchesBinding(input: {
  run: NonNullable<PreparationChannelRunContext["run"]>;
  packId: string;
  versionId: string;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): void {
  const { run } = input;
  const stale =
    run.packId !== input.packId ||
    run.versionId !== input.versionId ||
    (input.pipelineRunId && run.pipelineRunId !== input.pipelineRunId) ||
    (input.normalizedDocumentId && run.normalizedDocumentId !== input.normalizedDocumentId) ||
    (input.bindingFingerprint && run.fingerprint !== input.bindingFingerprint) ||
    (input.bindingIndexGenerationId && run.indexGenerationId !== input.bindingIndexGenerationId);
  if (stale) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다.",
      400,
    );
  }
}

/** Pure: throws when an API/MCP run has no retrieval result-item snapshot. */
function assertPreparationChannelResultsNonEmpty(
  channel: ServiceChannel,
  resultItemCount: number | null,
): void {
  if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      `${channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
      400,
    );
  }
}

/** DB + pure: resolves the provider confirmation, or throws when it isn't CONFIRMED. */
async function loadPreparationChannelConfirmation(input: {
  runId: string;
  validity: "CURRENT" | "STALE";
  channel: ServiceChannel;
}) {
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: input.runId },
  });
  const confStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: input.validity,
  });
  if (confStatus !== "CONFIRMED" || !confirmation) {
    throw new PayloadServiceError(
      confStatus === "STALE"
        ? "SERVICE_VALIDATION_STALE"
        : confStatus === "REJECTED"
          ? "SERVICE_CONFIRMATION_REJECTED"
          : "SERVICE_CONFIRMATION_REQUIRED",
      confStatus === "REJECTED"
        ? `${input.channel} 제공 방식의 검색 품질이 반려되었습니다. 다시 검증해 주세요.`
        : confStatus === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 품질 확인을 다시 진행해야 합니다."
          : `${input.channel} 제공 방식의 제공자 품질 확인이 필요합니다.`,
      400,
    );
  }
  return { confirmation, confStatus };
}

async function assertPreparationChannelPassed(input: {
  packId: string;
  versionId: string;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
}): Promise<PreparationValidationSnapshotEntry> {
  const { run, resultItemCount } = await loadPreparationChannelRun(input);
  const validity = resolvePreparationChannelValidity({ run, resultItemCount, ...input });
  assertPreparationChannelRunPassCurrent(run, validity, input.channel);
  assertPreparationChannelRunMatchesBinding({ run, ...input });
  assertPreparationChannelResultsNonEmpty(input.channel, resultItemCount);

  const downloadTestId =
    input.channel === "DOWNLOAD" ? await assertDownloadTestEvidenceReady(prisma, run.id) : null;

  const { confirmation, confStatus } = await loadPreparationChannelConfirmation({
    runId: run.id,
    validity,
    channel: input.channel,
  });

  return {
    status: run.status,
    runId: run.id,
    testedAt: run.testedAt?.toISOString() ?? null,
    currentValidity: "CURRENT",
    providerConfirmationStatus: confStatus,
    providerConfirmationId: confirmation.id,
    confirmedAt: confirmation.confirmedAt.toISOString(),
    pipelineRunId: run.pipelineRunId,
    normalizedDocumentId: run.normalizedDocumentId,
    indexGenerationId: run.indexGenerationId,
    fingerprint: run.fingerprint,
    resultFingerprint:
      input.channel === "API" || input.channel === "MCP" ? run.resultFingerprint : undefined,
    downloadTestId: downloadTestId ?? undefined,
  };
}

export async function assertPreparationServiceValidationsPassed(input: {
  packId: string;
  versionId: string;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
}): Promise<Record<ServiceChannel, PreparationValidationSnapshotEntry>> {
  const snapshot = {} as Record<ServiceChannel, PreparationValidationSnapshotEntry>;
  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    snapshot[channel] = await assertPreparationChannelPassed({
      packId: input.packId,
      versionId: input.versionId,
      channel,
      bindingFingerprint: input.bindingFingerprint,
      bindingIndexGenerationId: input.bindingIndexGenerationId,
      pipelineRunId: input.pipelineRunId,
      normalizedDocumentId: input.normalizedDocumentId,
    });
    assertCompletePreparationValidationSnapshotEntry(channel, snapshot[channel]);
  }
  await assertSharedApiMcpConfirmationEvidenceIfGrouped(prisma, {
    apiRunId: snapshot.API?.runId,
    mcpRunId: snapshot.MCP?.runId,
    apiConfirmationId: snapshot.API?.providerConfirmationId,
    mcpConfirmationId: snapshot.MCP?.providerConfirmationId,
  });
  return snapshot;
}
