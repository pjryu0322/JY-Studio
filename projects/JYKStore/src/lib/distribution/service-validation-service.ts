import {
  PackStatus,
  Prisma,
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
import {
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { executeMcpValidation } from "@/lib/mcp/mcp-validation-runtime";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import {
  evaluateRetrievalValidationHits,
  executeRetrievalApiRequest,
  resolveRetrievalContextSourceDocumentId,
} from "@/lib/retrieval/retrieval-api-adapter";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import type { RetrievalContextDto } from "@/lib/retrieval-dto";
import {
  loadSourceDocumentTitles,
  mapContextsToInternalResultItems,
  toProviderResultItemDtos,
  type ProviderValidationResultItemDto,
  type InternalValidationResultItem,
} from "@/lib/distribution/service-validation-result-snapshot";
import {
  evidenceIntegrityForRun,
  resolveCurrentValidationBindingTx,
  resolvePipelineRunBindingTx,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import {
  assertSharedConfirmationEvidence,
  canShareProviderConfirmation,
  computeResultFingerprint,
  isLegacySharedConfirmationMissingFingerprint,
} from "@/lib/distribution/service-validation-share";

export type ProviderConfirmationStatusDto =
  | "NOT_REVIEWED"
  | "CONFIRMED"
  | "REJECTED"
  | "STALE";

/** Provider-facing channel DTO — no pipeline/generation/fingerprint/sourceDocumentId. */
export type ServiceValidationChannelDto = {
  channel: ServiceChannel;
  selected: boolean;
  systemStatus: ServiceValidationStatus | "NOT_SELECTED";
  providerConfirmationStatus: ProviderConfirmationStatusDto | null;
  currentValidity: "CURRENT" | "STALE" | null;
  /** Opaque id for confirm/reject/preview routes — do not render in provider UI. */
  runId: string | null;
  testedAt: string | null;
  query: string | null;
  resultCount: number | null;
  failureMessage: string | null;
  latencyMs: number | null;
  results: ProviderValidationResultItemDto[];
  canRun: boolean;
  canConfirm: boolean;
  /** True when API/MCP peer has identical retrieval snapshot (shared confirm OK). */
  canShareConfirmationWithPeer: boolean;
  downloadTestCompleted: boolean;
  /** DOWNLOAD-friendly summary (no checksum/objectKey). */
  downloadSummary: {
    fileName: string;
    fileSizeLabel: string;
    mimeLabel: string;
    integrityOk: boolean;
  } | null;
  confirmation: {
    status: ProviderConfirmationStatusDto;
    confirmedAt: string | null;
    confirmedByName: string | null;
    rejectionReason: string | null;
    comment: string | null;
    sharedWithChannels: ServiceChannel[];
  } | null;
};

export type ServiceValidationStatusDto = {
  packId: string;
  versionId: string;
  packStatus: string;
  canRunValidation: boolean;
  channels: ServiceValidationChannelDto[];
  /** System PASS + Provider CONFIRMED + CURRENT for all selected channels. */
  allSelectedPassed: boolean;
  suggestedQuery: string | null;
  suggestedQueries: string[];
};

/** @deprecated Prefer ServiceValidationChannelDto — kept for gradual test migration. */
export type ServiceValidationChannelDtoLegacy = ServiceValidationChannelDto;

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

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "PDF";
  if (m.includes("markdown") || m.endsWith("/md")) return "Markdown";
  if (m.includes("json")) return "JSON";
  return mime?.trim() || "파일";
}

export function resolveRunCurrentValidity(input: {
  run: Pick<
    ServiceValidationRun,
    "status" | "fingerprint" | "indexGenerationId" | "invalidatedAt" | "channel"
  > & { channel?: string };
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  /** For API/MCP: PASS with 0 result items is incomplete evidence → STALE. */
  resultItemCount?: number | null;
}): "CURRENT" | "STALE" {
  if (input.run.invalidatedAt) return "STALE";
  if (input.run.status !== "PASS") return "CURRENT";
  const channel = input.run.channel;
  if (
    (channel === "API" || channel === "MCP") &&
    typeof input.resultItemCount === "number" &&
    input.resultItemCount < 1
  ) {
    return "STALE";
  }
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

export function resolveConfirmationStatusDto(input: {
  confirmationStatus: string | null | undefined;
  runValidity: "CURRENT" | "STALE" | null;
}): ProviderConfirmationStatusDto {
  if (!input.confirmationStatus) return "NOT_REVIEWED";
  if (input.runValidity === "STALE") return "STALE";
  if (input.confirmationStatus === "CONFIRMED") return "CONFIRMED";
  if (input.confirmationStatus === "REJECTED") return "REJECTED";
  return "NOT_REVIEWED";
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
  try {
    const binding = await resolveCurrentValidationBindingTx(prisma, { packId, versionId });
    const latest = await prisma.pipelineRun.findUnique({ where: { id: binding.pipelineRunId } });
    return {
      dist,
      latest,
      binding: {
        versionId: binding.versionId,
        indexGenerationId: binding.indexGenerationId,
        normalizedDocumentId: binding.normalizedDocumentId,
        fingerprint: binding.fingerprint,
      },
    };
  } catch {
    return { dist, latest: null, binding: null };
  }
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

async function loadSuggestedQueries(input: {
  versionId: string;
  indexGenerationId?: string | null;
}): Promise<string[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      isActive: true,
      ...(input.indexGenerationId
        ? { metadata: { path: ["indexGenerationId"], equals: input.indexGenerationId } }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
    take: 12,
    select: { title: true },
  });
  const titles = chunks
    .map((c) => c.title?.trim())
    .filter((t): t is string => Boolean(t && t.length >= 2));
  return [...new Set(titles)].slice(0, 5);
}

async function mapRunToProviderChannelDto(input: {
  channel: ServiceChannel;
  run: ServiceValidationRun | null;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  canRunValidation: boolean;
  userNames: Map<string, string>;
}): Promise<ServiceValidationChannelDto> {
  const { channel, run, canRunValidation } = input;
  if (!run) {
    return {
      channel,
      selected: true,
      systemStatus: "PENDING",
      providerConfirmationStatus: "NOT_REVIEWED",
      currentValidity: null,
      runId: null,
      testedAt: null,
      query: null,
      resultCount: null,
      failureMessage: null,
      latencyMs: null,
      results: [],
      canRun: canRunValidation,
      canConfirm: false,
      canShareConfirmationWithPeer: false,
      downloadTestCompleted: false,
      downloadSummary: null,
      confirmation: null,
    };
  }

  const resultRows = await prisma.serviceValidationResultItem.findMany({
    where: { runId: run.id },
    orderBy: { rank: "asc" },
  });
  const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
    where: { runId: run.id },
  });

  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
    resultItemCount: channel === "DOWNLOAD" ? null : resultRows.length,
  });
  let effectiveValidity = validity;
  let legacyFingerprintMissing = false;
  const confirmationEarly = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: run.id },
  });
  if (confirmationEarly?.sharedConfirmationGroupId && (channel === "API" || channel === "MCP")) {
    const peers = await prisma.serviceValidationProviderConfirmation.findMany({
      where: { sharedConfirmationGroupId: confirmationEarly.sharedConfirmationGroupId },
      include: { run: { select: { channel: true, resultFingerprint: true } } },
    });
    const apiPeer = peers.find((p) => p.run.channel === "API")?.run;
    const mcpPeer = peers.find((p) => p.run.channel === "MCP")?.run;
    if (
      isLegacySharedConfirmationMissingFingerprint({
        sharedConfirmationGroupId: confirmationEarly.sharedConfirmationGroupId,
        apiResultFingerprint: apiPeer?.resultFingerprint,
        mcpResultFingerprint: mcpPeer?.resultFingerprint,
      })
    ) {
      effectiveValidity = "STALE";
      legacyFingerprintMissing = true;
    }
  }
  const systemStatus =
    run.status === "PASS" && effectiveValidity === "STALE" ? ("STALE" as const) : run.status;

  const confirmation = confirmationEarly;
  const providerConfirmationStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: effectiveValidity,
  });

  const results = toProviderResultItemDtos(resultRows);

  const details = asRecord(run.details);
  let downloadSummary: ServiceValidationChannelDto["downloadSummary"] = null;
  if (channel === "DOWNLOAD" && details) {
    const fileName = typeof details.fileName === "string" ? details.fileName : null;
    const fileSize = typeof details.fileSize === "number" ? details.fileSize : null;
    const mimeType = typeof details.mimeType === "string" ? details.mimeType : null;
    if (fileName) {
      downloadSummary = {
        fileName,
        fileSizeLabel: formatBytes(fileSize ?? 0),
        mimeLabel: mimeLabel(mimeType),
        integrityOk: details.storageVerified === true && systemStatus === "PASS",
      };
    }
  }

  const sharedWithChannels: ServiceChannel[] = [];
  if (confirmation?.sharedConfirmationGroupId) {
    const peers = await prisma.serviceValidationProviderConfirmation.findMany({
      where: { sharedConfirmationGroupId: confirmation.sharedConfirmationGroupId },
      include: { run: { select: { channel: true, id: true } } },
    });
    for (const p of peers) {
      if (p.run.id !== run.id) {
        sharedWithChannels.push(p.run.channel as ServiceChannel);
      }
    }
  }

  let canShareConfirmationWithPeer = false;
  if (
    (channel === "API" || channel === "MCP") &&
    systemStatus === "PASS" &&
    effectiveValidity === "CURRENT" &&
    providerConfirmationStatus === "NOT_REVIEWED" &&
    resultRows.length > 0
  ) {
    const peerChannel = channel === "API" ? "MCP" : "API";
    const peer = await findLatestServiceValidationRun({
      versionId: run.versionId,
      channel: peerChannel,
    });
    if (peer) {
      const peerConf = await prisma.serviceValidationProviderConfirmation.findUnique({
        where: { runId: peer.id },
      });
      if (!peerConf) {
        const peerItems = await prisma.serviceValidationResultItem.findMany({
          where: { runId: peer.id },
          orderBy: { rank: "asc" },
        });
        canShareConfirmationWithPeer = canShareProviderConfirmation({
          apiRun: channel === "API" ? run : peer,
          mcpRun: channel === "MCP" ? run : peer,
          apiResults: (channel === "API" ? resultRows : peerItems).map((i) => ({
            rank: i.rank,
            chunkId: i.chunkId,
            sourceDocumentId: i.sourceDocumentId,
            pageStart: i.pageStart,
            pageEnd: i.pageEnd,
          })),
          mcpResults: (channel === "MCP" ? resultRows : peerItems).map((i) => ({
            rank: i.rank,
            chunkId: i.chunkId,
            sourceDocumentId: i.sourceDocumentId,
            pageStart: i.pageStart,
            pageEnd: i.pageEnd,
          })),
          binding: {
            fingerprint: input.bindingFingerprint,
            indexGenerationId: input.bindingIndexGenerationId,
            pipelineRunId: run.pipelineRunId,
            normalizedDocumentId: run.normalizedDocumentId,
          },
        });
      }
    }
  }

  const downloadTestCompleted = Boolean(downloadTest?.responseReady);
  const canConfirm =
    canRunValidation &&
    systemStatus === "PASS" &&
    effectiveValidity === "CURRENT" &&
    providerConfirmationStatus === "NOT_REVIEWED" &&
    (channel === "DOWNLOAD"
      ? downloadTestCompleted
      : resultRows.length > 0);

  return {
    channel,
    selected: true,
    systemStatus,
    providerConfirmationStatus,
    currentValidity: effectiveValidity,
    runId: run.id,
    testedAt: run.testedAt?.toISOString() ?? null,
    query: run.query,
    resultCount: run.resultCount,
    failureMessage: legacyFingerprintMissing
      ? "검색 결과 증적 형식이 변경되어 API와 MCP를 다시 검증해야 합니다."
      : run.failureMessage,
    latencyMs: run.latencyMs,
    results,
    canRun: canRunValidation,
    canConfirm,
    canShareConfirmationWithPeer,
    downloadTestCompleted,
    downloadSummary,
    confirmation: confirmation
      ? {
          status: providerConfirmationStatus,
          confirmedAt: confirmation.confirmedAt.toISOString(),
          confirmedByName: input.userNames.get(confirmation.confirmedByUserId) ?? "제공자",
          rejectionReason: confirmation.rejectionReason,
          comment: confirmation.comment,
          sharedWithChannels,
        }
      : null,
  };
}

/** Preparation targets for search-validation before final distribution channel selection. */
export const SEARCH_VALIDATION_PREPARATION_CHANNELS: ServiceChannel[] = [
  "API",
  "MCP",
  "DOWNLOAD",
];

export async function getServiceValidationStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<ServiceValidationStatusDto> {
  const { pack, version } = await loadOwnedPackForServiceValidationRead(input);
  const { binding } = await loadBindingContext(pack.packId, version.id);

  // Search-validation prepares all delivery channels before the provider picks publish channels.
  const selected = new Set(SEARCH_VALIDATION_PREPARATION_CHANNELS);

  const canRunValidation = pack.status === PackStatus.DRAFT && Boolean(binding);
  const channels: ServiceValidationChannelDto[] = [];
  const confirmerIds = new Set<string>();

  // Prefetch runs + confirmation user ids
  const runsByChannel = new Map<ServiceChannel, ServiceValidationRun | null>();
  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    const run = await findLatestServiceValidationRun({ versionId: version.id, channel });
    runsByChannel.set(channel, run);
    if (run) {
      const conf = await prisma.serviceValidationProviderConfirmation.findUnique({
        where: { runId: run.id },
        select: { confirmedByUserId: true },
      });
      if (conf) confirmerIds.add(conf.confirmedByUserId);
    }
  }

  const users =
    confirmerIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...confirmerIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userNames = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email?.trim() || "제공자"]),
  );

  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    channels.push(
      await mapRunToProviderChannelDto({
        channel,
        run: runsByChannel.get(channel) ?? null,
        bindingFingerprint: binding?.fingerprint,
        bindingIndexGenerationId: binding?.indexGenerationId,
        canRunValidation,
        userNames,
      }),
    );
  }

  const selectedChannels = channels.filter((c) => selected.has(c.channel));
  const allSelectedPassed =
    selectedChannels.length === SEARCH_VALIDATION_PREPARATION_CHANNELS.length &&
    selectedChannels.every(
      (c) =>
        c.systemStatus === "PASS" &&
        c.currentValidity === "CURRENT" &&
        c.providerConfirmationStatus === "CONFIRMED",
    );

  const suggestedQueries = await loadSuggestedQueries({
    versionId: version.id,
    indexGenerationId: binding?.indexGenerationId,
  });

  return {
    packId: pack.packId,
    versionId: version.id,
    packStatus: pack.status,
    canRunValidation,
    channels,
    allSelectedPassed,
    suggestedQuery: suggestedQueries[0] ?? "주요 기능을 알려주세요",
    suggestedQueries,
  };
}

async function buildSafeRetrievalItems(input: {
  contexts: RetrievalContextDto[];
  expectedVersionId: string;
  normalizedDocumentId: string;
}): Promise<InternalValidationResultItem[]> {
  const sourceIds = input.contexts
    .map((c) => resolveRetrievalContextSourceDocumentId(c))
    .filter((id): id is string => Boolean(id));
  const titles = await loadSourceDocumentTitles(sourceIds);
  const items = mapContextsToInternalResultItems(input.contexts, titles);
  if (items.length === 0) return [];
  const chunkIds = items.map((i) => i.chunkId);
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: chunkIds } },
    select: { id: true, versionId: true },
  });
  const allowed = new Set(
    chunks.filter((c) => c.versionId === input.expectedVersionId).map((c) => c.id),
  );
  const filtered = items.filter((i) => allowed.has(i.chunkId));
  if (filtered.length === 0) return [];

  const docs = await prisma.sourceDocument.findMany({
    where: {
      id: { in: [...new Set(filtered.map((i) => i.sourceDocumentId))] },
      versionId: input.expectedVersionId,
    },
    select: { id: true },
  });
  const normalizedDocument = await prisma.normalizedDocument.findFirst({
    where: {
      id: input.normalizedDocumentId,
      versionId: input.expectedVersionId,
      isActive: true,
      sourceFileId: { not: null },
      bundle: {
        versionId: input.expectedVersionId,
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
        status: "REVIEW_READY",
      },
    },
    select: { sourceFileId: true, bundleId: true },
  });
  const sourceFile = normalizedDocument?.sourceFileId
    ? await prisma.knowledgePackFile.findFirst({
        where: {
          id: normalizedDocument.sourceFileId,
          bundleId: normalizedDocument.bundleId,
          versionId: input.expectedVersionId,
          role: "SOURCE_ORIGINAL",
          bundle: {
            isActive: true,
            deletedAt: null,
            storageStatus: "ACTIVE",
            status: "REVIEW_READY",
          },
        },
        select: { id: true },
      })
    : null;
  const validSourceDocumentIds = new Set(docs.map((doc) => doc.id));
  const expectedSourceDocumentIds = new Set(filtered.map((item) => item.sourceDocumentId));
  if (!sourceFile || validSourceDocumentIds.size !== expectedSourceDocumentIds.size) return [];

  return filtered.map((item) => ({
    ...item,
    sourceFileId: validSourceDocumentIds.has(item.sourceDocumentId) ? sourceFile.id : null,
  }));
}

export async function runServiceChannelValidation(input: {
  userId: string;
  clientId: string;
  packId: string;
  channel: ServiceChannel;
  query?: string | null;
}): Promise<ServiceValidationChannelDto> {
  const { pack, version, profile } = await requireOwnedDraftPackForServiceValidationRun(input);
  const { latest, binding } = await loadBindingContext(pack.packId, version.id);
  if (!SEARCH_VALIDATION_PREPARATION_CHANNELS.includes(input.channel)) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_DISABLED",
      "지원하지 않는 검증 채널입니다.",
      400,
    );
  }
  if (!binding || !latest) {
    throw new PayloadServiceError(
      "INCOMPLETE",
      "데이터 구조화가 완료되어야 검색데이터 검증을 진행할 수 있습니다.",
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
  let retrievalContexts: RetrievalContextDto[] = [];
  let safeItems: InternalValidationResultItem[] = [];
  let resultFingerprint: string | null = null;

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
      retrievalContexts = result.data.contexts;
      const top = result.data.contexts[0];
      topChunkId = top?.chunkId ?? null;
      sourceDocumentId = top ? resolveRetrievalContextSourceDocumentId(top) : null;
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
        requestId: `provider-api-validation`,
      };
      if (!hits.ok) {
        failureCode = hits.code;
        failureMessage = hits.message;
      } else {
        safeItems = await buildSafeRetrievalItems({
          contexts: retrievalContexts,
          expectedVersionId: version.id,
          normalizedDocumentId: binding.normalizedDocumentId,
        });
        if (safeItems.length < 1) {
          failureCode = "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY";
          failureMessage = "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.";
        } else {
          status = "PASS";
          resultFingerprint = computeResultFingerprint({
            query,
            indexGenerationId: binding.indexGenerationId,
            items: safeItems,
          });
        }
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
      resultCount = result.data.contexts.length;
      retrievalContexts = result.data.contexts;
      const top = result.data.contexts[0];
      topChunkId = top?.chunkId ?? null;
      sourceDocumentId = top ? resolveRetrievalContextSourceDocumentId(top) : null;
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
      safeItems = await buildSafeRetrievalItems({
        contexts: retrievalContexts,
        expectedVersionId: version.id,
        normalizedDocumentId: binding.normalizedDocumentId,
      });
      if (safeItems.length < 1) {
        failureCode = "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY";
        failureMessage = "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.";
      } else {
        status = "PASS";
        resultFingerprint = computeResultFingerprint({
          query,
          indexGenerationId: binding.indexGenerationId,
          items: safeItems,
        });
      }
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
          storageVerified: true,
        };
      }
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "KnowledgePack"
      WHERE "packId" = ${pack.packId}
      FOR UPDATE
    `;
    const packInTx = await tx.knowledgePack.findFirst({
      where: {
        packId: pack.packId,
        providerProfileId: profile.id,
        status: PackStatus.DRAFT,
      },
      select: { packId: true },
    });
    const versionInTx = await tx.knowledgePackVersion.findFirst({
      where: { packId: pack.packId },
      orderBy: latestKnowledgePackVersionOrderBy,
      select: { id: true },
    });
    if (!packInTx || versionInTx?.id !== version.id) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_NOT_EDITABLE",
        "지식팩 상태 또는 현재 버전이 변경되었습니다. 다시 시도해 주세요.",
        409,
      );
    }
    const bindingInTx = await resolveCurrentValidationBindingTx(tx, {
      packId: pack.packId,
      versionId: version.id,
      expectedPipelineRunId: latest.id,
    });
    if (
      bindingInTx.indexGenerationId !== binding.indexGenerationId ||
      bindingInTx.normalizedDocumentId !== binding.normalizedDocumentId ||
      bindingInTx.fingerprint !== binding.fingerprint
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "지식 데이터가 변경되어 서비스 검증을 다시 실행해야 합니다.",
        409,
      );
    }
    if (!SEARCH_VALIDATION_PREPARATION_CHANNELS.includes(input.channel)) {
      throw new PayloadServiceError(
        "SERVICE_CHANNEL_DISABLED",
        "지원하지 않는 검증 채널입니다.",
        409,
      );
    }
    if (status === "PASS" && (input.channel === "API" || input.channel === "MCP")) {
      const sourceDocumentIds = [...new Set(safeItems.map((item) => item.sourceDocumentId))];
      const sourceFileIds = [...new Set(safeItems.map((item) => item.sourceFileId).filter(Boolean))];
      const [sourceDocumentCount, sourceFileCount] = await Promise.all([
        tx.sourceDocument.count({
          where: { id: { in: sourceDocumentIds }, versionId: version.id },
        }),
        tx.knowledgePackFile.count({
          where: {
            id: { in: sourceFileIds as string[] },
            versionId: version.id,
            role: "SOURCE_ORIGINAL",
            bundle: {
              id: bindingInTx.bundleId,
              isActive: true,
              deletedAt: null,
              storageStatus: "ACTIVE",
              status: "REVIEW_READY",
            },
          },
        }),
      ]);
      if (
        sourceDocumentCount !== sourceDocumentIds.length ||
        sourceFileIds.length < 1 ||
        sourceFileCount !== sourceFileIds.length
      ) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "검색 결과와 원문 파일 연결이 변경되었습니다. 다시 검증해 주세요.",
          409,
        );
      }
    }
    if (status === "PASS" && input.channel === "DOWNLOAD") {
      const fileId =
        details && typeof details.fileId === "string" ? details.fileId : null;
      const fileInTx = fileId
        ? await tx.knowledgePackFile.findFirst({
            where: {
              id: fileId,
              packId: pack.packId,
              versionId: version.id,
              role: "SOURCE_ORIGINAL",
              bundle: {
                id: bindingInTx.bundleId,
                isActive: true,
                deletedAt: null,
                storageStatus: "ACTIVE",
                status: "REVIEW_READY",
              },
            },
            select: { id: true },
          })
        : null;
      if (!fileInTx) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "다운로드 검증 원문 파일 연결이 변경되었습니다. 다시 검증해 주세요.",
          409,
        );
      }
    }
    const created = await tx.serviceValidationRun.create({
      data: {
        packId: pack.packId,
        versionId: version.id,
        channel: input.channel as ServiceValidationChannel,
        status,
        pipelineRunId: latest.id,
        indexGenerationId: binding.indexGenerationId,
        normalizedDocumentId: binding.normalizedDocumentId,
        fingerprint: binding.fingerprint,
        resultFingerprint,
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
        details: details as Prisma.InputJsonValue,
      },
    });
    if (status === "PASS" && (input.channel === "API" || input.channel === "MCP")) {
      if (safeItems.length < 1) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
          "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.",
          500,
        );
      }
      await tx.serviceValidationResultItem.createMany({
        data: safeItems.map((item) => ({
          runId: created.id,
          rank: item.rank,
          chunkId: item.chunkId,
          title: item.title,
          snippet: item.snippet,
          score: item.score,
          sourceDocumentId: item.sourceDocumentId,
          sourceDocumentTitle: item.sourceDocumentTitle,
          sourceFileId: item.sourceFileId,
          pageStart: item.pageStart,
          pageEnd: item.pageEnd,
          sourceLocator: item.sourceLocator,
        })),
      });
    }
    return created;
  });

  return mapRunToProviderChannelDto({
    channel: input.channel,
    run: row,
    bindingFingerprint: binding.fingerprint,
    bindingIndexGenerationId: binding.indexGenerationId,
    canRunValidation: true,
    userNames: new Map(),
  });
}

export type ServiceValidationSubmitSnapshotEntry = {
  status: string;
  runId: string;
  testedAt: string | null;
  providerConfirmationStatus: string;
  providerConfirmationId: string | null;
  confirmedAt: string | null;
};

export async function assertSelectedServiceValidationsPassed(input: {
  versionId: string;
  distribution: Pick<PackDistributionMetadata, "allowApi" | "allowMcp" | "allowDownload">;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<Record<string, ServiceValidationSubmitSnapshotEntry>> {
  const selected = selectedServiceChannels(input.distribution);
  if (selected.length === 0) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_REQUIRED",
      "제공 방식을 한 개 이상 선택해 주세요.",
      400,
    );
  }
  const snapshot: Record<string, ServiceValidationSubmitSnapshotEntry> = {};
  for (const channel of selected) {
    const run = await findLatestServiceValidationRun({ versionId: input.versionId, channel });
    const resultItemCount =
      run && (channel === "API" || channel === "MCP")
        ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
        : null;
    const validity = run
      ? resolveRunCurrentValidity({
          run,
          bindingFingerprint: input.bindingFingerprint,
          bindingIndexGenerationId: input.bindingIndexGenerationId,
          resultItemCount,
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
    if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
        `선택한 ${channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
        400,
      );
    }
    if (channel === "DOWNLOAD") {
      const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (!downloadTest?.responseReady) {
        throw new PayloadServiceError(
          "SERVICE_DOWNLOAD_TEST_REQUIRED",
          "다운로드 테스트 증적이 필요합니다. 테스트 다운로드 후 품질 확인해 주세요.",
          400,
        );
      }
    }
    const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { runId: run.id },
    });
    const confStatus = resolveConfirmationStatusDto({
      confirmationStatus: confirmation?.status,
      runValidity: validity,
    });
    if (confStatus !== "CONFIRMED") {
      throw new PayloadServiceError(
        confStatus === "STALE"
          ? "SERVICE_VALIDATION_STALE"
          : confStatus === "REJECTED"
            ? "SERVICE_CONFIRMATION_REJECTED"
            : "SERVICE_CONFIRMATION_REQUIRED",
        confStatus === "REJECTED"
          ? `선택한 ${channel} 제공 방식의 검색 품질이 반려되었습니다. 다시 검증해 주세요.`
          : confStatus === "STALE"
            ? "지식 데이터 또는 유통정보가 변경되어 서비스 품질 확인을 다시 진행해야 합니다."
            : `선택한 ${channel} 제공 방식의 제공자 품질 확인이 필요합니다.`,
        400,
      );
    }
    snapshot[channel] = {
      status: run.status,
      runId: run.id,
      testedAt: run.testedAt?.toISOString() ?? null,
      providerConfirmationStatus: confStatus,
      providerConfirmationId: confirmation!.id,
      confirmedAt: confirmation!.confirmedAt.toISOString(),
    };
  }
  // Shared confirmation fingerprint check when both API and MCP confirmed via same group
  if (snapshot.API && snapshot.MCP) {
    const apiRun = await prisma.serviceValidationRun.findUnique({
      where: { id: snapshot.API.runId },
    });
    const mcpRun = await prisma.serviceValidationRun.findUnique({
      where: { id: snapshot.MCP.runId },
    });
    const apiConf = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { id: snapshot.API.providerConfirmationId! },
    });
    const mcpConf = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { id: snapshot.MCP.providerConfirmationId! },
    });
    if (
      apiConf?.sharedConfirmationGroupId &&
      apiConf.sharedConfirmationGroupId === mcpConf?.sharedConfirmationGroupId
    ) {
      const [apiResults, mcpResults] = await Promise.all([
        prisma.serviceValidationResultItem.findMany({
          where: { runId: snapshot.API.runId },
          orderBy: { rank: "asc" },
        }),
        prisma.serviceValidationResultItem.findMany({
          where: { runId: snapshot.MCP.runId },
          orderBy: { rank: "asc" },
        }),
      ]);
      const asserted = assertSharedConfirmationEvidence({
        apiRun,
        mcpRun,
        apiResults: apiResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
        mcpResults: mcpResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
      });
      if (!asserted.ok) {
        throw new PayloadServiceError(asserted.code, asserted.message, 400);
      }
    }
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
      (snap.testedAt && run.testedAt && run.testedAt.toISOString() !== snap.testedAt)
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
    if (channel === "API" || channel === "MCP") {
      const itemCount = await prisma.serviceValidationResultItem.count({
        where: { runId: run.id },
      });
      if (itemCount < 1) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
          400,
        );
      }
    }
    if (channel === "DOWNLOAD") {
      const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (!downloadTest?.responseReady) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
          400,
        );
      }
    }
    const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { runId: run.id },
    });
    if (!confirmation || confirmation.status !== "CONFIRMED") {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
        400,
      );
    }
    if (
      "providerConfirmationId" in snap &&
      snap.providerConfirmationId &&
      snap.providerConfirmationId !== confirmation.id
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
        400,
      );
    }
  }

  const apiSnap = snapValidation.API;
  const mcpSnap = snapValidation.MCP;
  if (apiSnap?.runId && mcpSnap?.runId) {
    const apiRun = await prisma.serviceValidationRun.findUnique({ where: { id: apiSnap.runId } });
    const mcpRun = await prisma.serviceValidationRun.findUnique({ where: { id: mcpSnap.runId } });
    const apiConf = apiSnap.providerConfirmationId
      ? await prisma.serviceValidationProviderConfirmation.findUnique({
          where: { id: apiSnap.providerConfirmationId },
        })
      : null;
    const mcpConf = mcpSnap.providerConfirmationId
      ? await prisma.serviceValidationProviderConfirmation.findUnique({
          where: { id: mcpSnap.providerConfirmationId },
        })
      : null;
    if (
      apiConf?.sharedConfirmationGroupId &&
      apiConf.sharedConfirmationGroupId === mcpConf?.sharedConfirmationGroupId
    ) {
      const [apiResults, mcpResults] = await Promise.all([
        prisma.serviceValidationResultItem.findMany({
          where: { runId: apiSnap.runId },
          orderBy: { rank: "asc" },
        }),
        prisma.serviceValidationResultItem.findMany({
          where: { runId: mcpSnap.runId },
          orderBy: { rank: "asc" },
        }),
      ]);
      const asserted = assertSharedConfirmationEvidence({
        apiRun,
        mcpRun,
        apiResults: apiResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
        mcpResults: mcpResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
      });
      if (!asserted.ok) {
        throw new PayloadServiceError(asserted.code, asserted.message, 400);
      }
    }
  }
}

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

export { isDistributionReadyForServiceValidation } from "@/lib/distribution/service-channel-policy";
export { adapterPathForChannel };
export {
  assertSharedConfirmationEvidence,
  canShareProviderConfirmation,
  computeResultFingerprint,
} from "@/lib/distribution/service-validation-share";
