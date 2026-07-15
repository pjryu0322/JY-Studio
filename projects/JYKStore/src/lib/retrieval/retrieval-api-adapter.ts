import type { RetrievalFilters, RetrievalMode, RetrievalResponseDto } from "@/lib/retrieval-dto";
import { loadPublicRetrievalPack } from "@/lib/retrieval/retrieval-pack-store";
import { assertServiceChannelEnabled } from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import { retrieveContextsForVersion } from "@/lib/retrieval-service";

export type RetrievalExecutionMode = "PUBLIC" | "PROVIDER_VALIDATION";

export type ExecuteRetrievalApiResult =
  | { ok: true; data: RetrievalResponseDto; latencyMs: number }
  | {
      ok: false;
      code: string;
      message: string;
      httpStatus?: number;
    };

/**
 * Shared Retrieval API application adapter.
 * Channel is fixed by caller (route/auth context) — never from client headers.
 */
export async function executeRetrievalApiRequest(input: {
  knowledgePackId: string;
  query?: string;
  filters?: RetrievalFilters;
  topK: number;
  includeMetadata?: boolean;
  retrievalMode: RetrievalMode;
  requestId: string;
  /** Fixed by route or trusted internal context. */
  serviceChannel: "API" | "MCP";
  executionMode: RetrievalExecutionMode;
  /** Required for PROVIDER_VALIDATION — draft generation binding. */
  versionId?: string;
  indexGenerationId?: string | null;
}): Promise<ExecuteRetrievalApiResult> {
  const started = Date.now();
  const includeMetadata = input.includeMetadata !== false;
  const filters = input.filters ?? {};

  if (input.executionMode === "PUBLIC") {
    const packContext = await loadPublicRetrievalPack(input.knowledgePackId);
    if (!packContext) {
      return { ok: false, code: "PACK_NOT_FOUND", message: "지식팩을 찾을 수 없습니다.", httpStatus: 404 };
    }
    const channelCheck = assertServiceChannelEnabled(input.serviceChannel, {
      allowApi: packContext.allowApi,
      allowMcp: packContext.allowMcp,
      allowDownload: packContext.allowDownload,
      serviceEndsAt: packContext.serviceEndsAt,
    });
    if (!channelCheck.ok) {
      return {
        ok: false,
        code: channelCheck.code,
        message: channelCheck.message,
        httpStatus: 403,
      };
    }
    const activeChunkCount = await prisma.knowledgeChunk.count({
      where: { versionId: packContext.versionId, isActive: true },
    });
    if (activeChunkCount < 1) {
      return {
        ok: false,
        code: "PACK_RETRIEVAL_NOT_READY",
        message: "이 지식팩은 아직 Retrieval API를 지원하지 않습니다.",
        httpStatus: 409,
      };
    }
    const data = await retrieveContextsForVersion({
      packId: packContext.packId,
      versionId: packContext.versionId,
      query: input.query,
      filters,
      topK: input.topK,
      includeMetadata,
      retrievalMode: input.retrievalMode,
      requestId: input.requestId,
      excludeDraftScope: true,
    });
    return { ok: true, data, latencyMs: Date.now() - started };
  }

  // PROVIDER_VALIDATION — Draft generation only
  if (!input.versionId) {
    return {
      ok: false,
      code: "INCOMPLETE",
      message: "검증용 versionId가 필요합니다.",
      httpStatus: 400,
    };
  }
  const meta = await prisma.packDistributionMetadata.findUnique({
    where: { versionId: input.versionId },
  });
  if (!meta) {
    return {
      ok: false,
      code: "INCOMPLETE",
      message: "유통정보가 없습니다.",
      httpStatus: 400,
    };
  }
  const channelCheck = assertServiceChannelEnabled(input.serviceChannel, {
    allowApi: meta.allowApi,
    allowMcp: meta.allowMcp,
    allowDownload: meta.allowDownload,
    serviceEndsAt: meta.serviceEndsAt,
  });
  if (!channelCheck.ok) {
    return {
      ok: false,
      code: channelCheck.code,
      message: channelCheck.message,
      httpStatus: 403,
    };
  }

  const data = await retrieveContextsForVersion({
    packId: input.knowledgePackId,
    versionId: input.versionId,
    query: input.query,
    filters,
    topK: input.topK,
    includeMetadata,
    retrievalMode: input.retrievalMode,
    requestId: input.requestId,
    indexGenerationId: input.indexGenerationId,
    excludeDraftScope: false,
  });
  return { ok: true, data, latencyMs: Date.now() - started };
}

export function evaluateRetrievalValidationHits(input: {
  data: RetrievalResponseDto;
  expectedVersionId: string;
  expectedIndexGenerationId?: string | null;
}): { ok: true } | { ok: false; code: string; message: string } {
  const contexts = input.data.contexts ?? [];
  if (contexts.length === 0) {
    return { ok: false, code: "API_VALIDATION_FAILED", message: "검색 결과가 없습니다." };
  }
  for (const ctx of contexts) {
    const meta =
      ctx.metadata && typeof ctx.metadata === "object" && !Array.isArray(ctx.metadata)
        ? (ctx.metadata as Record<string, unknown>)
        : null;
    if (typeof meta?.versionId === "string" && meta.versionId !== input.expectedVersionId) {
      return {
        ok: false,
        code: "API_VALIDATION_FAILED",
        message: "다른 Version 결과가 포함되었습니다.",
      };
    }
    if (
      input.expectedIndexGenerationId &&
      typeof meta?.indexGenerationId === "string" &&
      meta.indexGenerationId !== input.expectedIndexGenerationId
    ) {
      return {
        ok: false,
        code: "API_VALIDATION_FAILED",
        message: "다른 검색 인덱스 Generation 결과가 포함되었습니다.",
      };
    }
    if (!ctx.sourceDocumentId) {
      return {
        ok: false,
        code: "API_VALIDATION_FAILED",
        message: "출처 정보가 부족합니다.",
      };
    }
    const page = meta?.page ?? meta?.pageStart;
    if (page == null) {
      return {
        ok: false,
        code: "API_VALIDATION_FAILED",
        message: "페이지 정보가 부족합니다.",
      };
    }
  }
  return { ok: true };
}
