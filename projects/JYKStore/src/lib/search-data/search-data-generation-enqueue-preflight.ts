/**
 * Preflight checks for startSearchDataGeneration (no enqueue side effects).
 */
import { PackStatus } from "@prisma/client";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  getDoclingKnowledgePipelineStatus,
  isDoclingStructurePassed,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import {
  parseKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { prisma } from "@/lib/prisma";
import {
  countRetrievalChunksForGeneration,
  loadOwnedPack,
} from "@/lib/search-data/search-data-generation-shared";

export type SearchDataEnqueuePreflightOk = {
  ok: true;
  packId: string;
  userId: string;
  clientId: string;
  forceRegenerate: boolean;
  versionId: string;
  latestPipelineRunId: string;
  binding: KnowledgeRunBinding;
  indexGenerationId: string;
  chunkCount: number;
};

export type SearchDataEnqueuePreflightErr = {
  ok: false;
  error: "NOT_FOUND" | "PROFILE_REQUIRED" | "INVALID";
  message: string;
  code?: string;
};

export async function assertSearchDataEnqueuePreflight(input: {
  userId: string;
  clientId: string;
  packId: string;
  forceRegenerate?: boolean;
}): Promise<SearchDataEnqueuePreflightOk | SearchDataEnqueuePreflightErr> {
  const forceRegenerate = Boolean(input.forceRegenerate);
  const owned = await loadOwnedPack(input);
  if (!owned.ok) return { ok: false, error: owned.error, message: "팩을 찾을 수 없습니다." };
  if (owned.pack.status !== PackStatus.DRAFT) {
    return {
      ok: false,
      error: "INVALID",
      message: "초안 상태에서만 검색데이터를 생성할 수 있습니다.",
      code: "PACK_NOT_DRAFT",
    };
  }

  const structureOk = await isDoclingStructurePassed(input.packId);
  if (!structureOk) {
    return {
      ok: false,
      error: "INVALID",
      message: "데이터 구조화가 완료되지 않았습니다. 구조화 단계로 이동해 주세요.",
      code: "STRUCTURE_REQUIRED",
    };
  }

  const knowledge = await getDoclingKnowledgePipelineStatus({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  if ("error" in knowledge) {
    return { ok: false, error: knowledge.error, message: "팩을 찾을 수 없습니다." };
  }
  if (!knowledge.pipelineCurrent) {
    return {
      ok: false,
      error: "INVALID",
      message: "자료 또는 구조화 결과가 변경되었습니다. 데이터 구조화를 다시 실행해 주세요.",
      code: "STALE",
    };
  }

  const version = owned.pack.versions[0];
  if (!version) {
    return { ok: false, error: "INVALID", message: "버전 정보가 없습니다.", code: "VERSION_REQUIRED" };
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
  });
  if (!latest) {
    return {
      ok: false,
      error: "INVALID",
      message: "구조화 실행 기록을 찾을 수 없습니다.",
      code: "PIPELINE_REQUIRED",
    };
  }
  const binding = parseKnowledgeRunBinding(latest.summary);
  if (!binding?.indexGenerationId || !binding.fingerprint || !binding.normalizedDocumentId) {
    return {
      ok: false,
      error: "INVALID",
      message: "현재 구조화 Binding이 없습니다.",
      code: "BINDING_REQUIRED",
    };
  }

  const indexGenerationId = binding.indexGenerationId;
  const chunkCount = await countRetrievalChunksForGeneration({
    versionId: version.id,
    indexGenerationId,
  });
  if (chunkCount < 1) {
    return {
      ok: false,
      error: "INVALID",
      message: "검색 단위(Chunk)가 없습니다. 데이터 구조화를 다시 실행해 주세요.",
      code: "CHUNKS_REQUIRED",
    };
  }

  return {
    ok: true,
    packId: input.packId,
    userId: input.userId,
    clientId: input.clientId,
    forceRegenerate,
    versionId: version.id,
    latestPipelineRunId: latest.id,
    binding,
    indexGenerationId,
    chunkCount,
  };
}
