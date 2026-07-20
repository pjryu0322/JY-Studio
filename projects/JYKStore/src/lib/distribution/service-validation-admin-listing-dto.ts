/**
 * Admin service validation ops log: DTO types and run → DTO mapping.
 */
import { type ServiceValidationRun } from "@prisma/client";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import {
  evidenceIntegrityForRun,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  adapterPathForChannel,
  asRecord,
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
} from "@/lib/distribution/service-validation-policy";
import {
  resolveAdminRunInvalidationReason,
  resolveAdminRunSharedConfirmationStaleOverride,
} from "@/lib/distribution/service-validation-admin-listing-helpers";
import { loadSharedConfirmationPeerFingerprints } from "@/lib/distribution/service-validation-queries";

/** Admin-only ops log DTO (includes internal identifiers). */
export type AdminServiceValidationRunDto = {
  runId: string;
  packId: string;
  versionId: string;
  versionLabel: string | null;
  channel: string;
  /** Stored historical status (PASS/FAIL/...) — never rewritten. */
  historicalStatus: string;
  /** Evidence matches the PipelineRun recorded on the run. */
  evidenceIntegrity: "VALID" | "INVALID";
  /** Effective status for current version deployment binding (may be STALE). */
  systemStatus: string;
  currentValidity: "CURRENT" | "STALE" | "NOT_APPLICABLE" | null;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  providerConfirmationStatus: string | null;
  providerConfirmationId: string | null;
  resultFingerprint: string | null;
  adapterPath: string;
  pipelineRunId: string | null;
  indexGenerationId: string | null;
  normalizedDocumentId: string | null;
  fingerprint: string | null;
  toolName: string | null;
  mcpProtocolVersion: string | null;
  requestId: string | null;
  resultCount: number | null;
  latencyMs: number | null;
  topChunkId: string | null;
  sourceDocumentId: string | null;
  page: number | null;
  query: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  testedByUserId: string | null;
  testedByName: string | null;
  testedAt: string | null;
  confirmedByUserId: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  downloadTestCompleted: boolean;
  downloadTestedAt: string | null;
  downloadTestedByUserId: string | null;
  downloadTestedByName: string | null;
  downloadTestFileId: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
  results: Array<{
    rank: number;
    chunkId: string;
    title: string;
    snippet: string;
    score: number;
    sourceDocumentId: string;
    sourceDocumentTitle: string | null;
    pageStart: number | null;
    pageEnd: number | null;
  }>;
};

export type AdminServiceValidationListResult = {
  latestByChannel: AdminServiceValidationRunDto[];
  history: AdminServiceValidationRunDto[];
  versions: Array<{ id: string; label: string; isLatest: boolean }>;
  versionScope: "ALL" | "LATEST" | "VERSION";
  selectedVersionId: string | null;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

type AdminRunRecords = {
  confirmation: Awaited<
    ReturnType<typeof prisma.serviceValidationProviderConfirmation.findUnique>
  >;
  results: Awaited<ReturnType<typeof prisma.serviceValidationResultItem.findMany>>;
  downloadTest: Awaited<ReturnType<typeof prisma.serviceValidationDownloadTest.findUnique>>;
};

/** DB-only: load the per-run rows needed to build the admin DTO. No policy here. */
async function loadAdminRunRecords(runId: string): Promise<AdminRunRecords> {
  const [confirmation, results, downloadTest] = await Promise.all([
    prisma.serviceValidationProviderConfirmation.findUnique({ where: { runId } }),
    prisma.serviceValidationResultItem.findMany({ where: { runId }, orderBy: { rank: "asc" } }),
    prisma.serviceValidationDownloadTest.findUnique({ where: { runId } }),
  ]);
  return { confirmation, results, downloadTest };
}

/** Pure: resolve current validity + invalidation reason from run/records/bindings. */
function resolveAdminRunValidityAndReason(input: {
  run: ServiceValidationRun;
  versionCurrentBinding: CurrentValidationBinding | null;
  runPipelineBinding: CurrentValidationBinding | null;
  records: AdminRunRecords;
  evidenceIntegrity: "VALID" | "INVALID";
  sharedStaleOverride: boolean;
}): { validity: "CURRENT" | "STALE"; invalidationReason: string | null } {
  const { run, versionCurrentBinding, records } = input;
  const baseValidity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: versionCurrentBinding?.fingerprint,
    bindingIndexGenerationId: versionCurrentBinding?.indexGenerationId,
    resultItemCount: run.channel === "DOWNLOAD" ? null : records.results.length,
    expectedRankingPolicyVersion:
      run.channel === "API" || run.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
  const validity = input.sharedStaleOverride ? "STALE" : baseValidity;
  const invalidationReason = resolveAdminRunInvalidationReason({
    invalidatedAt: run.invalidatedAt,
    evidenceIntegrity: input.evidenceIntegrity,
    status: run.status,
    validity,
    channel: run.channel,
    resultCount: records.results.length,
    sharedStaleOverride: input.sharedStaleOverride,
  });
  return { validity, invalidationReason };
}

/** Pure: assemble the admin result-item DTOs (rank/score/source columns only). */
function buildAdminRunResultDtos(
  results: AdminRunRecords["results"],
): AdminServiceValidationRunDto["results"] {
  return results.map((r) => ({
    rank: r.rank,
    chunkId: r.chunkId,
    title: r.title,
    snippet: r.snippet,
    score: r.score,
    sourceDocumentId: r.sourceDocumentId,
    sourceDocumentTitle: r.sourceDocumentTitle,
    pageStart: r.pageStart,
    pageEnd: r.pageEnd,
  }));
}

/** Pure: assemble the tested/confirmed/downloadTested user-attribution fields. */
function buildAdminRunAttributionFields(
  run: ServiceValidationRun,
  records: AdminRunRecords,
  userNames: Map<string, string>,
) {
  const { confirmation, downloadTest } = records;
  return {
    testedByUserId: run.testedByUserId,
    testedByName: run.testedByUserId ? userNames.get(run.testedByUserId) ?? null : null,
    testedAt: run.testedAt?.toISOString() ?? null,
    confirmedByUserId: confirmation?.confirmedByUserId ?? null,
    confirmedByName: confirmation?.confirmedByUserId
      ? userNames.get(confirmation.confirmedByUserId) ?? null
      : null,
    confirmedAt: confirmation?.confirmedAt.toISOString() ?? null,
    downloadTestCompleted: Boolean(downloadTest?.responseReady),
    downloadTestedAt: downloadTest?.testedAt.toISOString() ?? null,
    downloadTestedByUserId: downloadTest?.testedByUserId ?? null,
    downloadTestedByName: downloadTest?.testedByUserId
      ? userNames.get(downloadTest.testedByUserId) ?? null
      : null,
    downloadTestFileId: downloadTest?.fileId ?? null,
  };
}

/** Pure: assemble the final admin DTO from run + records + resolved policy fields. */
function buildAdminRunDto(input: {
  run: ServiceValidationRun;
  records: AdminRunRecords;
  evidenceIntegrity: "VALID" | "INVALID";
  validity: "CURRENT" | "STALE";
  invalidationReason: string | null;
  userNames: Map<string, string>;
  versionLabelById?: Map<string, string>;
}): AdminServiceValidationRunDto {
  const { run, records, evidenceIntegrity, validity, invalidationReason } = input;
  const { confirmation, results } = records;
  const details = asRecord(run.details);
  return {
    runId: run.id,
    packId: run.packId,
    versionId: run.versionId,
    versionLabel: input.versionLabelById?.get(run.versionId) ?? null,
    channel: run.channel,
    historicalStatus: run.status,
    evidenceIntegrity,
    systemStatus: run.status === "PASS" && validity === "STALE" ? "STALE" : run.status,
    currentValidity: validity,
    invalidatedAt: run.invalidatedAt?.toISOString() ?? null,
    invalidationReason,
    providerConfirmationStatus: resolveConfirmationStatusDto({
      confirmationStatus: confirmation?.status,
      runValidity: validity,
    }),
    providerConfirmationId: confirmation?.id ?? null,
    resultFingerprint: run.resultFingerprint,
    adapterPath: adapterPathForChannel(run.channel as ServiceChannel),
    pipelineRunId: run.pipelineRunId,
    indexGenerationId: run.indexGenerationId,
    normalizedDocumentId: run.normalizedDocumentId,
    fingerprint: run.fingerprint,
    toolName: typeof details?.toolName === "string" ? details.toolName : null,
    mcpProtocolVersion:
      typeof details?.mcpProtocolVersion === "string" ? details.mcpProtocolVersion : null,
    requestId: typeof details?.requestId === "string" ? details.requestId : null,
    resultCount: run.resultCount,
    latencyMs: run.latencyMs,
    topChunkId: run.topChunkId,
    sourceDocumentId: run.sourceDocumentId,
    page: run.page,
    query: run.query,
    failureCode: run.failureCode,
    failureMessage: run.failureMessage,
    ...buildAdminRunAttributionFields(run, records, input.userNames),
    createdAt: run.createdAt.toISOString(),
    details,
    results: buildAdminRunResultDtos(results),
  };
}

export async function mapAdminRunDto(
  run: ServiceValidationRun,
  versionCurrentBinding: CurrentValidationBinding | null,
  runPipelineBinding: CurrentValidationBinding | null,
  userNames: Map<string, string>,
  versionLabelById?: Map<string, string>,
): Promise<AdminServiceValidationRunDto> {
  const records = await loadAdminRunRecords(run.id);
  const evidenceIntegrity = evidenceIntegrityForRun(run, runPipelineBinding);

  const isSearchChannel = run.channel === "API" || run.channel === "MCP";
  const peerFingerprints =
    records.confirmation?.sharedConfirmationGroupId && isSearchChannel
      ? await loadSharedConfirmationPeerFingerprints(prisma, records.confirmation.sharedConfirmationGroupId)
      : null;
  const sharedStaleOverride = resolveAdminRunSharedConfirmationStaleOverride({
    channel: run.channel,
    sharedConfirmationGroupId: records.confirmation?.sharedConfirmationGroupId,
    apiResultFingerprint: peerFingerprints?.apiResultFingerprint,
    mcpResultFingerprint: peerFingerprints?.mcpResultFingerprint,
  });

  const { validity, invalidationReason } = resolveAdminRunValidityAndReason({
    run,
    versionCurrentBinding,
    runPipelineBinding,
    records,
    evidenceIntegrity,
    sharedStaleOverride,
  });

  return buildAdminRunDto({
    run,
    records,
    evidenceIntegrity,
    validity,
    invalidationReason,
    userNames,
    versionLabelById,
  });
}
