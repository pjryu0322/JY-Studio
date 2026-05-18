import { parseKnowledgePackDocument } from "@/lib/knowledge-packs/knowledgePackDocumentParser";
import {
  KP_INDEX_JOB_STATUS,
  KP_INDEX_JOB_STEP,
  KP_SOURCE_STATUS,
} from "@/lib/knowledge-packs/knowledgePackRagConstants";
import { getSourceOwnedByUser } from "@/lib/knowledge-packs/knowledgePackSourceService";
import { fetchKnowledgePackUrlSafe } from "@/lib/knowledge-packs/knowledgePackSourceUrlGuard";
import { prisma } from "@/lib/prisma";

export async function collectKnowledgePackSource(
  userId: string,
  sourceId: string
): Promise<{ ok: true; plainLength: number; warnings: readonly string[] } | { ok: false; message: string }> {
  const source = await getSourceOwnedByUser(sourceId, userId);
  if (!source) return { ok: false, message: "원천자료를 찾을 수 없습니다." };
  if (source.status === KP_SOURCE_STATUS.DISABLED) return { ok: false, message: "비활성화된 원천자료입니다." };

  const job = await prisma.kpKnowledgePackIndexJob.create({
    data: {
      knowledgePackId: source.knowledgePackId,
      sourceId,
      step: KP_INDEX_JOB_STEP.COLLECT,
      status: KP_INDEX_JOB_STATUS.RUNNING,
      message: "",
      createdBy: userId,
      startedAt: new Date(),
    },
  });

  try {
    await prisma.kpKnowledgePackSource.update({
      where: { id: sourceId },
      data: { status: KP_SOURCE_STATUS.COLLECTING, lastError: null },
    });

    const st = source.sourceType;
    let raw = "";
    let ct = "text/plain; charset=utf-8";

    if (st === "URL" || st === "API_REFERENCE" || (st === "OPENAPI" && (source.url ?? "").trim())) {
      const url = (source.url ?? "").trim();
      if (!url) throw new Error("URL이 없습니다.");
      const f = await fetchKnowledgePackUrlSafe(url);
      if (!f.ok) throw new Error(f.message);
      raw = f.body;
      ct = f.contentType;
    } else {
      raw = source.rawText ?? "";
      if (!raw.trim()) throw new Error("저장된 본문이 없습니다.");
    }

    const parsed = parseKnowledgePackDocument({ raw, contentType: ct, sourceType: st });
    const titlePatch = parsed.title && parsed.title !== source.title ? { title: parsed.title } : {};

    await prisma.kpKnowledgePackSource.update({
      where: { id: sourceId },
      data: {
        ...titlePatch,
        lastCollectedText: parsed.plainText,
        lastContentType: ct.slice(0, 200),
        lastCollectedAt: new Date(),
        status: KP_SOURCE_STATUS.PARSED,
        lastError: null,
      },
    });

    await prisma.kpKnowledgePackIndexJob.update({
      where: { id: job.id },
      data: {
        status: KP_INDEX_JOB_STATUS.SUCCESS,
        message: `수집 완료 (${parsed.plainText.length}자)`,
        finishedAt: new Date(),
      },
    });

    return { ok: true, plainLength: parsed.plainText.length, warnings: parsed.warnings };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "수집 중 오류가 발생했습니다.";
    await prisma.kpKnowledgePackSource.update({
      where: { id: sourceId },
      data: { status: KP_SOURCE_STATUS.FAILED, lastError: msg },
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
