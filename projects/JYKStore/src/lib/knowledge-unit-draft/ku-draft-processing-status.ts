import { extractGitHubPathFromSourceUrl } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import type { KuGenerationDocumentOutcome } from "./ku-draft-generation-report";
import {
  classifySourceDocumentForKuGeneration,
  labelForKuSkipReasonCode,
  mapServiceSkipReasonToCode,
  normalizeKuDocumentProcessingStatus,
  type KuDocumentSkipReasonCode,
} from "./ku-draft-skip-reasons";

export type KuDocumentProcessingStatus =
  | "generated"
  | "duplicate"
  | "excluded"
  | "unsupported"
  | "failed";

export type KuDocumentProcessingItem = {
  sourceDocumentId: string;
  path: string;
  title: string;
  status: KuDocumentProcessingStatus;
  reasonCode?: KuDocumentSkipReasonCode | "DRAFT_PERSIST_FAILED" | "SOURCE_DOCUMENT_NOT_FOUND";
  reason?: string;
  generatedUnitTitles: string[];
  duplicateOfChunkId?: string;
  steps: string[];
};

export type KuProcessingSummary = {
  sourceDocumentTotal: number;
  generated: number;
  duplicate: number;
  excluded: number;
  unsupported: number;
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
  sourceFormat?: string;
  mimeType?: string | null;
};

function docPath(doc: SourceDocInput): string {
  return (
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ??
    doc.fileName?.replace(/\\/g, "/") ??
    doc.title
  );
}

function buildStepsFromDrafts(path: string, titles: string[]): string[] {
  if (titles.length === 0) return [`${path}`];
  if (titles.length === 1) {
    return [`${path}`, `${titles[0]} 생성`, "PASS"];
  }
  return [`${path}`, `${titles.length}개의 Unit 생성`, titles.join(" · ")];
}

function outcomeFromClassification(
  doc: SourceDocInput,
  classification: NonNullable<ReturnType<typeof classifySourceDocumentForKuGeneration>>,
): KuDocumentProcessingItem {
  const path = docPath(doc);
  const reason = labelForKuSkipReasonCode(classification.reasonCode);
  return {
    sourceDocumentId: doc.id,
    path,
    title: doc.title,
    status: classification.status,
    reasonCode: classification.reasonCode,
    reason,
    generatedUnitTitles: [],
    steps: [path, "Knowledge Unit 생성 안 함", `사유: ${reason}`],
  };
}

function resolveDocumentStatus(
  doc: SourceDocInput,
  pendingTitles: string[],
  reportOutcome: KuGenerationDocumentOutcome | undefined,
): KuDocumentProcessingItem {
  const path = docPath(doc);

  if (reportOutcome) {
    const status = normalizeKuDocumentProcessingStatus(reportOutcome.status);
    if (status === "generated" || status === "duplicate" || status === "failed") {
      const titles =
        pendingTitles.length > 0 ? pendingTitles : reportOutcome.generatedUnitTitles;
      return {
        sourceDocumentId: doc.id,
        path,
        title: doc.title,
        status,
        reasonCode: reportOutcome.reasonCode,
        reason: reportOutcome.reason,
        generatedUnitTitles: titles,
        duplicateOfChunkId: reportOutcome.duplicateOfChunkId,
        steps:
          reportOutcome.steps.length > 0 ? reportOutcome.steps : buildStepsFromDrafts(path, titles),
      };
    }
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

  const classification = classifySourceDocumentForKuGeneration(doc);
  if (classification) {
    return outcomeFromClassification(doc, classification);
  }

  if (reportOutcome) {
    const status = normalizeKuDocumentProcessingStatus(reportOutcome.status);
    const titles = reportOutcome.generatedUnitTitles;
    return {
      sourceDocumentId: doc.id,
      path,
      title: doc.title,
      status,
      reasonCode: reportOutcome.reasonCode,
      reason: reportOutcome.reason,
      generatedUnitTitles: titles,
      duplicateOfChunkId: reportOutcome.duplicateOfChunkId,
      steps: reportOutcome.steps.length > 0 ? reportOutcome.steps : buildStepsFromDrafts(path, titles),
    };
  }

  return {
    sourceDocumentId: doc.id,
    path,
    title: doc.title,
    status: "excluded",
    reasonCode: "NO_KNOWLEDGE_TOPIC",
    reason: labelForKuSkipReasonCode("NO_KNOWLEDGE_TOPIC"),
    generatedUnitTitles: [],
    steps: [path, "Knowledge Unit 생성 안 함", labelForKuSkipReasonCode("NO_KNOWLEDGE_TOPIC")],
  };
}

export function kuDocumentStatusUserHint(status: KuDocumentProcessingStatus): string {
  switch (status) {
    case "generated":
      return "이 문서에서 AI 추출 Unit이 생성되었습니다.";
    case "duplicate":
      return "동일/유사한 Unit이 이미 있어 새로 만들지 않았습니다.";
    case "excluded":
      return "지식팩 품질을 위해 Unit으로 만들지 않았습니다. (라이선스, 변경 이력, 메타데이터 등)";
    case "unsupported":
      return "현재 지식화 대상 형식이 아닙니다. (이미지, 바이너리, 비대상 코드 등)";
    case "failed":
      return "시스템 오류입니다. 재시도 또는 개발자 확인이 필요합니다.";
    default:
      return "";
  }
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
  let generated = 0;
  let duplicate = 0;
  let excluded = 0;
  let unsupported = 0;
  let failed = 0;

  for (const doc of documents) {
    const pendingTitles = (draftsByDocumentId.get(doc.id) ?? [])
      .filter((d) => d.reviewStatus === "pending_review")
      .map((d) => d.title);
    const item = resolveDocumentStatus(doc, pendingTitles, reportByDocumentId?.get(doc.id));

    if (item.status === "generated") generated += 1;
    else if (item.status === "duplicate") duplicate += 1;
    else if (item.status === "excluded") excluded += 1;
    else if (item.status === "unsupported") unsupported += 1;
    else if (item.status === "failed") failed += 1;

    items.push(item);
  }

  const total = documents.length;
  const processed = generated + duplicate + excluded + unsupported + failed;
  const progressPercent = total === 0 ? 0 : Math.round((processed / total) * 100);

  return {
    summary: {
      sourceDocumentTotal: total,
      generated,
      duplicate,
      excluded,
      unsupported,
      failed,
      progressPercent,
      generationScope: options?.generationScope,
      isPreviewGeneration: options?.isPreviewGeneration,
    },
    documents: items,
  };
}

export function buildKuProcessingNarrative(summary: KuProcessingSummary): string {
  const total = summary.sourceDocumentTotal;
  const nonGenerated = summary.duplicate + summary.excluded + summary.unsupported;

  if (summary.failed > 0) {
    return `AI가 ${total}개 원천 문서를 분석했습니다. ${summary.generated}개 문서에서 Knowledge Unit을 생성했고, ${nonGenerated}개 문서는 생성·중복·지원 제외 처리했습니다. ${summary.failed}개 문서는 처리 중 오류가 발생했습니다. 상세 보기를 확인하세요.`;
  }

  if (summary.generated === 0 && nonGenerated > 0) {
    return `AI가 ${total}개 원천 문서를 분석했습니다. Knowledge Unit으로 만들 문서는 없었고, ${nonGenerated}개 문서는 메타데이터·라이선스·지원 제외 등으로 생성하지 않았습니다. 실제 처리 실패는 없습니다.`;
  }

  return `AI가 ${total}개 원천 문서를 분석했습니다. 이 중 ${summary.generated}개 문서에서 Knowledge Unit을 생성했고, ${nonGenerated}개 문서는 메타데이터·라이선스·지원 제외 등으로 생성하지 않았습니다. 실제 처리 실패는 없습니다.`;
}

/** @deprecated use classifySourceDocumentForKuGeneration */
export function getKuSourceDocumentExclusionReason(doc: SourceDocInput): string | null {
  const result = classifySourceDocumentForKuGeneration(doc);
  return result ? labelForKuSkipReasonCode(result.reasonCode) : null;
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

export function skipCodeFromServiceReason(reason: string): KuDocumentSkipReasonCode {
  return mapServiceSkipReasonToCode(reason);
}
