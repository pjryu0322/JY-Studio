import {
  contentHashForChunk,
  KP_CHUNK_DEFAULT_MAX,
  KP_CHUNK_DEFAULT_OVERLAP,
  splitTextIntoOverlappingChunks,
} from "@/lib/knowledge-packs/knowledgePackChunkCore";
import {
  KP_INDEX_JOB_STATUS,
  KP_INDEX_JOB_STEP,
  KP_SOURCE_STATUS,
} from "@/lib/knowledge-packs/knowledgePackRagConstants";
import { collectKnowledgePackSource } from "@/lib/knowledge-packs/knowledgePackSourceCollector";
import { getSourceOwnedByUser } from "@/lib/knowledge-packs/knowledgePackSourceService";
import { prisma } from "@/lib/prisma";

function roughTokenEstimate(s: string): number {
  return Math.max(0, Math.ceil(s.length / 4));
}

/** 수집 후 평문을 겹침 청크로 저장한다. */
export async function chunkAndSaveKnowledgePackSource(
  userId: string,
  sourceId: string,
  options?: Readonly<{ maxChars?: number; overlapChars?: number; runCollectIfEmpty?: boolean }>
): Promise<{ ok: true; chunkCount: number } | { ok: false; message: string }> {
  const source = await getSourceOwnedByUser(sourceId, userId);
  if (!source) return { ok: false, message: "원천자료를 찾을 수 없습니다." };
  if (source.status === KP_SOURCE_STATUS.DISABLED) return { ok: false, message: "비활성화된 원천자료입니다." };

  let text = source.lastCollectedText ?? "";
  if (!text.trim() && options?.runCollectIfEmpty !== false) {
    const c = await collectKnowledgePackSource(userId, sourceId);
    if (!c.ok) return { ok: false, message: c.message };
    const again = await getSourceOwnedByUser(sourceId, userId);
    text = again?.lastCollectedText ?? "";
  }
  if (!text.trim()) return { ok: false, message: "청크할 평문이 없습니다. 먼저 수집을 실행하세요." };

  const job = await prisma.kpKnowledgePackIndexJob.create({
    data: {
      knowledgePackId: source.knowledgePackId,
      sourceId,
      step: KP_INDEX_JOB_STEP.CHUNK,
      status: KP_INDEX_JOB_STATUS.RUNNING,
      message: "",
      createdBy: userId,
      startedAt: new Date(),
    },
  });

  try {
    const max = options?.maxChars ?? KP_CHUNK_DEFAULT_MAX;
    const overlap = options?.overlapChars ?? KP_CHUNK_DEFAULT_OVERLAP;
    const parts = splitTextIntoOverlappingChunks(text, max, overlap);

    await prisma.$transaction(async (tx) => {
      await tx.kpKnowledgePackChunk.deleteMany({ where: { sourceId } });
      if (parts.length) {
        await tx.kpKnowledgePackChunk.createMany({
          data: parts.map((chunkText, chunkOrder) => ({
            knowledgePackId: source.knowledgePackId,
            sourceId,
            chunkText,
            chunkOrder,
            tokenEstimate: roughTokenEstimate(chunkText),
            contentHash: contentHashForChunk(chunkText),
          })),
        });
      }
      await tx.kpKnowledgePackSource.update({
        where: { id: sourceId },
        data: { status: KP_SOURCE_STATUS.CHUNKED, lastError: null },
      });
    });

    await prisma.kpKnowledgePackIndexJob.update({
      where: { id: job.id },
      data: {
        status: KP_INDEX_JOB_STATUS.SUCCESS,
        message: `청크 ${parts.length}개 저장`,
        finishedAt: new Date(),
      },
    });

    return { ok: true, chunkCount: parts.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "청크 저장 중 오류가 발생했습니다.";
    await prisma.kpKnowledgePackSource.update({
      where: { id: sourceId },
      data: { lastError: msg },
    });
    await prisma.kpKnowledgePackIndexJob.update({
      where: { id: job.id },
      data: {
        status: KP_INDEX_JOB_STATUS.FAILED,
        message: msg,
        finishedAt: new Date(),
      },
    });
    return { ok: false, message: msg };
  }
}

export async function listChunksForSource(userId: string, sourceId: string, take = 200) {
  const source = await getSourceOwnedByUser(sourceId, userId);
  if (!source) return null;

  const rows = await prisma.kpKnowledgePackChunk.findMany({
    where: { sourceId },
    orderBy: { chunkOrder: "asc" },
    take: Math.min(500, Math.max(1, take)),
    select: {
      id: true,
      chunkOrder: true,
      chunkText: true,
      tokenEstimate: true,
      contentHash: true,
    },
  });
  return { knowledgePackId: source.knowledgePackId, chunks: rows };
}
