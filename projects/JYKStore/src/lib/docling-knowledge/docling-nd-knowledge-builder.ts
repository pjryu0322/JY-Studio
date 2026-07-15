import type { Prisma } from "@prisma/client";
import { splitContentToChunks } from "@/lib/chunk-pipeline-service";
import {
  DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { prisma } from "@/lib/prisma";
import { fixLoneSurrogates, sliceUtf16Safe } from "@/lib/text-encoding-safe";

const MAX_UNIT_CHARS = 6000;
const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 40;

type NdSection = {
  id?: string;
  title?: string | null;
  text?: string | null;
  label?: string | null;
  page?: number | null;
  children?: NdSection[];
};

type NdTable = {
  id?: string;
  caption?: string | null;
  data?: unknown;
};

type NdFigure = {
  id?: string;
  caption?: string | null;
  altText?: string | null;
  page?: number | null;
  pageNumber?: number | null;
  classification?: string | null;
};

function asSections(value: unknown): NdSection[] {
  return Array.isArray(value) ? (value as NdSection[]) : [];
}

function asTables(value: unknown): NdTable[] {
  return Array.isArray(value) ? (value as NdTable[]) : [];
}

function asFigures(value: unknown): NdFigure[] {
  return Array.isArray(value) ? (value as NdFigure[]) : [];
}

function clamp(text: string, max: number): string {
  const t = fixLoneSurrogates(text.replace(/\s+/g, " ").trim());
  if (t.length <= max) return t;
  return `${sliceUtf16Safe(t, max - 1).trimEnd()}…`;
}

function walkSections(
  sections: NdSection[],
  visit: (section: NdSection, path: string[]) => void,
  path: string[] = [],
): void {
  for (const section of sections) {
    const title = section.title?.trim() || section.text?.trim()?.slice(0, 40) || "섹션";
    const nextPath = [...path, title];
    visit(section, nextPath);
    if (Array.isArray(section.children) && section.children.length > 0) {
      walkSections(section.children, visit, nextPath);
    }
  }
}

function tablePreviewText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const rows = (data as { previewRows?: string[][] }).previewRows;
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .slice(0, 6)
    .map((r) => (Array.isArray(r) ? r.join(" | ") : ""))
    .filter(Boolean)
    .join("\n");
}

export type DoclingKnowledgeBuildResult = {
  unitCount: number;
  chunkCount: number;
  excludedCount: number;
  mergedCount: number;
  warnings: string[];
  byType: Record<string, number>;
};

/**
 * Build Knowledge Units (inactive draft chunks) and Retrieval Chunks (active)
 * from an active NormalizedDocument. Replaces prior Docling-generated chunks.
 */
export async function buildKnowledgeFromNormalizedDocument(input: {
  versionId: string;
  normalizedDocumentId: string;
  fingerprint: string | null;
  title: string | null;
  sectionsJson: unknown;
  tablesJson: unknown;
  figuresJson: unknown;
}): Promise<DoclingKnowledgeBuildResult> {
  const warnings: string[] = [];
  const byType: Record<string, number> = {};
  let excludedCount = 0;
  let mergedCount = 0;

  const unitCreates: Prisma.KnowledgeChunkCreateManyInput[] = [];
  const sections = asSections(input.sectionsJson);
  const tables = asTables(input.tablesJson);
  const figures = asFigures(input.figuresJson);

  walkSections(sections, (section, path) => {
    const text = (section.text ?? "").trim();
    const title = (section.title ?? "").trim() || path[path.length - 1] || "본문";
    if (!text || text.length < MIN_CHUNK_CHARS) {
      excludedCount += 1;
      return;
    }
    const label = (section.label ?? "").toLowerCase();
    const unitType =
      label.includes("list")
        ? "사용 절차"
        : label.includes("header")
          ? "개념 설명"
          : "기능 설명";
    byType[unitType] = (byType[unitType] ?? 0) + 1;
    unitCreates.push({
      versionId: input.versionId,
      chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
      title: clamp(title, 120),
      content: clamp(
        [`경로: ${path.join(" > ")}`, text].join("\n\n"),
        MAX_UNIT_CHARS,
      ),
      section: clamp(path.join(" > "), 200),
      tags: ["docling", unitType],
      sortOrder: unitCreates.length,
      isActive: false,
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType,
        path,
        page: section.page ?? null,
        sourceSectionId: section.id ?? null,
        fingerprint: input.fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
      } as Prisma.InputJsonValue,
    });
  });

  for (const table of tables) {
    const caption = table.caption?.trim() || "표";
    const preview = tablePreviewText(table.data);
    if (!preview) {
      excludedCount += 1;
      continue;
    }
    byType["표 기반 정보"] = (byType["표 기반 정보"] ?? 0) + 1;
    unitCreates.push({
      versionId: input.versionId,
      chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
      title: clamp(caption, 120),
      content: clamp(`표 캡션: ${caption}\n\n${preview}`, MAX_UNIT_CHARS),
      section: "tables",
      tags: ["docling", "표 기반 정보"],
      sortOrder: unitCreates.length,
      isActive: false,
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType: "표 기반 정보",
        tableId: table.id ?? null,
        fingerprint: input.fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
      } as Prisma.InputJsonValue,
    });
  }

  for (const fig of figures) {
    const c = (fig.classification ?? "").toUpperCase();
    if (c === "LOGO" || c === "COVER_IMAGE" || c === "DECORATIVE" || c === "PAGE_RENDER") {
      excludedCount += 1;
      continue;
    }
    const caption = fig.caption?.trim() || fig.altText?.trim();
    if (!caption) {
      excludedCount += 1;
      continue;
    }
    byType["그림 기반 설명"] = (byType["그림 기반 설명"] ?? 0) + 1;
    unitCreates.push({
      versionId: input.versionId,
      chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
      title: clamp(caption, 120),
      content: clamp(
        [
          `그림 설명: ${caption}`,
          fig.pageNumber != null || fig.page != null
            ? `페이지: ${fig.pageNumber ?? fig.page}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        MAX_UNIT_CHARS,
      ),
      section: "figures",
      tags: ["docling", "그림 기반 설명"],
      sortOrder: unitCreates.length,
      isActive: false,
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType: "그림 기반 설명",
        figureId: fig.id ?? null,
        page: fig.pageNumber ?? fig.page ?? null,
        fingerprint: input.fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
      } as Prisma.InputJsonValue,
    });
  }

  if (unitCreates.length === 0 && input.title?.trim()) {
    warnings.push("구조에서 지식 단위를 만들지 못해 문서 제목 기반 단위를 추가했습니다.");
    unitCreates.push({
      versionId: input.versionId,
      chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
      title: clamp(input.title, 120),
      content: clamp(`${input.title}\n\n정규화 문서에서 추출된 기본 지식 단위입니다.`, MAX_UNIT_CHARS),
      section: "document",
      tags: ["docling", "개념 설명"],
      sortOrder: 0,
      isActive: false,
      metadata: {
        generatedBy: "docling-knowledge-pipeline",
        unitType: "개념 설명",
        fingerprint: input.fingerprint,
        normalizedDocumentId: input.normalizedDocumentId,
      } as Prisma.InputJsonValue,
    });
    byType["개념 설명"] = 1;
  }

  // Deactivate previous Docling-generated units/chunks for this version.
  await prisma.knowledgeChunk.updateMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      isActive: true,
    },
    data: { isActive: false },
  });
  await prisma.knowledgeChunk.deleteMany({
    where: {
      versionId: input.versionId,
      chunkType: {
        in: [DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE, DOCLING_RETRIEVAL_CHUNK_TYPE],
      },
      isActive: false,
    },
  });

  if (unitCreates.length > 0) {
    await prisma.knowledgeChunk.createMany({ data: unitCreates });
  }

  const units = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE,
    },
    orderBy: { sortOrder: "asc" },
  });

  const chunkCreates: Prisma.KnowledgeChunkCreateManyInput[] = [];
  for (const unit of units) {
    const parts = splitContentToChunks(unit.content, MAX_CHUNK_CHARS);
    if (parts.length > 1) mergedCount += parts.length - 1;
    parts.forEach((part, index) => {
      if (part.trim().length < MIN_CHUNK_CHARS) {
        excludedCount += 1;
        return;
      }
      chunkCreates.push({
        versionId: input.versionId,
        chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
        title:
          parts.length > 1
            ? clamp(`${unit.title} (${index + 1})`, 120)
            : unit.title,
        content: clamp(part, MAX_CHUNK_CHARS),
        section: unit.section,
        tags: unit.tags,
        sortOrder: chunkCreates.length,
        isActive: true,
        metadata: {
          generatedBy: "docling-knowledge-pipeline",
          knowledgeUnitId: unit.id,
          fingerprint: input.fingerprint,
          normalizedDocumentId: input.normalizedDocumentId,
          draftIndex: true,
        } as Prisma.InputJsonValue,
      });
    });
  }

  if (chunkCreates.length > 0) {
    await prisma.knowledgeChunk.createMany({ data: chunkCreates });
  }

  return {
    unitCount: units.length,
    chunkCount: chunkCreates.length,
    excludedCount,
    mergedCount,
    warnings,
    byType,
  };
}
