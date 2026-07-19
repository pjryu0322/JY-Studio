import { Prisma, type PackStatus } from "@prisma/client";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  isSearchFoundationStagesPassedStrict,
  isStructureStagesPassed,
  type PipelineStepLike,
} from "@/lib/docling-knowledge/docling-knowledge-stage-pass";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  isDoclingSourceMaterialsReady,
  type DoclingBundleMaterialContext,
} from "@/lib/docling-import/docling-source-materials-readiness";
import {
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
} from "@/lib/distribution/service-validation-service";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { prisma } from "@/lib/prisma";
import type { PackLanguageCode } from "@/lib/pack-language";
import {
  isDistributionReadyForProgress,
  type BuildProviderPackProgressInput,
} from "@/lib/provider-pack-progress";
import {
  resolveProviderRegistrationReadiness,
  type ProviderRegistrationReadiness,
} from "@/lib/provider-registration-readiness";

export type PackRegistrationPackInput = {
  packId: string;
  packStatus: PackStatus;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  language: PackLanguageCode | null;
  latestRejectionReason?: string | null;
  workingVersion: {
    id: string;
    version: string;
    sourceDocumentCount: number;
  } | null;
  publishedVersion: { id: string; version: string } | null;
};

export type PackRegistrationSignals = {
  sourceMaterialsReady: boolean;
  structurePassed: boolean;
  searchFoundationPassed: boolean;
  allPreparationChannelsPassed: boolean;
  distributionMetadataReady: boolean;
  pipelineCurrent: boolean;
};

function basicInfoReady(input: PackRegistrationPackInput): boolean {
  return Boolean(
    input.name.trim() &&
      input.categoryId.trim() &&
      input.shortDescription.trim() &&
      input.description.trim() &&
      (input.language === "ko" || input.language === "en"),
  );
}

export function pipelineSignalsFromRun(input: {
  versionId: string;
  bundle: DoclingBundleMaterialContext | null;
  steps: PipelineStepLike[];
  bindingMatches: boolean;
}): Pick<PackRegistrationSignals, "structurePassed" | "searchFoundationPassed" | "pipelineCurrent"> {
  const pipelineCurrent = Boolean(input.bundle && input.bindingMatches);
  const passInput = {
    steps: input.steps,
    pipelineCurrent,
    expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
  };
  return {
    pipelineCurrent,
    structurePassed: isStructureStagesPassed(passInput),
    searchFoundationPassed: isSearchFoundationStagesPassedStrict(passInput),
  };
}

export async function computePreparationChannelsPassed(input: {
  versionId: string;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<boolean> {
  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    const run = await prisma.serviceValidationRun.findFirst({
      where: { versionId: input.versionId, channel },
      orderBy: { createdAt: "desc" },
    });
    if (!run) return false;
    const resultItemCount =
      channel === "API" || channel === "MCP"
        ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
        : null;
    const validity = resolveRunCurrentValidity({
      run,
      bindingFingerprint: input.bindingFingerprint,
      bindingIndexGenerationId: input.bindingIndexGenerationId,
      resultItemCount,
      expectedRankingPolicyVersion:
        channel === "API" || channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
    });
    if (run.status !== "PASS" || validity !== "CURRENT") return false;
    if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
      return false;
    }
    if (channel === "DOWNLOAD") {
      const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (!downloadTest?.responseReady) return false;
    }
    const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { runId: run.id },
    });
    const confStatus = resolveConfirmationStatusDto({
      confirmationStatus: confirmation?.status,
      runValidity: validity,
    });
    if (confStatus !== "CONFIRMED") return false;
  }
  return true;
}

export async function resolvePackRegistrationSignals(input: {
  packId: string;
  versionId: string;
  distribution: Parameters<typeof isDistributionReadyForProgress>[0] | null;
}): Promise<PackRegistrationSignals> {
  const bundleRow = await prisma.doclingImportBundle.findFirst({
    where: { versionId: input.versionId, isActive: true, deletedAt: null },
    include: {
      files: { select: { id: true, role: true, checksumSha256: true } },
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });

  const bundleCtx: DoclingBundleMaterialContext | null = bundleRow
    ? {
        id: bundleRow.id,
        status: bundleRow.status,
        isActive: bundleRow.isActive,
        deletedAt: bundleRow.deletedAt,
        storageStatus: bundleRow.storageStatus,
        packId: bundleRow.packId,
        versionId: bundleRow.versionId,
        files: bundleRow.files,
        normalizedDocument: bundleRow.normalizedDocuments[0]
          ? {
              id: bundleRow.normalizedDocuments[0].id,
              packId: bundleRow.normalizedDocuments[0].packId,
              versionId: bundleRow.normalizedDocuments[0].versionId,
              bundleId: bundleRow.normalizedDocuments[0].bundleId,
              isActive: bundleRow.normalizedDocuments[0].isActive,
              sourceFileId: bundleRow.normalizedDocuments[0].sourceFileId,
              jsonPayloadFileId: bundleRow.normalizedDocuments[0].jsonPayloadFileId,
              fingerprint: bundleRow.normalizedDocuments[0].fingerprint,
            }
          : null,
      }
    : null;

  const sourceMaterialsReady = isDoclingSourceMaterialsReady(bundleCtx);

  const latestRun = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });

  const binding = parseKnowledgeRunBinding(latestRun?.summary);
  const nd = bundleCtx?.normalizedDocument;
  const bindingMatches = Boolean(
    binding &&
      nd &&
      bundleCtx &&
      binding.versionId === input.versionId &&
      binding.normalizedDocumentId === nd.id &&
      binding.fingerprint === nd.fingerprint &&
      binding.bundleId === bundleCtx.id,
  );

  const steps: PipelineStepLike[] =
    latestRun?.steps.map((s) => ({
      step: s.step,
      status: s.status,
      details:
        s.details && typeof s.details === "object" && !Array.isArray(s.details)
          ? (s.details as Record<string, unknown>)
          : null,
    })) ?? [];

  const pipeline = pipelineSignalsFromRun({
    versionId: input.versionId,
    bundle: bundleCtx,
    steps,
    bindingMatches,
  });

  const allPreparationChannelsPassed = await computePreparationChannelsPassed({
    versionId: input.versionId,
    bindingFingerprint: nd?.fingerprint ?? null,
    bindingIndexGenerationId: binding?.indexGenerationId ?? null,
  });

  const distributionMetadataReady = Boolean(
    input.distribution && isDistributionReadyForProgress(input.distribution),
  );

  return {
    sourceMaterialsReady,
    ...pipeline,
    allPreparationChannelsPassed,
    distributionMetadataReady,
  };
}

export async function resolveProviderRegistrationReadinessFromDb(input: {
  pack: PackRegistrationPackInput;
  signals?: PackRegistrationSignals;
  distribution?: Parameters<typeof isDistributionReadyForProgress>[0] | null;
}): Promise<ProviderRegistrationReadiness> {
  const version = input.pack.workingVersion;
  let signals = input.signals;
  if (!signals && version) {
    signals = await resolvePackRegistrationSignals({
      packId: input.pack.packId,
      versionId: version.id,
      distribution: input.distribution ?? null,
    });
  }
  if (!signals) {
    signals = {
      sourceMaterialsReady: false,
      structurePassed: false,
      searchFoundationPassed: false,
      allPreparationChannelsPassed: false,
      distributionMetadataReady: false,
      pipelineCurrent: false,
    };
  }

  return resolveProviderRegistrationReadiness({
    packId: input.pack.packId,
    packStatus: input.pack.packStatus,
    basicInfoReady: basicInfoReady(input.pack),
    sourceMaterialsReady: signals.sourceMaterialsReady,
    structurePassed: signals.structurePassed,
    searchFoundationPassed: signals.searchFoundationPassed,
    allPreparationChannelsPassed: signals.allPreparationChannelsPassed,
    distributionMetadataReady: signals.distributionMetadataReady,
    pipelineCurrent: signals.pipelineCurrent,
    structureStale: signals.sourceMaterialsReady && !signals.pipelineCurrent,
    searchValidationStale: signals.structurePassed && !signals.pipelineCurrent,
    latestRejectionReason: input.pack.latestRejectionReason,
  });
}

export type ListPackForBatch = {
  packId: string;
  packStatus: PackStatus;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  language: PackLanguageCode | null;
  latestRejectionReason?: string | null;
  workingVersion: {
    id: string;
    version: string;
    sourceDocumentCount: number;
    distribution: Parameters<typeof isDistributionReadyForProgress>[0];
  } | null;
  publishedVersion: { id: string; version: string } | null;
};

/** Batch list progress inputs without per-pack N+1 pipeline queries. */
export async function batchResolveListRegistrationProgressInputs(input: {
  packs: ListPackForBatch[];
}): Promise<Map<string, NonNullable<BuildProviderPackProgressInput["workingVersion"]>>> {
  const versionIds = input.packs
    .map((p) => p.workingVersion?.id)
    .filter((id): id is string => Boolean(id));

  const bundles = versionIds.length
    ? await prisma.doclingImportBundle.findMany({
        where: { versionId: { in: versionIds }, isActive: true, deletedAt: null },
        include: {
          files: { select: { id: true, role: true, checksumSha256: true } },
          normalizedDocuments: { where: { isActive: true }, take: 1 },
        },
      })
    : [];
  const bundleByVersion = new Map(bundles.map((b) => [b.versionId, b]));

  // §12 Latest-only fetch via DISTINCT ON — avoids loading full run history into memory.
  const packIds = [...new Set(input.packs.map((p) => p.packId))];
  const latestPipelineRunIdRows =
    packIds.length > 0
      ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT DISTINCT ON ("packId") "id"
          FROM "PipelineRun"
          WHERE "packId" IN (${Prisma.join(packIds)})
            AND "triggerType" = ${DOCLING_KNOWLEDGE_PIPELINE_TRIGGER}
          ORDER BY "packId", "startedAt" DESC
        `)
      : [];
  const latestPipelineRunIds = latestPipelineRunIdRows.map((r) => r.id);
  const runs = latestPipelineRunIds.length
    ? await prisma.pipelineRun.findMany({
        where: { id: { in: latestPipelineRunIds } },
        include: { steps: { orderBy: { createdAt: "asc" } } },
      })
    : [];
  const runsByPack = new Map<string, typeof runs>();
  for (const run of runs) {
    const list = runsByPack.get(run.packId) ?? [];
    list.push(run);
    runsByPack.set(run.packId, list);
  }

  const preparationChannels = [...SEARCH_VALIDATION_PREPARATION_CHANNELS];
  const latestValidationRunIdRows =
    versionIds.length > 0
      ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT DISTINCT ON ("versionId", "channel") "id"
          FROM "ServiceValidationRun"
          WHERE "versionId" IN (${Prisma.join(versionIds)})
            AND "channel"::text IN (${Prisma.join(preparationChannels)})
          ORDER BY "versionId", "channel", "createdAt" DESC
        `)
      : [];
  const latestValidationRunIds = latestValidationRunIdRows.map((r) => r.id);
  const validationRuns = latestValidationRunIds.length
    ? await prisma.serviceValidationRun.findMany({
        where: { id: { in: latestValidationRunIds } },
      })
    : [];
  const latestRunByVersionChannel = new Map<string, (typeof validationRuns)[number]>();
  for (const run of validationRuns) {
    latestRunByVersionChannel.set(`${run.versionId}:${run.channel}`, run);
  }

  const runIds = [...new Set(validationRuns.map((r) => r.id))];
  const confirmations =
    runIds.length > 0
      ? await prisma.serviceValidationProviderConfirmation.findMany({
          where: { runId: { in: runIds } },
        })
      : [];
  const confByRunId = new Map(confirmations.map((c) => [c.runId, c]));

  const downloadTests =
    runIds.length > 0
      ? await prisma.serviceValidationDownloadTest.findMany({
          where: { runId: { in: runIds } },
        })
      : [];
  const downloadByRunId = new Map(downloadTests.map((d) => [d.runId, d]));

  const resultCounts = new Map<string, number>();
  if (runIds.length > 0) {
    const grouped = await prisma.serviceValidationResultItem.groupBy({
      by: ["runId"],
      where: { runId: { in: runIds } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      resultCounts.set(row.runId, row._count._all);
    }
  }

  const out = new Map<string, NonNullable<BuildProviderPackProgressInput["workingVersion"]>>();

  for (const pack of input.packs) {
    const working = pack.workingVersion;
    if (!working) continue;

    const bundleRow = bundleByVersion.get(working.id);
    const bundleCtx: DoclingBundleMaterialContext | null = bundleRow
      ? {
          id: bundleRow.id,
          status: bundleRow.status,
          isActive: bundleRow.isActive,
          deletedAt: bundleRow.deletedAt,
          storageStatus: bundleRow.storageStatus,
          packId: bundleRow.packId,
          versionId: bundleRow.versionId,
          files: bundleRow.files,
          normalizedDocument: bundleRow.normalizedDocuments[0]
            ? {
                id: bundleRow.normalizedDocuments[0].id,
                packId: bundleRow.normalizedDocuments[0].packId,
                versionId: bundleRow.normalizedDocuments[0].versionId,
                bundleId: bundleRow.normalizedDocuments[0].bundleId,
                isActive: bundleRow.normalizedDocuments[0].isActive,
                sourceFileId: bundleRow.normalizedDocuments[0].sourceFileId,
                jsonPayloadFileId: bundleRow.normalizedDocuments[0].jsonPayloadFileId,
                fingerprint: bundleRow.normalizedDocuments[0].fingerprint,
              }
            : null,
        }
      : null;

    const sourceMaterialsReady = isDoclingSourceMaterialsReady(bundleCtx);
    const packRuns = runsByPack.get(pack.packId) ?? [];
    const latestRun = packRuns[0] ?? null;
    const binding = parseKnowledgeRunBinding(latestRun?.summary);
    const nd = bundleCtx?.normalizedDocument;
    const bindingMatches = Boolean(
      binding &&
        nd &&
        bundleCtx &&
        binding.versionId === working.id &&
        binding.normalizedDocumentId === nd.id &&
        binding.fingerprint === nd.fingerprint &&
        binding.bundleId === bundleCtx.id,
    );

    const steps: PipelineStepLike[] =
      latestRun?.steps.map((s) => ({
        step: s.step,
        status: s.status,
        details:
          s.details && typeof s.details === "object" && !Array.isArray(s.details)
            ? (s.details as Record<string, unknown>)
            : null,
      })) ?? [];

    const pipeline = pipelineSignalsFromRun({
      versionId: working.id,
      bundle: bundleCtx,
      steps,
      bindingMatches,
    });

    let allPreparationChannelsPassed = true;
    for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
      const run = latestRunByVersionChannel.get(`${working.id}:${channel}`);
      if (!run) {
        allPreparationChannelsPassed = false;
        break;
      }
      const resultItemCount =
        channel === "API" || channel === "MCP" ? (resultCounts.get(run.id) ?? 0) : null;
      const validity = resolveRunCurrentValidity({
        run,
        bindingFingerprint: nd?.fingerprint ?? null,
        bindingIndexGenerationId: binding?.indexGenerationId ?? null,
        resultItemCount,
        expectedRankingPolicyVersion:
          channel === "API" || channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
      });
      if (run.status !== "PASS" || validity !== "CURRENT") {
        allPreparationChannelsPassed = false;
        break;
      }
      if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
        allPreparationChannelsPassed = false;
        break;
      }
      if (channel === "DOWNLOAD") {
        const dt = downloadByRunId.get(run.id);
        if (!dt?.responseReady) {
          allPreparationChannelsPassed = false;
          break;
        }
      }
      const conf = confByRunId.get(run.id);
      const confStatus = resolveConfirmationStatusDto({
        confirmationStatus: conf?.status,
        runValidity: validity,
      });
      if (confStatus !== "CONFIRMED") {
        allPreparationChannelsPassed = false;
        break;
      }
    }

    const distributionReady = isDistributionReadyForProgress(working.distribution);

    out.set(pack.packId, {
      id: working.id,
      version: working.version,
      sourceDocumentCount: working.sourceDocumentCount,
      materialReady: sourceMaterialsReady,
      structureReady: pipeline.structurePassed,
      searchFoundationReady: pipeline.searchFoundationPassed,
      searchValidationReady: allPreparationChannelsPassed,
      distributionReady,
      pipelineCurrent: pipeline.pipelineCurrent,
    });
  }

  return out;
}
