/**
 * Admin-only service validation ops log: listing, filtering, and run detail DTOs.
 */
import {
  type ServiceValidationChannel,
  type ServiceValidationRun,
  type ServiceValidationStatus,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import {
  evidenceIntegrityForRun,
  resolveCurrentValidationBindingTx,
  resolvePipelineRunBindingTx,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import { isLegacySharedConfirmationMissingFingerprint } from "@/lib/distribution/service-validation-share";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  adapterPathForChannel,
  asRecord,
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
} from "@/lib/distribution/service-validation-policy";
import { findLatestServiceValidationRun } from "@/lib/distribution/service-validation-queries";

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

async function mapAdminRunDto(
  run: ServiceValidationRun,
  versionCurrentBinding: CurrentValidationBinding | null,
  runPipelineBinding: CurrentValidationBinding | null,
  userNames: Map<string, string>,
  versionLabelById?: Map<string, string>,
): Promise<AdminServiceValidationRunDto> {
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: run.id },
  });
  const results = await prisma.serviceValidationResultItem.findMany({
    where: { runId: run.id },
    orderBy: { rank: "asc" },
  });
  const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
    where: { runId: run.id },
  });
  const evidenceIntegrity = evidenceIntegrityForRun(run, runPipelineBinding);
  let validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: versionCurrentBinding?.fingerprint,
    bindingIndexGenerationId: versionCurrentBinding?.indexGenerationId,
    resultItemCount: run.channel === "DOWNLOAD" ? null : results.length,
    expectedRankingPolicyVersion:
      run.channel === "API" || run.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
  let invalidationReason: string | null = null;
  if (confirmation?.sharedConfirmationGroupId && (run.channel === "API" || run.channel === "MCP")) {
    const peers = await prisma.serviceValidationProviderConfirmation.findMany({
      where: { sharedConfirmationGroupId: confirmation.sharedConfirmationGroupId },
      include: { run: { select: { channel: true, resultFingerprint: true } } },
    });
    const apiPeer = peers.find((p) => p.run.channel === "API")?.run;
    const mcpPeer = peers.find((p) => p.run.channel === "MCP")?.run;
    if (
      isLegacySharedConfirmationMissingFingerprint({
        sharedConfirmationGroupId: confirmation.sharedConfirmationGroupId,
        apiResultFingerprint: apiPeer?.resultFingerprint,
        mcpResultFingerprint: mcpPeer?.resultFingerprint,
      })
    ) {
      validity = "STALE";
      invalidationReason = "RESULT_FINGERPRINT_MISSING";
    }
  }
  const details = asRecord(run.details);
  if (!invalidationReason) {
    if (run.invalidatedAt) invalidationReason = "INVALIDATED_AT";
    else if (evidenceIntegrity === "INVALID" && run.status === "PASS") {
      invalidationReason = "PIPELINE_EVIDENCE_MISMATCH";
    } else if (
      validity === "STALE" &&
      (run.channel === "API" || run.channel === "MCP") &&
      results.length < 1
    ) {
      invalidationReason = "RESULT_SNAPSHOT_EMPTY";
    } else if (validity === "STALE") {
      invalidationReason = "BINDING_DRIFT";
    }
  }
  return {
    runId: run.id,
    packId: run.packId,
    versionId: run.versionId,
    versionLabel: versionLabelById?.get(run.versionId) ?? null,
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
    testedByUserId: run.testedByUserId,
    testedByName: run.testedByUserId
      ? userNames.get(run.testedByUserId) ?? null
      : null,
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
    createdAt: run.createdAt.toISOString(),
    details,
    results: results.map((r) => ({
      rank: r.rank,
      chunkId: r.chunkId,
      title: r.title,
      snippet: r.snippet,
      score: r.score,
      sourceDocumentId: r.sourceDocumentId,
      sourceDocumentTitle: r.sourceDocumentTitle,
      pageStart: r.pageStart,
      pageEnd: r.pageEnd,
    })),
  };
}

/** @deprecated Prefer listAdminServiceValidationHistory — returns latest-by-channel only. */
export async function getAdminServiceValidationForPack(input: {
  packId: string;
  versionId: string;
}): Promise<AdminServiceValidationRunDto[]> {
  const listed = await listAdminServiceValidationHistory({
    packId: input.packId,
    versionId: input.versionId,
    page: 1,
    pageSize: 3,
    latestOnly: true,
  });
  return listed.latestByChannel;
}


async function loadAdminBindingMaps(input: {
  packId: string;
  versionIds: string[];
  pipelineRunIds: Array<string | null | undefined>;
}): Promise<{
  versionCurrentById: Map<string, CurrentValidationBinding | null>;
  pipelineById: Map<string, CurrentValidationBinding | null>;
}> {
  const versionCurrentById = new Map<string, CurrentValidationBinding | null>();
  for (const versionId of [...new Set(input.versionIds.filter(Boolean))]) {
    try {
      versionCurrentById.set(
        versionId,
        await resolveCurrentValidationBindingTx(prisma, {
          packId: input.packId,
          versionId,
        }),
      );
    } catch {
      versionCurrentById.set(versionId, null);
    }
  }
  const pipelineById = new Map<string, CurrentValidationBinding | null>();
  const ids = [...new Set(input.pipelineRunIds.filter((id): id is string => Boolean(id?.trim())))];
  for (const id of ids) {
    pipelineById.set(id, await resolvePipelineRunBindingTx(prisma, id));
  }
  return { versionCurrentById, pipelineById };
}

function parseAdminHistoryDateBound(raw: string, endOfDay: boolean): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00.000`);
    if (endOfDay) d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(trimmed);
}

export async function listAdminServiceValidationHistory(input: {
  packId: string;
  versionId?: string | null;
  versionScope?: "ALL" | "LATEST" | null;
  page?: number;
  pageSize?: number;
  channel?: ServiceChannel | null;
  systemStatus?: string | null;
  providerConfirmationStatus?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  latestOnly?: boolean;
}): Promise<AdminServiceValidationListResult> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy } },
  });
  if (!pack) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.versions.length < 1) {
    throw new PayloadServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }

  const latestVersion = pack.versions[0]!;
  const versionLabelById = new Map(pack.versions.map((v) => [v.id, v.version]));
  const versionsDto = pack.versions.map((v) => ({
    id: v.id,
    label: v.version,
    isLatest: v.id === latestVersion.id,
  }));

  const explicitVersionId = input.versionId?.trim() || null;
  const scopeRaw = (input.versionScope ?? "").toUpperCase();
  let versionScope: "ALL" | "LATEST" | "VERSION" = "ALL";
  let filterVersionId: string | null = null;

  if (explicitVersionId) {
    const owned = pack.versions.find((v) => v.id === explicitVersionId);
    if (!owned) {
      throw new PayloadServiceError(
        "NOT_FOUND",
        "선택한 버전이 이 지식팩에 속하지 않습니다.",
        404,
      );
    }
    versionScope = "VERSION";
    filterVersionId = owned.id;
  } else if (scopeRaw === "LATEST") {
    versionScope = "LATEST";
    filterVersionId = latestVersion.id;
  } else {
    versionScope = "ALL";
    filterVersionId = null;
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));

  type AdminWhere = {
    packId: string;
    versionId?: string;
    channel?: ServiceValidationChannel;
    status?: ServiceValidationStatus;
    createdAt?: { gte?: Date; lte?: Date };
  };

  const baseWhere: AdminWhere = { packId: input.packId };
  if (filterVersionId) baseWhere.versionId = filterVersionId;
  if (input.channel) baseWhere.channel = input.channel as ServiceValidationChannel;
  if (input.dateFrom || input.dateTo) {
    baseWhere.createdAt = {};
    if (input.dateFrom) baseWhere.createdAt.gte = parseAdminHistoryDateBound(input.dateFrom, false);
    if (input.dateTo) baseWhere.createdAt.lte = parseAdminHistoryDateBound(input.dateTo, true);
  }

  const confFilter = input.providerConfirmationStatus?.trim().toUpperCase() || null;
  const systemFilter = input.systemStatus?.trim().toUpperCase() || null;
  const needsComputedFilter =
    systemFilter === "STALE" ||
    systemFilter === "PASS" ||
    confFilter === "STALE" ||
    confFilter === "CONFIRMED" ||
    confFilter === "REJECTED" ||
    confFilter === "NOT_REVIEWED";

  async function latestRunsInScope(): Promise<ServiceValidationRun[]> {
    const out: ServiceValidationRun[] = [];
    for (const channel of ["API", "MCP", "DOWNLOAD"] as const) {
      const latest = filterVersionId
        ? await findLatestServiceValidationRun({ versionId: filterVersionId, channel })
        : await prisma.serviceValidationRun.findFirst({
            where: { packId: input.packId, channel: channel as ServiceValidationChannel },
            orderBy: { createdAt: "desc" },
          });
      if (latest) out.push(latest);
    }
    return out;
  }

  const latestRuns = await latestRunsInScope();
  const scopeVersionIds = filterVersionId
    ? [filterVersionId]
    : pack.versions.map((v) => v.id);
  let { versionCurrentById, pipelineById } = await loadAdminBindingMaps({
    packId: input.packId,
    versionIds: [
      ...scopeVersionIds,
      ...latestRuns.map((r) => r.versionId),
    ],
    pipelineRunIds: latestRuns.map((r) => r.pipelineRunId),
  });
  const latestByChannel = await Promise.all(
    latestRuns.map((r) =>
      mapAdminRunDto(
        r,
        versionCurrentById.get(r.versionId) ?? null,
        r.pipelineRunId ? pipelineById.get(r.pipelineRunId) ?? null : null,
        new Map(),
        versionLabelById,
      ),
    ),
  );

  if (input.latestOnly) {
    return {
      latestByChannel,
      history: latestByChannel,
      versions: versionsDto,
      versionScope,
      selectedVersionId: filterVersionId,
      pagination: {
        page: 1,
        pageSize: latestByChannel.length,
        totalCount: latestByChannel.length,
        totalPages: 1,
      },
    };
  }

  let runs: ServiceValidationRun[] = [];
  let totalCount = 0;

  if (needsComputedFilter) {
    const whereForCandidates: AdminWhere = { ...baseWhere };
    if (systemFilter === "FAIL") {
      whereForCandidates.status = "FAIL";
    } else if (systemFilter === "PASS" || systemFilter === "STALE") {
      whereForCandidates.status = "PASS";
    }

    const candidates = await prisma.serviceValidationRun.findMany({
      where: whereForCandidates,
      orderBy: { createdAt: "desc" },
      include: {
        confirmation: true,
        downloadTest: true,
        _count: { select: { resultItems: true } },
      },
    });

    const sharedGroupIds = [
      ...new Set(
        candidates
          .map((c) => c.confirmation?.sharedConfirmationGroupId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const sharedPeers =
      sharedGroupIds.length > 0
        ? await prisma.serviceValidationProviderConfirmation.findMany({
            where: { sharedConfirmationGroupId: { in: sharedGroupIds } },
            include: {
              run: { select: { channel: true, resultFingerprint: true } },
            },
          })
        : [];
    const peersByGroup = new Map<string, typeof sharedPeers>();
    for (const peer of sharedPeers) {
      const gid = peer.sharedConfirmationGroupId;
      if (!gid) continue;
      const list = peersByGroup.get(gid) ?? [];
      list.push(peer);
      peersByGroup.set(gid, list);
    }

    ({ versionCurrentById, pipelineById } = await loadAdminBindingMaps({
      packId: input.packId,
      versionIds: [
        ...scopeVersionIds,
        ...candidates.map((c) => c.versionId),
      ],
      pipelineRunIds: candidates.map((c) => c.pipelineRunId),
    }));

    const matched = candidates.filter((run) => {
      const versionBinding = versionCurrentById.get(run.versionId) ?? null;
      let validity = resolveRunCurrentValidity({
        run,
        bindingFingerprint: versionBinding?.fingerprint,
        bindingIndexGenerationId: versionBinding?.indexGenerationId,
        resultItemCount: run.channel === "DOWNLOAD" ? null : run._count.resultItems,
        expectedRankingPolicyVersion:
          run.channel === "API" || run.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
      });
      if (
        run.confirmation?.sharedConfirmationGroupId &&
        (run.channel === "API" || run.channel === "MCP")
      ) {
        const peers = peersByGroup.get(run.confirmation.sharedConfirmationGroupId) ?? [];
        const apiPeer = peers.find((p) => p.run.channel === "API")?.run;
        const mcpPeer = peers.find((p) => p.run.channel === "MCP")?.run;
        if (
          isLegacySharedConfirmationMissingFingerprint({
            sharedConfirmationGroupId: run.confirmation.sharedConfirmationGroupId,
            apiResultFingerprint: apiPeer?.resultFingerprint,
            mcpResultFingerprint: mcpPeer?.resultFingerprint,
          })
        ) {
          validity = "STALE";
        }
      }
      const systemStatus =
        run.status === "PASS" && validity === "STALE" ? "STALE" : run.status;
      const providerConfirmationStatus = resolveConfirmationStatusDto({
        confirmationStatus: run.confirmation?.status,
        runValidity: validity,
      });

      if (systemFilter === "STALE" && systemStatus !== "STALE") return false;
      if (systemFilter === "PASS" && !(run.status === "PASS" && validity === "CURRENT")) {
        return false;
      }
      if (systemFilter === "FAIL" && run.status !== "FAIL") return false;
      if (confFilter && providerConfirmationStatus !== confFilter) return false;
      return true;
    });

    totalCount = matched.length;
    runs = matched.slice((page - 1) * pageSize, page * pageSize);
  } else {
    const where: AdminWhere = { ...baseWhere };
    if (systemFilter === "FAIL") where.status = "FAIL";

    totalCount = await prisma.serviceValidationRun.count({ where });
    runs = await prisma.serviceValidationRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  const userIds = new Set<string>();
  for (const run of runs) {
    if (run.testedByUserId) userIds.add(run.testedByUserId);
  }
  const confirmations = await prisma.serviceValidationProviderConfirmation.findMany({
    where: { runId: { in: runs.map((r) => r.id) } },
    select: { runId: true, confirmedByUserId: true },
  });
  for (const c of confirmations) userIds.add(c.confirmedByUserId);
  const downloadTests = await prisma.serviceValidationDownloadTest.findMany({
    where: { runId: { in: runs.map((r) => r.id) } },
    select: { testedByUserId: true },
  });
  for (const d of downloadTests) userIds.add(d.testedByUserId);

  const users =
    userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userNames = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email?.trim() || "사용자"]),
  );

  ({ versionCurrentById, pipelineById } = await loadAdminBindingMaps({
    packId: input.packId,
    versionIds: [
      ...scopeVersionIds,
      ...runs.map((r) => r.versionId),
      ...latestRuns.map((r) => r.versionId),
    ],
    pipelineRunIds: [
      ...runs.map((r) => r.pipelineRunId),
      ...latestRuns.map((r) => r.pipelineRunId),
    ],
  }));

  const history = await Promise.all(
    runs.map((run) =>
      mapAdminRunDto(
        run,
        versionCurrentById.get(run.versionId) ?? null,
        run.pipelineRunId ? pipelineById.get(run.pipelineRunId) ?? null : null,
        userNames,
        versionLabelById,
      ),
    ),
  );

  return {
    latestByChannel: await Promise.all(
      latestRuns.map((r) =>
        mapAdminRunDto(
          r,
          versionCurrentById.get(r.versionId) ?? null,
          r.pipelineRunId ? pipelineById.get(r.pipelineRunId) ?? null : null,
          userNames,
          versionLabelById,
        ),
      ),
    ),
    history,
    versions: versionsDto,
    versionScope,
    selectedVersionId: filterVersionId,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize) || 1),
    },
  };
}

export async function getAdminServiceValidationRun(
  runId: string,
): Promise<AdminServiceValidationRunDto | null> {
  const run = await prisma.serviceValidationRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  const versionRow = await prisma.knowledgePackVersion.findUnique({
    where: { id: run.versionId },
    select: { version: true },
  });
  const { versionCurrentById, pipelineById } = await loadAdminBindingMaps({
    packId: run.packId,
    versionIds: [run.versionId],
    pipelineRunIds: [run.pipelineRunId],
  });
  const userIds = [run.testedByUserId].filter(Boolean) as string[];
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: run.id },
  });
  if (confirmation?.confirmedByUserId) userIds.push(confirmation.confirmedByUserId);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userNames = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email?.trim() || "사용자"]),
  );
  return mapAdminRunDto(
    run,
    versionCurrentById.get(run.versionId) ?? null,
    run.pipelineRunId ? pipelineById.get(run.pipelineRunId) ?? null : null,
    userNames,
    new Map([[run.versionId, versionRow?.version ?? ""]]),
  );
}
