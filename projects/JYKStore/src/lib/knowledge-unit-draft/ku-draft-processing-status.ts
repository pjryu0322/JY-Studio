import { SOURCE_DOCUMENT_MIN_CONTENT_LENGTH } from "@/lib/github-auto-collect/github-knowledge-unit-draft-options";
import { extractGitHubPathFromSourceUrl } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import type { KuGenerationDocumentOutcome } from "./ku-draft-generation-report";

export type KuDocumentProcessingStatus = "generated" | "deduped" | "excluded" | "failed";

/** @deprecated Use KuDocumentProcessingStatus */
export type LegacyKuDocumentProcessingStatus = "completed" | "pending" | "excluded";

export type KuDocumentProcessingItem = {
  sourceDocumentId: string;
  path: string;
  title: string;
  status: KuDocumentProcessingStatus;
  reason?: string;
  generatedUnitTitles: string[];
  duplicateOfChunkId?: string;
  steps: string[];
};

export type KuProcessingSummary = {
  sourceDocumentTotal: number;
  documentsGenerated: number;
  documentsDeduped: number;
  excluded: number;
  failed: number;
  progressPercent: number;
  generationScope?: string;
  isPreviewGeneration?: boolean;
};

type SourceDocInput = {
  id: string;
  title: string;
  sourceUrl: string | null;
  fileName: string | null;
  content: string | null;
  validationStatus: string;
  validationSummary: string | null;
};

function inferExcludedReason(doc: SourceDocInput): string | null {
  const path =
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ?? doc.fileName?.replace(/\\/g, "/") ?? doc.title;
  const norm = path.toLowerCase();

  if (doc.validationStatus === "FAIL") {
    return doc.validationSummary?.trim() || "원천 문서 검증 실패";
  }
  if (!doc.content?.trim()) {
    return "본문이 비어 있음";
  }
  if (doc.content.trim().length < SOURCE_DOCUMENT_MIN_CONTENT_LENGTH) {
    return "본문이 너무 짧음";
  }
  if (!doc.sourceUrl?.startsWith("https://github.com/")) {
    return "GitHub 원천이 아님";
  }
  if (norm.endsWith("package.json")) {
    return "메타데이터 파일";
  }
  if (norm.endsWith("package-lock.json") || norm.endsWith("yarn.lock")) {
    return "의존성 잠금 파일";
  }
  return null;
}

export function getKuSourceDocumentExclusionReason(doc: SourceDocInput): string | null {
  return inferExcludedReason(doc);
}

function buildStepsFromDrafts(path: string, titles: string[]): string[] {
  if (titles.length === 0) return [`${path}`];
  if (titles.length === 1) {
    return [`${path}`, `${titles[0]} 생성`, "PASS"];
  }
  return [`${path}`, `${titles.length}개의 Unit 생성`, titles.join(" · ")];
}

function resolveDocumentStatus(
  doc: SourceDocInput,
  pendingTitles: string[],
  reportOutcome: KuGenerationDocumentOutcome | undefined,
): KuDocumentProcessingItem {
  const path =
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ??
    doc.fileName?.replace(/\\/g, "/") ??
    doc.title;
  const excludeReason = inferExcludedReason(doc);

  if (excludeReason) {
    return {
      sourceDocumentId: doc.id,
      path,
      title: doc.title,
      status: "excluded",
      reason: excludeReason,
      generatedUnitTitles: [],
      steps: [`${path}`, "Knowledge Unit 생성 안 함", `사유: ${excludeReason}`],
    };
  }

  if (reportOutcome) {
    const titles =
      pendingTitles.length > 0 ? pendingTitles : reportOutcome.generatedUnitTitles;
    return {
      sourceDocumentId: doc.id,
      path,
      title: doc.title,
      status: reportOutcome.status,
      reason: reportOutcome.reason,
      generatedUnitTitles: titles,
      duplicateOfChunkId: reportOutcome.duplicateOfChunkId,
      steps: reportOutcome.steps.length > 0 ? reportOutcome.steps : buildStepsFromDrafts(path, titles),
    };
  }

  if (pendingTitles.length > 0) {
    return {
      sourceDocumentId: doc.id,
      path,
      title: doc.title,
      status: "generated",
      generatedUnitTitles: pendingTitles,
      steps: buildStepsFromDrafts(path, pendingTitles),
    };
  }

  return {
    sourceDocumentId: doc.id,
    path,
    title: doc.title,
    status: "failed",
    reason: "Knowledge Unit이 없습니다. AI 추출을 실행하세요.",
    generatedUnitTitles: [],
    steps: [`${path}`, "처리 실패", "Knowledge Unit 없음"],
  };
}

export function buildKuProcessingSummary(
  documents: SourceDocInput[],
  draftsByDocumentId: Map<string, { title: string; reviewStatus: string }[]>,
  options?: {
    reportByDocumentId?: Map<string, KuGenerationDocumentOutcome>;
    generationScope?: string;
    isPreviewGeneration?: boolean;
  },
): { summary: KuProcessingSummary; documents: KuDocumentProcessingItem[] } {
  const reportByDocumentId = options?.reportByDocumentId;
  const items: KuDocumentProcessingItem[] = [];
  let documentsGenerated = 0;
  let documentsDeduped = 0;
  let excluded = 0;
  let failed = 0;

  for (const doc of documents) {
    const pendingTitles = (draftsByDocumentId.get(doc.id) ?? [])
      .filter((d) => d.reviewStatus === "pending_review")
      .map((d) => d.title);
    const item = resolveDocumentStatus(doc, pendingTitles, reportByDocumentId?.get(doc.id));

    if (item.status === "generated") documentsGenerated += 1;
    else if (item.status === "deduped") documentsDeduped += 1;
    else if (item.status === "excluded") excluded += 1;
    else if (item.status === "failed") failed += 1;

    items.push(item);
  }

  const total = documents.length;
  const handled = documentsGenerated + documentsDeduped + excluded;
  const progressPercent = total === 0 ? 0 : Math.round((handled / total) * 100);

  return {
    summary: {
      sourceDocumentTotal: total,
      documentsGenerated,
      documentsDeduped,
      excluded,
      failed,
      progressPercent,
      generationScope: options?.generationScope,
      isPreviewGeneration: options?.isPreviewGeneration,
    },
    documents: items,
  };
}

export function groupKuDraftsByTopic<T extends { title: string; section: string | null }>(
  drafts: T[],
): { topic: string; items: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const draft of drafts) {
    const topic = inferTopicGroup(draft.title, draft.section);
    const bucket = groups.get(topic) ?? [];
    bucket.push(draft);
    groups.set(topic, bucket);
  }

  return [...groups.entries()]
    .map(([topic, items]) => ({ topic, items }))
    .sort((a, b) => a.topic.localeCompare(b.topic, "ko"));
}

function inferTopicGroup(title: string, section: string | null): string {
  const probe = `${title} ${section ?? ""}`.toLowerCase();
  if (probe.includes("설치") || probe.includes("install") || probe.includes("getting-started")) {
    return "설치";
  }
  if (probe.includes("import") || probe.includes("quick")) return "시작하기";
  if (probe.includes("grid")) return "Grid";
  if (probe.includes("column")) return "Column";
  if (probe.includes("editor")) return "Editor";
  if (probe.includes("renderer")) return "Renderer";
  if (probe.includes("tree")) return "Tree";
  if (probe.includes("theme")) return "Theme";
  if (probe.includes("event")) return "Event";
  if (probe.includes("api") || probe.includes("openapi")) return "API";
  if (probe.includes("example") || probe.includes("예제")) return "Example";
  if (probe.includes("개요") || probe.includes("readme")) return "제품 개요";
  return title.trim() || "기타";
}
