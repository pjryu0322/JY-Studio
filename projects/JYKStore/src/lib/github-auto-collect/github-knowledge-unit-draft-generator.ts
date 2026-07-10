import type { SourceFormat, SourceType } from "@prisma/client";
import type { GitHubProductType, KnowledgeUnitGenerationScope } from "./github-auto-collect-types";
import { buildUserFacingKuDraftContent } from "@/lib/knowledge-unit-draft/ku-draft-content";
import { computeKuDraftContentChecksum } from "@/lib/knowledge-unit-draft/ku-draft-dedup";

export const AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE = "AUTO_KNOWLEDGE_UNIT_DRAFT";

export type SourceDocumentDraftInput = {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceFormat: SourceFormat;
  sourceUrl: string | null;
  fileName: string | null;
  content: string | null;
};

export type DraftCandidate = {
  sourceDocumentId: string;
  unitSlug: string;
  title: string;
  section: string | null;
  content: string;
  tags: string[];
  score: number;
  sourcePath: string | null;
  sourceUrl: string | null;
  sourceType: SourceType;
  sourceFormat: SourceFormat;
  evidenceHeadings: string[];
  evidenceKeywords: string[];
  topic: string;
  primaryHeading: string | null;
  sourceExcerpt: string | null;
  contentChecksum: string;
};

export function extractGitHubPathFromSourceUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.startsWith("https://github.com/")) return null;
  const blobMatch = sourceUrl.match(/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/(.+?)(?:\?|#|$)/);
  if (blobMatch?.[1]) {
    return decodeURIComponent(blobMatch[1].replace(/\/$/, ""));
  }
  return null;
}

export function extractMarkdownHeadings(content: string, limit = 8): string[] {
  const headings: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line.trim());
    if (!match?.[2]) continue;
    const text = match[2].replace(/[#`*]/g, "").trim();
    if (text.length >= 2) headings.push(text);
    if (headings.length >= limit) break;
  }
  return headings;
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "draft";
}

function inferTitleFromPath(path: string | null): string | null {
  if (!path) return null;
  const norm = path.replace(/\\/g, "/").toLowerCase();
  if (norm === "readme.md" || norm.endsWith("/readme.md")) return "제품 개요";
  if (norm.includes("docs/getting-started")) return "시작하기";
  if (norm.includes("docs/quickstart")) return "빠른 시작";
  if (norm.includes("docs/api") || norm.endsWith("/api.md")) return "API 사용법";
  if (/openapi\.(ya?ml|json)$/i.test(norm)) return "OpenAPI 스키마";
  if (norm.includes("examples/basic")) return "기본 예제";
  if (norm.includes("examples/filter")) return "필터 예제";
  if (norm.includes("examples/sort")) return "정렬 예제";
  if (norm.includes("examples/pagination")) return "페이지네이션 예제";
  if (norm.endsWith("package.json")) return "패키지/설치 정보";
  if (norm.endsWith("application.yml") || norm.endsWith("application.yaml")) {
    return "애플리케이션 설정";
  }
  if (norm.endsWith("dockerfile")) return "컨테이너 실행 설정";
  return null;
}

function defaultTitlesForSourceType(sourceType: SourceType): string[] {
  switch (sourceType) {
    case "PRODUCT_MANUAL":
      return ["제품 개요", "주요 기능", "사용 대상"];
    case "INTEGRATION_GUIDE":
      return ["설치/시작 방법", "기본 사용 흐름", "주요 설정"];
    case "API_SPEC":
      return ["API 개요", "주요 endpoint/객체", "요청·응답 구조"];
    case "OPENAPI_SCHEMA":
      return ["OpenAPI 스키마 개요", "endpoint 그룹", "schema 검토 포인트"];
    case "SAMPLE_CODE":
      return ["예제 목적", "실행/적용 방법", "구현 패턴"];
    case "TEST_ENV_GUIDE":
      return ["테스트 환경 설정", "실행 조건", "검증 방법"];
    case "OPERATION_GUIDE":
      return ["배포/운영 설정", "모니터링/장애 대응"];
    default:
      return ["문서 요약", "재사용 가능한 제품지식"];
  }
}

function sampleCodeBullets(content: string, path: string | null): string[] {
  const lines = content.split(/\r?\n/).slice(0, 30);
  const hints: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^import\s/.test(trimmed)) hints.push(`import 구문: ${trimmed.slice(0, 80)}`);
    if (/^export\s+(async\s+)?function\s+\w+/.test(trimmed)) {
      hints.push(`함수: ${trimmed.slice(0, 80)}`);
    }
    if (/^\/\/|^\/\*/.test(trimmed) && trimmed.length > 4) {
      hints.push(trimmed.replace(/^\/+\*?\s?|\*\/$/g, "").slice(0, 100));
    }
    if (hints.length >= 4) break;
  }
  if (path) hints.unshift(`예제 경로: ${path}`);
  return hints.length > 0 ? hints : ["코드 예제의 목적과 적용 상황을 검토합니다."];
}

export function extractMarkdownTopics(
  content: string,
  limit = 6,
): { heading: string; body: string }[] {
  const lines = content.split(/\r?\n/);
  const topics: { heading: string; body: string }[] = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentHeading) return;
    const body = buffer.join("\n").trim();
    if (body.length >= 20) {
      topics.push({ heading: currentHeading, body });
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = /^#{1,3}\s+(.+?)\s*$/.exec(line.trim());
    if (heading?.[1]) {
      flush();
      currentHeading = heading[1].replace(/[#`*]/g, "").trim();
      if (topics.length >= limit) break;
      continue;
    }
    if (currentHeading) buffer.push(line);
  }
  flush();

  return topics.slice(0, limit);
}

function buildDraftContent(params: {
  draftTitle: string;
  sourceTitle: string;
  sourcePath: string | null;
  topicBody: string;
  sourceType: SourceType;
  relatedUnits: string[];
}): string {
  const pathLabel = params.sourcePath ?? params.sourceTitle;
  const keyPoints = params.topicBody
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 8)
    .slice(0, 6);

  const codeLine = params.topicBody
    .split(/\r?\n/)
    .find((line) => /^(```|import |const |npm |yarn )/.test(line.trim()));

  return buildUserFacingKuDraftContent({
    title: params.draftTitle,
    description: `${pathLabel} 문서에서 「${params.draftTitle}」 주제를 추출했습니다.`,
    keyPoints:
      keyPoints.length > 0
        ? keyPoints
        : [`${params.draftTitle} 관련 핵심 개념을 검토합니다.`, `sourceType: ${params.sourceType}`],
    exampleCode: codeLine?.startsWith("```")
      ? params.topicBody.match(/```[\s\S]*?```/)?.[0]?.replace(/```/g, "").trim() ?? null
      : codeLine ?? null,
    relatedUnits: params.relatedUnits,
  });
}

function ensureChunkContentLength(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length >= 20) return trimmed.slice(0, 4000);
  return `${trimmed}\n\n(검토용 초안 — 내용을 보완해 주세요.)`.slice(0, 4000);
}

function scoreCandidate(title: string, path: string | null, index: number): number {
  let score = 100 - index;
  const pathTitle = inferTitleFromPath(path);
  if (pathTitle && pathTitle === title) score += 50;
  if (title.includes("개요") || title.includes("시작")) score += 20;
  return score;
}

export function buildDraftCandidatesForSourceDocument(
  doc: SourceDocumentDraftInput,
  productProfileType?: GitHubProductType,
): DraftCandidate[] {
  const sourcePath =
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ?? doc.fileName?.replace(/\\/g, "/") ?? null;
  const content = doc.content?.trim() ?? "";
  const isCode =
    doc.sourceFormat === "CODE" ||
    doc.sourceType === "SAMPLE_CODE" ||
    (sourcePath ? /\.(ts|tsx|js|jsx|java|py|go)$/i.test(sourcePath) : false);
  const headings = doc.sourceFormat === "MARKDOWN" ? extractMarkdownHeadings(content) : [];
  const topics =
    doc.sourceFormat === "MARKDOWN" && !isCode ? extractMarkdownTopics(content) : [];

  const pathTitle = inferTitleFromPath(sourcePath);
  const topicSeeds: { title: string; body: string; primaryHeading: string | null }[] = [];

  if (topics.length > 0) {
    for (const topic of topics) {
      topicSeeds.push({ title: topic.heading, body: topic.body, primaryHeading: topic.heading });
    }
  } else {
    const titles: string[] = [];
    if (pathTitle) titles.push(pathTitle);
    for (const heading of headings) {
      if (!titles.includes(heading)) titles.push(heading);
    }
    for (const fallback of defaultTitlesForSourceType(doc.sourceType)) {
      if (!titles.includes(fallback)) titles.push(fallback);
    }
  for (const title of titles) {
      const body = isCode ? sampleCodeBullets(content, sourcePath).join("\n") : content;
      topicSeeds.push({
        title,
        body,
        primaryHeading: headings.includes(title) ? title : null,
      });
    }
  }

  const candidates: DraftCandidate[] = [];
  const maxPerDoc = isCode ? 2 : Math.min(6, topicSeeds.length);

  for (let i = 0; i < Math.min(topicSeeds.length, maxPerDoc); i += 1) {
    const seed = topicSeeds[i]!;
    const title = seed.title.length > 120 ? seed.title.slice(0, 120) : seed.title;
    const section = seed.primaryHeading ?? pathTitle ?? title;
    const relatedUnits = topicSeeds
      .map((t) => t.title)
      .filter((t) => t !== title)
      .slice(0, 3);

    const bodyContent = buildDraftContent({
      draftTitle: title,
      sourceTitle: doc.title,
      sourcePath,
      topicBody: seed.body,
      sourceType: doc.sourceType,
      relatedUnits,
    });

    const unitSlug = slugify(`${title}-${i}`);
    const sourceExcerpt = seed.body.trim().slice(0, 600) || content.slice(0, 600);

    candidates.push({
      sourceDocumentId: doc.id,
      unitSlug,
      title,
      section: typeof section === "string" ? section.slice(0, 200) : null,
      content: ensureChunkContentLength(bodyContent),
      tags: [
        "github-auto-collect",
        "knowledge-unit-draft",
        doc.sourceType.toLowerCase(),
        slugify(title),
        ...(productProfileType ? [productProfileType.toLowerCase()] : []),
      ].slice(0, 10),
      score: scoreCandidate(title, sourcePath, i),
      sourcePath,
      sourceUrl: doc.sourceUrl,
      sourceType: doc.sourceType,
      sourceFormat: doc.sourceFormat,
      evidenceHeadings: headings.slice(0, 5),
      evidenceKeywords: relatedUnits.slice(0, 5),
      topic: title,
      primaryHeading: seed.primaryHeading,
      sourceExcerpt,
      contentChecksum: computeKuDraftContentChecksum(bodyContent),
    });
  }

  if (candidates.length === 0 && content.length >= 20) {
    const fallbackTitle = pathTitle ?? doc.title.slice(0, 80) ?? "문서 요약";
    const bodyContent = buildDraftContent({
      draftTitle: fallbackTitle,
      sourceTitle: doc.title,
      sourcePath,
      topicBody: content,
      sourceType: doc.sourceType,
      relatedUnits: [],
    });
    candidates.push({
      sourceDocumentId: doc.id,
      unitSlug: slugify(fallbackTitle),
      title: fallbackTitle,
      section: fallbackTitle,
      content: ensureChunkContentLength(bodyContent),
      tags: ["github-auto-collect", "knowledge-unit-draft", doc.sourceType.toLowerCase()],
      score: scoreCandidate(fallbackTitle, sourcePath, 0),
      sourcePath,
      sourceUrl: doc.sourceUrl,
      sourceType: doc.sourceType,
      sourceFormat: doc.sourceFormat,
      evidenceHeadings: headings.slice(0, 5),
      evidenceKeywords: [],
      topic: fallbackTitle,
      primaryHeading: headings[0] ?? null,
      sourceExcerpt: content.slice(0, 600),
      contentChecksum: computeKuDraftContentChecksum(bodyContent),
    });
  }

  return candidates;
}

export function selectDraftCandidates(
  candidates: DraftCandidate[],
  targetCount: number,
  maxCount: number,
): DraftCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const limit = Math.min(maxCount, Math.max(targetCount, 1));
  return sorted.slice(0, limit);
}

function pickWithMinimumOnePerDocument(
  candidates: DraftCandidate[],
  maxCount: number,
): DraftCandidate[] {
  if (candidates.length <= maxCount) return candidates;

  const byDoc = new Map<string, DraftCandidate[]>();
  for (const candidate of candidates) {
    const bucket = byDoc.get(candidate.sourceDocumentId) ?? [];
    bucket.push(candidate);
    byDoc.set(candidate.sourceDocumentId, bucket);
  }

  const picked: DraftCandidate[] = [];
  const remainder: DraftCandidate[] = [];

  for (const list of byDoc.values()) {
    const sorted = [...list].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    picked.push(sorted[0]);
    remainder.push(...sorted.slice(1));
  }

  remainder.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  for (const candidate of remainder) {
    if (picked.length >= maxCount) break;
    picked.push(candidate);
  }

  return picked.slice(0, maxCount);
}

export function applyGenerationSafetyLimit(
  candidates: DraftCandidate[],
  options: {
    maxPerRun: number;
    scope: KnowledgeUnitGenerationScope;
    targetCount: number;
  },
): DraftCandidate[] {
  if (options.scope === "limited_preview") {
    return selectDraftCandidates(candidates, options.targetCount, options.maxPerRun);
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const uniqueDocumentCount = new Set(sorted.map((c) => c.sourceDocumentId)).size;
  const effectiveMax = Math.max(options.maxPerRun, uniqueDocumentCount);
  if (sorted.length <= effectiveMax) return sorted;
  return pickWithMinimumOnePerDocument(sorted, effectiveMax);
}

export function buildDraftChunkMetadata(params: {
  unitId: string;
  sourceDocumentId: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  sourceType: SourceType;
  sourceFormat: SourceFormat;
  generationMode: string;
  productProfileType?: GitHubProductType;
  evidenceHeadings: string[];
  evidenceKeywords: string[];
  topic?: string;
  primaryHeading?: string | null;
  sourceExcerpt?: string | null;
  contentChecksum?: string;
  warnings?: string[];
}): Record<string, unknown> {
  return {
    unitId: params.unitId,
    reviewStatus: "pending_review",
    generatedBy: "github-auto-collector",
    generatedAt: new Date().toISOString(),
    sourceDocumentId: params.sourceDocumentId,
    sourceUrl: params.sourceUrl,
    sourcePath: params.sourcePath,
    sourceType: params.sourceType,
    sourceFormat: params.sourceFormat,
    generationMode: params.generationMode,
    ...(params.productProfileType ? { productProfileType: params.productProfileType } : {}),
    ...(params.topic ? { topic: params.topic } : {}),
    ...(params.primaryHeading ? { primaryHeading: params.primaryHeading } : {}),
    ...(params.contentChecksum ? { contentChecksum: params.contentChecksum } : {}),
    ...(params.warnings && params.warnings.length > 0 ? { warnings: params.warnings } : {}),
    evidence: {
      path: params.sourcePath,
      headings: params.evidenceHeadings,
      keywords: params.evidenceKeywords,
      excerpt: params.sourceExcerpt ?? null,
    },
  };
}
