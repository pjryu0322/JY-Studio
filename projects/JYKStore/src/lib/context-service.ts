import { PackStatus } from "@prisma/client";
import { rankKnowledgeChunks } from "@/lib/chunk-search-service";
import { buildPackContextResponse } from "@/lib/context-dto";
import type { PackContextResponseDto, RankedContextChunk } from "@/lib/context-dto";
import { prisma } from "@/lib/prisma";
import { tokenizeSearchQuery } from "@/lib/search-utils";

export type ContextServiceDeps = {
  prismaClient?: typeof prisma;
};

const publishedStatuses = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

const DEFAULT_INSTRUCTIONS = [
  "지식팩에 포함된 청크를 우선 근거로 답변합니다.",
  "출처가 없는 내용은 추정임을 명시합니다.",
  "오류코드는 코드와 대응 방법을 함께 설명합니다.",
];

export async function getPackContext(
  input: {
    packId: string;
    query?: string;
    limit?: number;
    includeMetadata?: boolean;
    requestId: string;
  },
  deps: ContextServiceDeps = {},
): Promise<PackContextResponseDto | null> {
  const db = deps.prismaClient ?? prisma;
  const pack = await db.knowledgePack.findFirst({
    where: {
      packId: input.packId,
      status: { in: [...publishedStatuses] },
    },
    include: {
      category: true,
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!pack || pack.versions.length === 0) {
    return null;
  }

  const version = pack.versions[0];
  const searchQuery = input.query?.trim() ?? "";
  const limit = input.limit ?? 20;
  const includeMetadata = input.includeMetadata ?? true;
  const tokens = tokenizeSearchQuery(searchQuery);

  const candidates = await db.knowledgeChunk.findMany({
    where: {
      versionId: version.id,
      isActive: true,
      ...(tokens.length > 0
        ? {
            OR: tokens.flatMap((token) => [
              { title: { contains: token, mode: "insensitive" as const } },
              { content: { contains: token, mode: "insensitive" as const } },
              { section: { contains: token, mode: "insensitive" as const } },
              { chunkType: { contains: token, mode: "insensitive" as const } },
              { tags: { has: token } },
            ]),
          }
        : {}),
    },
    include: {
      sourceDocument: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: tokens.length > 0 ? Math.max(limit * 5, 50) : limit,
  });

  let rankedChunks: RankedContextChunk[];
  if (tokens.length > 0) {
    rankedChunks = rankKnowledgeChunks(candidates, searchQuery)
      .filter((ranked) => ranked.score > 0)
      .slice(0, limit)
      .map((ranked) => ({
        chunk: ranked.item,
        score: ranked.score,
        matchReasons: ranked.matchReasons,
      }));
  } else {
    rankedChunks = candidates.map((chunk) => ({ chunk }));
  }

  const summary = version.overview || pack.shortDescription;
  const instructions = version.features.length > 0 ? version.features.slice(0, 5) : DEFAULT_INSTRUCTIONS;

  return buildPackContextResponse({
    pack,
    versionLabel: version.version,
    summary,
    instructions,
    chunks: rankedChunks,
    includeMetadata,
    requestId: input.requestId,
  });
}

export function parseContextLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

export function parseIncludeMetadata(raw: string | null): boolean {
  if (raw === null) return true;
  return raw.toLowerCase() !== "false";
}
