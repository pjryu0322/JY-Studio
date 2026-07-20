/**
 * Admin-only service validation ops log: listing and run detail queries.
 */
import {
  type ServiceValidationChannel,
  type ServiceValidationRun,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import {
  resolveCurrentValidationBindingTx,
  resolvePipelineRunBindingTx,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import {
  adminHistoryCandidateMatchesFilters,
  adminHistoryNeedsComputedFilter,
  adminHistoryPaginationMeta,
  buildAdminHistoryBaseWhere,
  normalizeAdminHistoryPagination,
  resolveAdminHistoryVersionScope,
  type AdminHistoryWhere,
} from "@/lib/distribution/service-validation-admin-listing-helpers";
import {
  type AdminServiceValidationListResult,
  type AdminServiceValidationRunDto,
  mapAdminRunDto,
} from "@/lib/distribution/service-validation-admin-listing-dto";
import { findLatestServiceValidationRun } from "@/lib/distribution/service-validation-queries";

export type {
  AdminServiceValidationListResult,
  AdminServiceValidationRunDto,
} from "@/lib/distribution/service-validation-admin-listing-dto";

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

  const { versionScope, filterVersionId } = resolveAdminHistoryVersionScope({
    versions: pack.versions,
    latestVersionId: latestVersion.id,
    versionId: input.versionId,
    versionScope: input.versionScope,
  });

  const { page, pageSize } = normalizeAdminHistoryPagination({
    page: input.page,
    pageSize: input.pageSize,
  });

  const baseWhere = buildAdminHistoryBaseWhere({
    packId: input.packId,
    filterVersionId,
    channel: input.channel,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const { needsComputedFilter, systemFilter, confFilter } = adminHistoryNeedsComputedFilter({
    systemStatus: input.systemStatus,
    providerConfirmationStatus: input.providerConfirmationStatus,
  });

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
    const whereForCandidates: AdminHistoryWhere = { ...baseWhere };
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

    const matched = candidates.filter((run) =>
      adminHistoryCandidateMatchesFilters({
        run,
        versionBinding: versionCurrentById.get(run.versionId) ?? null,
        systemFilter,
        confFilter,
        peers: run.confirmation?.sharedConfirmationGroupId
          ? peersByGroup.get(run.confirmation.sharedConfirmationGroupId) ?? []
          : [],
      }),
    );

    totalCount = matched.length;
    runs = matched.slice((page - 1) * pageSize, page * pageSize);
  } else {
    const where: AdminHistoryWhere = { ...baseWhere };
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
    pagination: adminHistoryPaginationMeta({ page, pageSize, totalCount }),
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
