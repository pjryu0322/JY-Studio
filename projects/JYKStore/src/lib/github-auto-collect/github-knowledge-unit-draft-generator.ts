import type { SourceFormat, SourceType } from "@prisma/client";
import type { GitHubProductType } from "./github-auto-collect-types";

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

function buildDraftContent(params: {
  draftTitle: string;
  sourceTitle: string;
  sourcePath: string | null;
  sourceDocumentId: string;
  sourceUrl: string | null;
  bullets: string[];
  sourceType: SourceType;
}): string {
  const pathLabel = params.sourcePath ?? params.sourceTitle;
  const bulletBlock =
    params.bullets.length > 0
      ? params.bullets.map((b) => `- ${b}`).join("\n")
      : "- 문서에서 추출한 핵심 개념을 검토합니다.";

  return [
    "## 목적",
    `이 Knowledge Unit은 \`${pathLabel}\` SourceDocument에서 추출한 「${params.draftTitle}」 초안입니다.`,
    "",
    "## 핵심 내용",
    bulletBlock,
    "",
    "## AI 활용 기준",
    "- 구현 프롬프트에 포함할 수 있는 공식 제품지식 후보",
    `- sourceType(${params.sourceType})에 맞는 표현·용어를 유지했는지 검토`,
    "- 라이선스·버전·환경 조건을 확인한 뒤 승인",
    "",
    "## 출처",
    `- SourceDocument: ${params.sourceDocumentId}`,
    params.sourceUrl ? `- URL: ${params.sourceUrl}` : "- URL: (없음)",
  ].join("\n");
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
  const headings = doc.sourceFormat === "MARKDOWN" ? extractMarkdownHeadings(content) : [];
  const pathTitle = inferTitleFromPath(sourcePath);
  const titles: string[] = [];

  if (pathTitle) titles.push(pathTitle);
  for (const heading of headings) {
    if (!titles.includes(heading)) titles.push(heading);
  }
  for (const fallback of defaultTitlesForSourceType(doc.sourceType)) {
    if (!titles.includes(fallback)) titles.push(fallback);
  }

  const isCode =
    doc.sourceFormat === "CODE" ||
    doc.sourceType === "SAMPLE_CODE" ||
    (sourcePath ? /\.(ts|tsx|js|jsx|java|py|go)$/i.test(sourcePath) : false);

  const candidates: DraftCandidate[] = [];
  const maxPerDoc = isCode ? 2 : 4;

  for (let i = 0; i < Math.min(titles.length, maxPerDoc); i += 1) {
    const title = titles[i]!;
    const section = headings.includes(title) ? title : pathTitle === title ? sourcePath : title;
    const bullets = isCode
      ? sampleCodeBullets(content, sourcePath)
      : [
          `${doc.title} 문서의 「${title}」 관련 요약`,
          content.split(/\r?\n/).find((l) => l.trim().length > 10)?.trim().slice(0, 120) ??
            "본문 heading/문단을 기준으로 검토 포인트를 정리합니다.",
        ];

    const unitSlug = slugify(`${title}-${i}`);
    candidates.push({
      sourceDocumentId: doc.id,
      unitSlug,
      title: title.length > 120 ? title.slice(0, 120) : title,
      section: typeof section === "string" ? section.slice(0, 200) : null,
      content: ensureChunkContentLength(
        buildDraftContent({
          draftTitle: title,
          sourceTitle: doc.title,
          sourcePath,
          sourceDocumentId: doc.id,
          sourceUrl: doc.sourceUrl,
          bullets,
          sourceType: doc.sourceType,
        }),
      ),
      tags: [
        "github-auto-collect",
        "knowledge-unit-draft",
        doc.sourceType.toLowerCase(),
        ...(productProfileType ? [productProfileType.toLowerCase()] : []),
      ].slice(0, 10),
      score: scoreCandidate(title, sourcePath, i),
      sourcePath,
      sourceUrl: doc.sourceUrl,
      sourceType: doc.sourceType,
      sourceFormat: doc.sourceFormat,
      evidenceHeadings: headings.slice(0, 5),
      evidenceKeywords: bullets.slice(0, 5).map((b) => b.slice(0, 80)),
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
    evidence: {
      path: params.sourcePath,
      headings: params.evidenceHeadings,
      keywords: params.evidenceKeywords,
    },
  };
}
