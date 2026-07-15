import {
  PackStatus,
  ServiceValidationChannel,
  ServiceValidationStatus,
  type PackDistributionMetadata,
  type ServiceValidationRun,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  isServiceEnded,
  selectedServiceChannels,
  type ServiceChannel,
} from "@/lib/distribution/service-channel-policy";
import { validateDownloadObjectIntegrity } from "@/lib/distribution/download-object-validation";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { executeMcpValidation } from "@/lib/mcp/mcp-validation-runtime";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import {
  evaluateRetrievalValidationHits,
  executeRetrievalApiRequest,
} from "@/lib/retrieval/retrieval-api-adapter";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";

export type ServiceValidationChannelDto = {
  channel: ServiceChannel;
  selected: boolean;
  status: ServiceValidationStatus | "NOT_SELECTED";
  currentValidity: "CURRENT" | "STALE" | null;
  runId: string | null;
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
  adapterPath: string | null;
  details: Record<string, unknown> | null;
};

export type ServiceValidationStatusDto = {
  packId: string;
  versionId: string;
  packStatus: string;
  canRunValidation: boolean;
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

function adapterPathForChannel(channel: ServiceChannel): string {
  if (channel === "API") return "Retrieval API Adapter";
  if (channel === "MCP") return "MCP Tool Handler (jykstore_retrieval_query)";
  return "Object Storage Stream + SHA-256";
}

export function resolveRunCurrentValidity(input: {
  run: Pick<
    ServiceValidationRun,
    "status" | "fingerprint" | "indexGenerationId" | "invalidatedAt"
  >;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): "CURRENT" | "STALE" {
  if (input.run.invalidatedAt) return "STALE";
  if (input.run.status !== "PASS") return "CURRENT";
  if (
    input.bindingFingerprint &&
    input.run.fingerprint &&
    input.run.fingerprint !== input.bindingFingerprint
  ) {
    return "STALE";
  }
  if (
    input.bindingIndexGenerationId &&
    input.run.indexGenerationId &&
    input.run.indexGenerationId !== input.bindingIndexGenerationId
  ) {
    return "STALE";
  }
  return "CURRENT";
}

async function loadOwnedPack(input: {
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

export async function loadOwnedPackForServiceValidationRead(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  return loadOwnedPack(input);
}

export async function requireOwnedDraftPackForServiceValidationRun(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const owned = await loadOwnedPack(input);
  if (owned.pack.status !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 서비스 검증을 실행할 수 있습니다.",
      403,
    );
  }
  return owned;
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

export async function findLatestServiceValidationRun(input: {
  versionId: string;
  channel: ServiceChannel;
}): Promise<ServiceValidationRun | null> {
  return prisma.serviceValidationRun.findFirst({
    where: {
      versionId: input.versionId,
      channel: input.channel as ServiceValidationChannel,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getServiceValidationStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<ServiceValidationStatusDto> {
  const { pack, version } = await loadOwnedPackForServiceValidationRead(input);
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

  const channels: ServiceValidationChannelDto[] = [];
  for (const channel of ["API", "MCP", "DOWNLOAD"] as const) {
    const selectedChannel = selected.has(channel);
    if (!selectedChannel) {
      channels.push({
        channel,
        selected: false,
        status: "NOT_SELECTED",
        currentValidity: null,
        runId: null,
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
        adapterPath: null,
        details: null,
      });
      continue;
    }
    const run = await findLatestServiceValidationRun({ versionId: version.id, channel });
    const validity = run
      ? resolveRunCurrentValidity({
          run,
          bindingFingerprint: binding?.fingerprint,
          bindingIndexGenerationId: binding?.indexGenerationId,
        })
      : null;
    const effectiveStatus =
      run?.status === "PASS" && validity === "STALE" ? ("STALE" as const) : (run?.status ?? "PENDING");
    channels.push({
      channel,
      selected: true,
      status: effectiveStatus,
      currentValidity: validity,
      runId: run?.id ?? null,
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
      adapterPath: adapterPathForChannel(channel),
      details: asRecord(run?.details),
    });
  }

  const selectedChannels = channels.filter((c) => c.selected);
  const allSelectedPassed =
    selectedChannels.length > 0 &&
    selectedChannels.every((c) => c.status === "PASS" && c.currentValidity === "CURRENT");

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
    packStatus: pack.status,
    canRunValidation: pack.status === PackStatus.DRAFT,
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
  const { pack, version } = await requireOwnedDraftPackForServiceValidationRun(input);
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
  let latencyMs = 0;
  let details: Record<string, unknown> = {
    adapter: input.channel === "API" ? "RETRIEVAL_API" : input.channel === "MCP" ? "MCP_HANDLER" : "OBJECT_STORAGE",
    adapterPath: adapterPathForChannel(input.channel),
  };

  if (input.channel === "API") {
    query = query || "주요 기능을 알려주세요";
    const result = await executeRetrievalApiRequest({
      knowledgePackId: pack.packId,
      query,
      topK: 5,
      retrievalMode: "hybrid",
      includeMetadata: true,
      requestId: `provider-api-validation-${Date.now()}`,
      serviceChannel: "API",
      executionMode: "PROVIDER_VALIDATION",
      versionId: version.id,
      indexGenerationId: binding.indexGenerationId,
    });
    latencyMs = result.ok ? result.latencyMs : Date.now() - started;
    if (!result.ok) {
      failureCode = result.code;
      failureMessage = result.message;
    } else {
      const hits = evaluateRetrievalValidationHits({
        data: result.data,
        expectedVersionId: version.id,
        expectedIndexGenerationId: binding.indexGenerationId,
      });
      resultCount = result.data.contexts.length;
      const top = result.data.contexts[0];
      topChunkId = top?.chunkId ?? null;
      sourceDocumentId = top?.sourceDocumentId ?? null;
      const meta = asRecord(top?.metadata);
      page =
        typeof meta?.page === "number"
          ? meta.page
          : typeof meta?.pageStart === "number"
            ? meta.pageStart
            : null;
      details = {
        ...details,
        hitCount: resultCount,
        responseDtoReady: true,
      };
      if (!hits.ok) {
        failureCode = hits.code;
        failureMessage = hits.message;
      } else {
        status = "PASS";
      }
    }
  } else if (input.channel === "MCP") {
    query = query || "주요 기능을 알려주세요";
    const result = await executeMcpValidation({
      packId: pack.packId,
      versionId: version.id,
      query,
      indexGenerationId: binding.indexGenerationId,
    });
    latencyMs = result.ok ? result.latencyMs : Date.now() - started;
    if (!result.ok) {
      failureCode = result.code;
      failureMessage = result.message;
    } else {
      status = "PASS";
      resultCount = result.data.contexts.length;
      const top = result.data.contexts[0];
      topChunkId = top?.chunkId ?? null;
      sourceDocumentId = top?.sourceDocumentId ?? null;
      const meta = asRecord(top?.metadata);
      page =
        typeof meta?.page === "number"
          ? meta.page
          : typeof meta?.pageStart === "number"
            ? meta.pageStart
            : null;
      details = {
        ...details,
        toolName: result.toolName,
        mcpProtocolVersion: result.mcpProtocolVersion,
        responseBytes: result.responseBytes,
        hitCount: resultCount,
      };
    }
  } else {
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
    if (!file?.storageKey) {
      failureCode = "DOWNLOAD_OBJECT_NOT_FOUND";
      failureMessage = "원본문서(SOURCE_ORIGINAL)를 찾을 수 없습니다.";
      latencyMs = Date.now() - started;
    } else {
      const verified = await validateDownloadObjectIntegrity({
        fileId: file.id,
        objectKey: file.storageKey,
        originalFileName: file.originalFileName,
        mimeType: file.mimeType,
        expectedFileSize: file.fileSize,
        expectedChecksumSha256: file.checksumSha256,
      });
      latencyMs = verified.latencyMs;
      if (!verified.ok) {
        failureCode = verified.code;
        failureMessage = verified.message;
      } else {
        status = "PASS";
        resultCount = 1;
        details = {
          ...details,
          fileId: verified.fileId,
          fileName: verified.fileName,
          mimeType: verified.mimeType,
          fileSize: verified.fileSize,
          checksumSha256: verified.checksumSha256,
          // Never expose full objectKey to provider clients
          storageVerified: true,
        };
      }
    }
  }

  // Append-only: always create a new run row.
  const row = await prisma.serviceValidationRun.create({
    data: {
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
  });

  return {
    channel: input.channel,
    selected: true,
    status: row.status,
    currentValidity: "CURRENT",
    runId: row.id,
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
    adapterPath: adapterPathForChannel(input.channel),
    details: asRecord(row.details),
  };
}

export async function assertSelectedServiceValidationsPassed(input: {
  versionId: string;
  distribution: Pick<PackDistributionMetadata, "allowApi" | "allowMcp" | "allowDownload">;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<Record<string, { status: string; runId: string; testedAt: string | null }>> {
  const selected = selectedServiceChannels(input.distribution);
  if (selected.length === 0) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_REQUIRED",
      "제공 방식을 한 개 이상 선택해 주세요.",
      400,
    );
  }
  const snapshot: Record<string, { status: string; runId: string; testedAt: string | null }> = {};
  for (const channel of selected) {
    const run = await findLatestServiceValidationRun({ versionId: input.versionId, channel });
    const validity = run
      ? resolveRunCurrentValidity({
          run,
          bindingFingerprint: input.bindingFingerprint,
          bindingIndexGenerationId: input.bindingIndexGenerationId,
        })
      : "STALE";
    if (!run || run.status !== "PASS" || validity !== "CURRENT") {
      throw new PayloadServiceError(
        validity === "STALE" || run?.status === "STALE"
          ? "SERVICE_VALIDATION_STALE"
          : "SERVICE_VALIDATION_REQUIRED",
        validity === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
          : `선택한 ${channel} 제공 방식의 검증이 필요합니다.`,
        400,
      );
    }
    snapshot[channel] = {
      status: run.status,
      runId: run.id,
      testedAt: run.testedAt?.toISOString() ?? null,
    };
  }
  return snapshot;
}

export async function assertCurrentServiceValidationEvidence(input: {
  packId: string;
  versionId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
}): Promise<void> {
  const dist = await prisma.packDistributionMetadata.findUnique({
    where: { versionId: input.versionId },
  });
  if (!dist) {
    throw new PayloadServiceError("INCOMPLETE", "유통정보가 없습니다.", 400);
  }
  if (isServiceEnded(dist.serviceEndsAt)) {
    throw new PayloadServiceError(
      "SERVICE_ENDED",
      "서비스 종료일이 지나 서비스를 제공할 수 없습니다.",
      400,
    );
  }

  const selectedNow = selectedServiceChannels(dist);
  const snapAllowApi = input.snapshot.allowApi !== false;
  const snapAllowMcp = input.snapshot.allowMcp !== false;
  const snapAllowDownload = input.snapshot.allowDownload !== false;
  if (
    snapAllowApi !== dist.allowApi ||
    snapAllowMcp !== dist.allowMcp ||
    snapAllowDownload !== dist.allowDownload
  ) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
      400,
    );
  }

  const { binding, latest } = await loadBindingContext(input.packId, input.versionId);
  if (!binding || !latest) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
      400,
    );
  }

  const snapValidation = input.snapshot.serviceValidation ?? {};
  for (const channel of selectedNow) {
    const snap = snapValidation[channel];
    if (!snap?.runId) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
        400,
      );
    }
    const run = await prisma.serviceValidationRun.findUnique({ where: { id: snap.runId } });
    if (
      !run ||
      run.packId !== input.packId ||
      run.versionId !== input.versionId ||
      run.channel !== channel ||
      run.status !== "PASS" ||
      run.pipelineRunId !== latest.id ||
      run.indexGenerationId !== binding.indexGenerationId ||
      run.fingerprint !== binding.fingerprint ||
      run.normalizedDocumentId !== binding.normalizedDocumentId ||
      (snap.testedAt &&
        run.testedAt &&
        run.testedAt.toISOString() !== snap.testedAt)
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
        400,
      );
    }
    if (run.invalidatedAt) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
        400,
      );
    }
  }
}

export { isDistributionReadyForServiceValidation } from "@/lib/distribution/service-channel-policy";
