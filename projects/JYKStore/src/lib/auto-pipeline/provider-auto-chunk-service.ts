import type { Prisma } from "@prisma/client";
import { AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE } from "@/lib/admin-knowledge-unit-draft-activation-dto";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { prisma } from "@/lib/prisma";
import { readDraftMetadata } from "@/lib/provider-knowledge-unit-draft-dto";

export const AUTO_SOURCE_CHUNK_TYPE = "AUTO_SOURCE_CHUNK";
export const AUTO_PIPELINE_GENERATED_BY = "auto-pipeline";

const MIN_CHUNK_CHARS = 120;
const MAX_CHUNK_CHARS = 4000;
const ELIGIBLE_VALIDATION = new Set(["PASS", "WARNING"]);

export type RegenerateAutoChunksResult =
  | {
      ok: true;
      versionId: string;
      createdChunkCount: number;
      deactivatedChunkCount: number;
      sourceDocumentCount: number;
      coveredSourceDocumentCount: number;
      warnings: string[];
    }
  | {
      error: "NOT_FOUND" | "NO_VERSION" | "NO_SOURCE_DOCUMENTS" | "NO_DRAFTS";
      message: string;
    };

export type RegenerateAutoChunksDeps = {
  prismaClient?: typeof prisma;
};

function metadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function normalizeAndClamp(text: string, min: number, max: number): string {
  let content = text.replace(/\s+/g, " ").trim();
  if (content.length > max) {
    content = `${content.slice(0, max - 1).trimEnd()}…`;
  }
  if (content.length >= min) return content;

  const pad = " 검색·검수에 사용할 수 있도록 원문 근거와 요약을 포함한 지식 단위입니다.";
  while (content.length < min) {
    content = `${content}${pad}`.trim();
    if (content.length > max) {
      content = content.slice(0, max).trimEnd();
      break;
    }
  }
  return content;
}

export function buildRetrievalChunkContent(input: {
  title: string;
  draftContent: string;
  sourceExcerpt?: string | null;
  sourcePath?: string | null;
}): string {
  const parts = [
    `제목: ${input.title}`,
    input.draftContent.trim(),
    input.sourceExcerpt?.trim() ? `원문 근거: ${input.sourceExcerpt.trim()}` : null,
    input.sourcePath?.trim() ? `출처: ${input.sourcePath.trim()}` : null,
  ].filter(Boolean);

  return normalizeAndClamp(parts.join("\n\n"), MIN_CHUNK_CHARS, MAX_CHUNK_CHARS);
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const t = tag.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export async function regenerateAutoChunksForPack(input: {
  packId: string;
  actorClientId?: string;
  mode?: "from_knowledge_unit_drafts" | "from_source_documents" | "hybrid";
  replace?: boolean;
}, deps: RegenerateAutoChunksDeps = {}): Promise<RegenerateAutoChunksResult> {
  const db = deps.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const mode = input.mode ?? "hybrid";
  const replace = input.replace !== false;
  const warnings: string[] = [];

  const pack = await db.knowledgePack.findFirst({
    where: { packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sourceDocuments: true,
          chunks: {
            where: {
              chunkType: {
                in: [
                  AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
                  AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
                  AUTO_SOURCE_CHUNK_TYPE,
                ],
              },
            },
          },
        },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." };
  }

  const version = pack.versions[0];
  if (!version) {
    return { error: "NO_VERSION", message: "버전이 없습니다." };
  }

  const eligibleDocs = version.sourceDocuments.filter((doc) =>
    ELIGIBLE_VALIDATION.has(doc.validationStatus),
  );
  if (eligibleDocs.length === 0) {
    return {
      error: "NO_SOURCE_DOCUMENTS",
      message: "검증 통과(PASS/WARNING) 원천 문서가 없습니다.",
    };
  }

  const pendingDrafts = version.chunks.filter((chunk) => {
    if (chunk.chunkType !== AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE) return false;
    const meta = readDraftMetadata(chunk.metadata);
    return meta.reviewStatus === "pending_review" && Boolean(chunk.sourceDocumentId);
  });

  if (mode === "from_knowledge_unit_drafts" && pendingDrafts.length === 0) {
    return {
      error: "NO_DRAFTS",
      message: "검수용으로 전환할 Knowledge Unit 후보가 없습니다.",
    };
  }

  const eligibleDocIds = new Set(eligibleDocs.map((d) => d.id));
  const draftsByDoc = new Map<string, typeof pendingDrafts>();
  for (const draft of pendingDrafts) {
    const docId = draft.sourceDocumentId!;
    if (!eligibleDocIds.has(docId)) continue;
    const list = draftsByDoc.get(docId) ?? [];
    list.push(draft);
    draftsByDoc.set(docId, list);
  }

  type ChunkCreate = {
    versionId: string;
    sourceDocumentId: string;
    chunkType: string;
    title: string;
    content: string;
    section: string;
    tags: string[];
    metadata: Prisma.InputJsonValue;
    sortOrder: number;
    isActive: true;
  };

  const toCreate: ChunkCreate[] = [];
  const covered = new Set<string>();
  let sortOrder =
    (
      await db.knowledgeChunk.aggregate({
        where: { versionId: version.id },
        _max: { sortOrder: true },
      })
    )._max.sortOrder ?? 0;

  if (mode === "from_knowledge_unit_drafts" || mode === "hybrid") {
    for (const [docId, drafts] of draftsByDoc) {
      const doc = eligibleDocs.find((d) => d.id === docId);
      if (!doc) continue;
      for (const draft of drafts) {
        const meta = readDraftMetadata(draft.metadata);
        const existingMeta = metadataRecord(draft.metadata);
        const title = draft.title.trim() || doc.title;
        const section =
          (meta.topic ?? draft.section ?? title).trim() || title;
        const content = buildRetrievalChunkContent({
          title,
          draftContent: draft.content,
          sourceExcerpt: meta.evidence?.excerpt ?? null,
          sourcePath: meta.sourcePath ?? meta.canonicalSourcePath ?? doc.fileName,
        });
        sortOrder += 1;
        toCreate.push({
          versionId: version.id,
          sourceDocumentId: docId,
          chunkType: AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE,
          title,
          content,
          section,
          tags: uniqueTags([
            ...draft.tags,
            "auto-pipeline",
            "retrieval-ready",
          ]),
          metadata: {
            generatedBy: AUTO_PIPELINE_GENERATED_BY,
            source: "knowledge-unit-draft",
            sourceDocumentId: docId,
            sourcePath: meta.sourcePath ?? meta.canonicalSourcePath ?? doc.fileName,
            sourceUrl: meta.sourceUrl ?? doc.sourceUrl,
            topic: meta.topic,
            semanticTopicKey: meta.semanticTopicKey,
            canonicalSourcePath: meta.canonicalSourcePath,
            generatedAt: new Date().toISOString(),
            draftChunkId: draft.id,
            actorClientId: input.actorClientId ?? null,
            ...("productProfileType" in existingMeta
              ? { productProfileType: existingMeta.productProfileType }
              : {}),
          } as Prisma.InputJsonValue,
          sortOrder,
          isActive: true,
        });
        covered.add(docId);
      }
    }
  }

  if (mode === "from_source_documents" || mode === "hybrid") {
    for (const doc of eligibleDocs) {
      if (covered.has(doc.id)) continue;
      const raw = (doc.content ?? "").trim();
      if (raw.length < 50) {
        warnings.push(`원천 문서 "${doc.title}" 내용이 짧아 fallback chunk를 건너뛰었습니다.`);
        continue;
      }
      const title = doc.title.trim() || "원천 문서";
      const content = buildRetrievalChunkContent({
        title,
        draftContent: raw.slice(0, 2800),
        sourceExcerpt: raw.slice(0, 400),
        sourcePath: doc.fileName ?? doc.sourceUrl,
      });
      sortOrder += 1;
      toCreate.push({
        versionId: version.id,
        sourceDocumentId: doc.id,
        chunkType: AUTO_SOURCE_CHUNK_TYPE,
        title,
        content,
        section: title,
        tags: ["auto-pipeline", "retrieval-ready", "source-fallback"],
        metadata: {
          generatedBy: AUTO_PIPELINE_GENERATED_BY,
          source: "source-document",
          sourceDocumentId: doc.id,
          sourcePath: doc.fileName,
          sourceUrl: doc.sourceUrl,
          topic: title,
          generatedAt: new Date().toISOString(),
          actorClientId: input.actorClientId ?? null,
        } as Prisma.InputJsonValue,
        sortOrder,
        isActive: true,
      });
      covered.add(doc.id);
    }
  }

  if (toCreate.length === 0) {
    return {
      error: "NO_DRAFTS",
      message: "생성할 검수용 Chunk가 없습니다.",
    };
  }

  let deactivatedChunkCount = 0;
  await db.$transaction(async (tx) => {
    if (replace) {
      const deactivated = await tx.knowledgeChunk.updateMany({
        where: {
          versionId: version.id,
          chunkType: { in: [AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE, AUTO_SOURCE_CHUNK_TYPE] },
          isActive: true,
        },
        data: { isActive: false },
      });
      deactivatedChunkCount = deactivated.count;
    }

    for (const row of toCreate) {
      await tx.knowledgeChunk.create({ data: row });
    }
  });

  if (covered.size < eligibleDocs.length) {
    warnings.push(
      `${eligibleDocs.length - covered.size}개 원천 문서는 검수용 Chunk 커버리지에서 제외되었습니다.`,
    );
  }

  return {
    ok: true,
    versionId: version.id,
    createdChunkCount: toCreate.length,
    deactivatedChunkCount,
    sourceDocumentCount: eligibleDocs.length,
    coveredSourceDocumentCount: covered.size,
    warnings,
  };
}
