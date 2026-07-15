import {
  ServiceValidationChannel,
  ServiceValidationStatus,
  type PackDistributionMetadata,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  selectedServiceChannels,
  type ServiceChannel,
} from "@/lib/distribution/service-channel-policy";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import { runRetrievalForEvaluation } from "@/lib/retrieval-service";

export type ServiceValidationChannelDto = {
  channel: ServiceChannel;
  selected: boolean;
  status: ServiceValidationStatus | "NOT_SELECTED";
  testedAt: string | null;
  query: string | null;
  resultCount: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  latencyMs: number | null;
  topChunkId: string | null;
  sourceDocumentId: string | null;
  page: number | null;
  pipelineRunId: string | null;
  indexGenerationId: string | null;
  fingerprint: string | null;
  details: Record<string, unknown> | null;
};

export type ServiceValidationStatusDto = {
  packId: string;
  versionId: string;
  channels: ServiceValidationChannelDto[];
  allSelectedPassed: boolean;
  suggestedQuery: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function requireOwnedDraft(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    throw new PayloadServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
    },
  });
  if (!pack) throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  const version = pack.versions[0];
  if (!version) throw new PayloadServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  return { pack, version, profile };
}

async function loadBindingContext(packId: string, versionId: string) {
  const dist = await prisma.packDistributionMetadata.findUnique({ where: { versionId } });
  const latest = await prisma.pipelineRun.findFirst({
    where: { packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER, status: "PASS" },
    orderBy: { startedAt: "desc" },
  });
  const binding = parseKnowledgeRunBinding(latest?.summary);
  return { dist, latest, binding };
}

export async function getServiceValidationStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<ServiceValidationStatusDto> {
  const { pack, version } = await requireOwnedDraft(input);
  const { dist, binding } = await loadBindingContext(pack.packId, version.id);
  if (!dist) {
    throw new PayloadServiceError(
      "INCOMPLETE",
      "유통정보를 먼저 저장한 뒤 서비스 검증을 진행해 주세요.",
      400,
    );
  }

  const selected = new Set(
    selectedServiceChannels({
      allowApi: dist.allowApi,
      allowMcp: dist.allowMcp,
      allowDownload: dist.allowDownload,
    }),
  );

  const runs = await prisma.serviceValidationRun.findMany({
    where: { versionId: version.id },
  });
  const byChannel = new Map(runs.map((r) => [r.channel, r]));

  // Mark STALE when fingerprint / generation drifted vs PASS binding.
  for (const run of runs) {
    if (run.status !== "PASS") continue;
    if (
      binding &&
      (run.fingerprint !== binding.fingerprint ||
        run.indexGenerationId !== binding.indexGenerationId)
    ) {
      await prisma.serviceValidationRun.update({
        where: { id: run.id },
        data: { status: "STALE" },
      });
      run.status = "STALE";
    }
  }

  const channels: ServiceValidationChannelDto[] = (["API", "MCP", "DOWNLOAD"] as const).map(
    (channel) => {
      const selectedChannel = selected.has(channel);
      const run = byChannel.get(channel);
      if (!selectedChannel) {
        return {
          channel,
          selected: false,
          status: "NOT_SELECTED",
          testedAt: null,
          query: null,
          resultCount: null,
          failureCode: null,
          failureMessage: null,
          latencyMs: null,
          topChunkId: null,
          sourceDocumentId: null,
          page: null,
          pipelineRunId: null,
          indexGenerationId: null,
          fingerprint: null,
          details: null,
        };
      }
      return {
        channel,
        selected: true,
        status: run?.status ?? "PENDING",
        testedAt: run?.testedAt?.toISOString() ?? null,
        query: run?.query ?? null,
        resultCount: run?.resultCount ?? null,
        failureCode: run?.failureCode ?? null,
        failureMessage: run?.failureMessage ?? null,
        latencyMs: run?.latencyMs ?? null,
        topChunkId: run?.topChunkId ?? null,
        sourceDocumentId: run?.sourceDocumentId ?? null,
        page: run?.page ?? null,
        pipelineRunId: run?.pipelineRunId ?? null,
        indexGenerationId: run?.indexGenerationId ?? null,
        fingerprint: run?.fingerprint ?? null,
        details: asRecord(run?.details),
      };
    },
  );

  const selectedChannels = channels.filter((c) => c.selected);
  const allSelectedPassed =
    selectedChannels.length > 0 && selectedChannels.every((c) => c.status === "PASS");

  const sampleChunk = binding?.indexGenerationId
    ? await prisma.knowledgeChunk.findFirst({
        where: {
          versionId: version.id,
          chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
          metadata: { path: ["indexGenerationId"], equals: binding.indexGenerationId },
        },
        orderBy: { sortOrder: "asc" },
        select: { title: true },
      })
    : null;

  return {
    packId: pack.packId,
    versionId: version.id,
    channels,
    allSelectedPassed,
    suggestedQuery: sampleChunk?.title?.trim() || "주요 기능을 알려주세요",
  };
}

export async function runServiceChannelValidation(input: {
  userId: string;
  clientId: string;
  packId: string;
  channel: ServiceChannel;
  query?: string | null;
}): Promise<ServiceValidationChannelDto> {
  const { pack, version } = await requireOwnedDraft(input);
  const { dist, latest, binding } = await loadBindingContext(pack.packId, version.id);
  if (!dist) {
    throw new PayloadServiceError("INCOMPLETE", "유통정보를 먼저 저장해 주세요.", 400);
  }
  const selected = selectedServiceChannels(dist);
  if (!selected.includes(input.channel)) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_DISABLED",
      "유통정보에서 선택하지 않은 제공 방식입니다.",
      400,
    );
  }
  if (!binding || !latest) {
    throw new PayloadServiceError(
      "INCOMPLETE",
      "지식 데이터 생성이 완료되어야 서비스 검증을 진행할 수 있습니다.",
      400,
    );
  }

  const started = Date.now();
  let status: ServiceValidationStatus = "FAIL";
  let failureCode: string | null = null;
  let failureMessage: string | null = null;
  let resultCount: number | null = null;
  let topChunkId: string | null = null;
  let sourceDocumentId: string | null = null;
  let page: number | null = null;
  let query = input.query?.trim() || null;
  let details: Record<string, unknown> = {};

  if (input.channel === "API" || input.channel === "MCP") {
    query = query || "주요 기능을 알려주세요";
    try {
      const chunks = await prisma.knowledgeChunk.findMany({
        where: {
          versionId: version.id,
          chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
          metadata: { path: ["indexGenerationId"], equals: binding.indexGenerationId },
        },
        take: 50,
        orderBy: { sortOrder: "asc" },
      });
      if (chunks.length === 0) {
        failureCode =
          input.channel === "MCP" ? "MCP_VALIDATION_FAILED" : "API_VALIDATION_FAILED";
        failureMessage = "현재 Draft 검색 데이터가 없습니다.";
      } else {
        const hits = await runRetrievalForEvaluation({
          knowledgePackId: pack.packId,
          versionId: version.id,
          query,
          topK: 5,
          retrievalMode: "hybrid",
          indexGenerationId: binding.indexGenerationId,
        });
        resultCount = hits.length;
        const top = hits[0];
        topChunkId = top?.chunkId ?? null;
        sourceDocumentId = top?.sourceDocumentId ?? null;
        const meta = asRecord(top?.metadata);
        page =
          typeof meta?.page === "number"
            ? meta.page
            : typeof meta?.pageStart === "number"
              ? meta.pageStart
              : null;

        const foreign = hits.some((h) => {
          const m = asRecord(h.metadata);
          return typeof m?.versionId === "string" && m.versionId !== version.id;
        });
        const missingProv = hits.some((h) => !h.sourceDocumentId);
        const missingPage = hits.some((h) => {
          const m = asRecord(h.metadata);
          return m?.page == null && m?.pageStart == null;
        });

        details = {
          hitCount: hits.length,
          foreignVersion: foreign,
          missingProvenance: missingProv,
          missingPage,
          channelPath: input.channel === "MCP" ? "mcp-internal-invoke" : "retrieval-api",
        };

        if (hits.length === 0) {
          failureCode =
            input.channel === "MCP" ? "MCP_VALIDATION_FAILED" : "API_VALIDATION_FAILED";
          failureMessage = "검색 결과가 없습니다.";
        } else if (foreign) {
          failureCode =
            input.channel === "MCP" ? "MCP_VALIDATION_FAILED" : "API_VALIDATION_FAILED";
          failureMessage = "다른 Version 결과가 포함되었습니다.";
        } else if (missingProv || missingPage) {
          failureCode =
            input.channel === "MCP" ? "MCP_VALIDATION_FAILED" : "API_VALIDATION_FAILED";
          failureMessage = "출처 또는 페이지 정보가 부족합니다.";
        } else {
          status = "PASS";
        }
      }
    } catch (error) {
      failureCode =
        input.channel === "MCP" ? "MCP_VALIDATION_FAILED" : "API_VALIDATION_FAILED";
      failureMessage = error instanceof Error ? error.message : "검증 실행에 실패했습니다.";
    }
  } else {
    // DOWNLOAD
    const file = await prisma.knowledgePackFile.findFirst({
      where: {
        versionId: version.id,
        role: "SOURCE_ORIGINAL",
        bundle: {
          isActive: true,
          deletedAt: null,
          status: "REVIEW_READY",
          storageStatus: "ACTIVE",
        },
      },
      include: { bundle: { select: { storageStatus: true, status: true, isActive: true } } },
    });
    if (!file) {
      failureCode = "DOWNLOAD_VALIDATION_FAILED";
      failureMessage = "원본문서(SOURCE_ORIGINAL)를 찾을 수 없습니다.";
    } else if (!file.checksumSha256?.trim() || file.fileSize <= 0) {
      failureCode = "DOWNLOAD_VALIDATION_FAILED";
      failureMessage = "원본문서 무결성 정보가 없습니다.";
    } else if (file.bundle.storageStatus !== "ACTIVE") {
      failureCode = "DOWNLOAD_VALIDATION_FAILED";
      failureMessage = "원본문서 저장소 상태가 활성이 아닙니다.";
    } else {
      status = "PASS";
      details = {
        fileId: file.id,
        fileName: file.originalFileName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        checksumSha256: file.checksumSha256,
        storageStatus: file.bundle.storageStatus,
      };
      resultCount = 1;
    }
  }

  const latencyMs = Date.now() - started;
  const row = await prisma.serviceValidationRun.upsert({
    where: {
      versionId_channel: {
        versionId: version.id,
        channel: input.channel as ServiceValidationChannel,
      },
    },
    create: {
      packId: pack.packId,
      versionId: version.id,
      channel: input.channel as ServiceValidationChannel,
      status,
      pipelineRunId: latest.id,
      indexGenerationId: binding.indexGenerationId,
      normalizedDocumentId: binding.normalizedDocumentId,
      fingerprint: binding.fingerprint,
      testedAt: new Date(),
      testedByUserId: input.userId,
      query,
      resultCount,
      topChunkId,
      sourceDocumentId,
      page,
      latencyMs,
      failureCode,
      failureMessage,
      details,
    },
    update: {
      status,
      pipelineRunId: latest.id,
      indexGenerationId: binding.indexGenerationId,
      normalizedDocumentId: binding.normalizedDocumentId,
      fingerprint: binding.fingerprint,
      testedAt: new Date(),
      testedByUserId: input.userId,
      query,
      resultCount,
      topChunkId,
      sourceDocumentId,
      page,
      latencyMs,
      failureCode,
      failureMessage,
      details,
    },
  });

  return {
    channel: input.channel,
    selected: true,
    status: row.status,
    testedAt: row.testedAt?.toISOString() ?? null,
    query: row.query,
    resultCount: row.resultCount,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    latencyMs: row.latencyMs,
    topChunkId: row.topChunkId,
    sourceDocumentId: row.sourceDocumentId,
    page: row.page,
    pipelineRunId: row.pipelineRunId,
    indexGenerationId: row.indexGenerationId,
    fingerprint: row.fingerprint,
    details: asRecord(row.details),
  };
}

export async function assertSelectedServiceValidationsPassed(input: {
  versionId: string;
  distribution: Pick<PackDistributionMetadata, "allowApi" | "allowMcp" | "allowDownload">;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<void> {
  const selected = selectedServiceChannels(input.distribution);
  if (selected.length === 0) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_REQUIRED",
      "제공 방식을 한 개 이상 선택해 주세요.",
      400,
    );
  }
  const runs = await prisma.serviceValidationRun.findMany({
    where: { versionId: input.versionId, channel: { in: selected } },
  });
  const byChannel = new Map(runs.map((r) => [r.channel, r]));
  for (const channel of selected) {
    const run = byChannel.get(channel);
    if (!run || run.status !== "PASS") {
      throw new PayloadServiceError(
        run?.status === "STALE" ? "SERVICE_VALIDATION_STALE" : "SERVICE_VALIDATION_REQUIRED",
        run?.status === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
          : `선택한 ${channel} 제공 방식의 검증이 필요합니다.`,
        400,
      );
    }
    if (
      input.bindingFingerprint &&
      run.fingerprint &&
      run.fingerprint !== input.bindingFingerprint
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "지식 데이터가 변경되어 서비스 검증을 다시 진행해야 합니다.",
        400,
      );
    }
    if (
      input.bindingIndexGenerationId &&
      run.indexGenerationId &&
      run.indexGenerationId !== input.bindingIndexGenerationId
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "검색 인덱스가 변경되어 서비스 검증을 다시 진행해야 합니다.",
        400,
      );
    }
  }
}

export function isDistributionReadyForServiceValidation(dist: {
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  rightsBasis?: string | null;
  rightsConfirmedAt?: Date | string | null;
  allowApi?: boolean;
  allowMcp?: boolean;
  allowDownload?: boolean;
}): boolean {
  const hasSource = Boolean(dist.sourceTitle?.trim() || dist.sourceUrl?.trim());
  const hasRights = Boolean(dist.rightsBasis && dist.rightsConfirmedAt);
  const hasChannel =
    selectedServiceChannels({
      allowApi: Boolean(dist.allowApi),
      allowMcp: Boolean(dist.allowMcp),
      allowDownload: Boolean(dist.allowDownload),
    }).length > 0;
  return hasSource && hasRights && hasChannel;
}
