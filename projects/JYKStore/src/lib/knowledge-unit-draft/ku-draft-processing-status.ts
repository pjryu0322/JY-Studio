import { SOURCE_DOCUMENT_MIN_CONTENT_LENGTH } from "@/lib/github-auto-collect/github-knowledge-unit-draft-options";
import { extractGitHubPathFromSourceUrl } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";

export type KuDocumentProcessingStatus = "completed" | "pending" | "excluded";

export type KuDocumentProcessingItem = {
  sourceDocumentId: string;
  path: string;
  title: string;
  status: KuDocumentProcessingStatus;
  reason?: string;
  generatedUnitTitles: string[];
  steps: string[];
};

export type KuProcessingSummary = {
  sourceDocumentTotal: number;
  generatedComplete: number;
  analysisPending: number;
  excluded: number;
  progressPercent: number;
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

export function buildKuProcessingSummary(
  documents: SourceDocInput[],
  draftsByDocumentId: Map<string, { title: string; reviewStatus: string }[]>,
): { summary: KuProcessingSummary; documents: KuDocumentProcessingItem[] } {
  const items: KuDocumentProcessingItem[] = [];
  let generatedComplete = 0;
  let analysisPending = 0;
  let excluded = 0;

  for (const doc of documents) {
    const path =
      extractGitHubPathFromSourceUrl(doc.sourceUrl) ??
      doc.fileName?.replace(/\\/g, "/") ??
      doc.title;
    const drafts = (draftsByDocumentId.get(doc.id) ?? []).filter(
      (d) => d.reviewStatus === "pending_review",
    );
    const excludeReason = inferExcludedReason(doc);

    let status: KuDocumentProcessingStatus;
    let reason: string | undefined;
    const steps: string[] = [];
    const generatedUnitTitles = drafts.map((d) => d.title);

    if (excludeReason) {
      status = "excluded";
      reason = excludeReason;
      excluded += 1;
      steps.push(`${path}`, "Knowledge Unit 생성 안 함", `사유: ${excludeReason}`);
    } else if (drafts.length > 0) {
      status = "completed";
      generatedComplete += 1;
      steps.push(`${path}`);
      if (generatedUnitTitles.length === 1) {
        steps.push(`${generatedUnitTitles[0]} 생성`, "PASS");
      } else {
        steps.push(`${generatedUnitTitles.length}개의 Unit 생성`, generatedUnitTitles.join(" · "));
      }
    } else {
      status = "pending";
      analysisPending += 1;
      steps.push(`${path}`, "분석 대기");
    }

    items.push({
      sourceDocumentId: doc.id,
      path,
      title: doc.title,
      status,
      reason,
      generatedUnitTitles,
      steps,
    });
  }

  const total = documents.length;
  const progressPercent = total === 0 ? 0 : Math.round((generatedComplete / total) * 100);

  return {
    summary: {
      sourceDocumentTotal: total,
      generatedComplete,
      analysisPending,
      excluded,
      progressPercent,
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
