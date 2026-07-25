/**
 * Provider-facing view model for chunk (검색 지식 단위) review.
 * Built from quality metrics + issues + source docs — no DB schema changes.
 */

export type ProviderChunkReviewIssueType =
  | "too_short"
  | "too_long"
  | "missing_context"
  | "duplicate_candidate"
  | "unclear_source"
  | "search_weakness"
  | "other";

export type ProviderChunkReviewStatus = "ok" | "warning" | "needs_action";

export type ProviderChunkReviewItem = {
  chunkId: string;
  title: string;
  sourceFileName: string;
  sourceSectionPath: string[];
  contentPreview: string;
  charCount: number;
  status: ProviderChunkReviewStatus;
  statusLabel: string;
  issueTypes: ProviderChunkReviewIssueType[];
  issueTypeLabels: string[];
  issueReason: string;
  providerActionHint: string;
  sourceDocumentId: string | null;
  relatedIssueCodes: string[];
};

export type ProviderChunkReviewFilter = "all" | "warning" | "needs_action";

/** Max knowledge units per provider PDF export request. */
export const PROVIDER_CHUNK_PDF_EXPORT_MAX = 40;

type RawMetric = {
  chunkId?: string | null;
  sourceDocumentId?: string | null;
  title?: string | null;
  contentLength?: number | null;
  status?: string | null;
  issues?: readonly string[] | null;
};

type RawIssue = {
  severity?: string | null;
  code?: string | null;
  message?: string | null;
  field?: string | null;
  hint?: string | null;
};

type RawSourceDoc = {
  id: string;
  title?: string | null;
  fileName?: string | null;
};

const ISSUE_TYPE_LABELS: Record<ProviderChunkReviewIssueType, string> = {
  too_short: "본문이 짧음",
  too_long: "본문이 김",
  missing_context: "문맥 누락 가능성",
  duplicate_candidate: "중복 가능성",
  unclear_source: "출처 불명확",
  search_weakness: "검색 근거 약함",
  other: "기타 품질 이슈",
};

export const PROVIDER_CHUNK_REVIEW_CHECKLIST: readonly string[] = [
  "원문 내용이 누락 또는 왜곡되지 않았는가",
  "하나의 검색 지식 단위가 하나의 기능·API·개념을 담고 있는가",
  "제목, 설명, 예제, 주의사항이 분리되어 의미가 깨지지 않았는가",
  "본문만으로 검색 답변의 근거가 될 수 있는가",
  "같은 내용이 다른 단위와 불필요하게 중복되지 않았는가",
  "원본 파일과 섹션 위치를 추적할 수 있는가",
];

function mapIssueCodeToType(code: string): ProviderChunkReviewIssueType {
  const c = code.toUpperCase();
  if (c === "SHORT_CHUNK" || c === "EMPTY_CHUNK") return "too_short";
  if (c === "LONG_CHUNK") return "too_long";
  if (
    c === "CHUNK_TITLE_MISSING" ||
    c === "CHUNK_SECTION_MISSING" ||
    c === "CHUNK_STRUCTURE_SECTION_MISSING" ||
    c === "CHUNK_TAGS_MISSING" ||
    c === "CHUNK_METADATA_MISSING"
  ) {
    return "missing_context";
  }
  if (c.includes("DUPLICATE")) return "duplicate_candidate";
  if (c === "ORPHAN_CHUNK" || c === "MISSING_SOURCE_CHUNK") return "unclear_source";
  if (c.startsWith("CHUNK_")) return "search_weakness";
  return "other";
}

function metricStatusToReviewStatus(status: string | null | undefined): ProviderChunkReviewStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "FAIL" || s === "FAILED" || s === "BLOCKER" || s === "ERROR") return "needs_action";
  if (s === "WARNING" || s === "WARN") return "warning";
  return "ok";
}

function statusLabel(status: ProviderChunkReviewStatus): string {
  if (status === "needs_action") return "보완 필요";
  if (status === "warning") return "주의 필요";
  return "정상";
}

function parseHintParts(hint: string | null | undefined): {
  section: string | null;
  preview: string | null;
} {
  const text = hint?.trim() ?? "";
  if (!text) return { section: null, preview: null };
  const sectionMatch = text.match(/섹션:\s*([^|]+)/);
  const previewMatch = text.match(/미리보기:\s*(.+)$/);
  return {
    section: sectionMatch?.[1]?.trim() || null,
    preview: previewMatch?.[1]?.trim() || null,
  };
}

function actionableReason(codes: readonly string[], messages: readonly string[]): string {
  const primary = codes[0]?.toUpperCase() ?? "";
  if (primary === "SHORT_CHUNK" || primary === "EMPTY_CHUNK") {
    return "독립 지식단위인데 본문이 짧아 검색 답변 근거로 부족할 수 있습니다.";
  }
  if (primary === "LONG_CHUNK") {
    return "본문이 과도하게 길어 검색·인용 단위로 쓰기 어렵습니다.";
  }
  if (primary.includes("DUPLICATE")) {
    return "같은 설명이 서로 다른 지식단위에 반복되어 검색 결과가 중복될 수 있습니다.";
  }
  if (primary === "ORPHAN_CHUNK" || primary === "MISSING_SOURCE_CHUNK") {
    return "원본 파일과 연결이 불명확해 출처를 추적하기 어렵습니다.";
  }
  if (primary === "CHUNK_TITLE_MISSING") {
    return "제목이 없어 검색·인용 단위로 식별하기 어렵습니다.";
  }
  if (primary === "CHUNK_SECTION_MISSING" || primary === "CHUNK_STRUCTURE_SECTION_MISSING") {
    return "원본 섹션 구조와 생성 결과가 맞는지 확인해 주세요.";
  }
  const msg = messages.find((m) => m.trim())?.trim();
  if (msg) {
    if (/짧은 chunk|본문이 짧/i.test(msg)) {
      return "독립 지식단위인데 본문이 짧아 검색 답변 근거로 부족할 수 있습니다.";
    }
    if (/긴 chunk|과도/i.test(msg)) {
      return "본문이 과도하게 길어 검색·인용 단위로 쓰기 어렵습니다.";
    }
    return msg;
  }
  return "청킹 품질을 확인해 주세요.";
}

function actionHintFor(
  status: ProviderChunkReviewStatus,
  types: readonly ProviderChunkReviewIssueType[],
  hasSource: boolean,
): string {
  if (status === "ok") return "문제 없으면 확인만 하면 됩니다.";
  if (!hasSource) {
    return "원문에서 해당 API 설명이 누락되지 않았는지 확인해 주세요. 추적이 안 되면 보완 요청을 작성하세요.";
  }
  if (types.includes("too_short")) {
    return "이 항목은 부모 지식단위와 병합하는 것이 적정해 보입니다. 보완요청에 \"병합 필요\"를 남겨 주세요. 원문 누락 여부도 함께 확인해 주세요.";
  }
  if (types.includes("too_long")) {
    return "원문에서 섹션이 과도하게 합쳐졌는지 확인하세요. 필요하면 재청킹을 요청하세요.";
  }
  if (types.includes("duplicate_candidate")) {
    return "같은 설명이 여러 지식단위에 반복되어 검색 결과가 중복될 수 있습니다. 중복 제거 요청이 필요합니다.";
  }
  if (types.includes("unclear_source")) {
    return "원문에서 해당 API 설명이 누락되지 않았는지 확인해 주세요.";
  }
  return "원문과 생성 결과를 비교한 뒤, 원문 문제면 자료를 수정하고 Store 생성 문제면 보완 요청을 제출하세요.";
}

function fallbackLocationLabel(): string {
  return "원본 위치 정보 없음 — 상세 검토에서 확인하거나 보완 요청으로 위치 보강을 요청하세요.";
}

function fallbackPreview(charCount: number): string {
  if (charCount > 0) {
    return `본문 ${charCount}자 · 상세 검토에서 전체 내용을 확인할 수 있습니다.`;
  }
  return "본문 미리보기가 없습니다. 상세 검토에서 확인하세요.";
}

/**
 * Builds list items for 검색 지식 단위 검토.
 * Prefer metrics as the row source; enrich with matching issue hints/messages.
 */
export function buildProviderChunkReviewItems(input: {
  metrics?: readonly RawMetric[] | null;
  issues?: readonly RawIssue[] | null;
  sourceDocuments?: readonly RawSourceDoc[] | null;
  /** Cap OK rows when many metrics exist; attention rows are always included. */
  okLimit?: number;
}): ProviderChunkReviewItem[] {
  const metrics = input.metrics ?? [];
  const issues = input.issues ?? [];
  const docs = input.sourceDocuments ?? [];
  const okLimit = input.okLimit ?? 12;

  const issuesByChunkId = new Map<string, RawIssue[]>();
  for (const issue of issues) {
    const field = issue.field?.trim();
    if (!field) continue;
    const list = issuesByChunkId.get(field) ?? [];
    list.push(issue);
    issuesByChunkId.set(field, list);
  }

  const items: ProviderChunkReviewItem[] = [];
  for (const metric of metrics) {
    const chunkId = metric.chunkId?.trim();
    if (!chunkId) continue;

    const relatedIssues = issuesByChunkId.get(chunkId) ?? [];
    const codes = [
      ...new Set([
        ...(metric.issues ?? []).map((c) => c.trim()).filter(Boolean),
        ...relatedIssues.map((i) => (i.code ?? "").trim()).filter(Boolean),
      ]),
    ];
    const messages = relatedIssues.map((i) => i.message?.trim() ?? "").filter(Boolean);
    const hintParts = relatedIssues
      .map((i) => parseHintParts(i.hint))
      .find((p) => p.preview || p.section) ?? parseHintParts(relatedIssues[0]?.hint);

    const doc =
      docs.find((d) => d.id === metric.sourceDocumentId) ??
      null;
    const sourceFileName =
      doc?.fileName?.trim() ||
      doc?.title?.trim() ||
      (metric.sourceDocumentId ? "원본 위치 미연결" : fallbackLocationLabel());

    const sectionPath = [
      hintParts.section,
    ].filter((s): s is string => Boolean(s && s.trim()));

    let status = metricStatusToReviewStatus(metric.status);
    if (status === "ok" && codes.length > 0) {
      const hasFail = relatedIssues.some((i) => {
        const sev = (i.severity ?? "").toUpperCase();
        return sev === "FAIL" || sev === "FAILED" || sev === "BLOCKER" || sev === "ERROR";
      });
      status = hasFail ? "needs_action" : "warning";
    }

    const issueTypes = [...new Set(codes.map(mapIssueCodeToType))];
    const charCount =
      typeof metric.contentLength === "number" && Number.isFinite(metric.contentLength)
        ? metric.contentLength
        : 0;

    items.push({
      chunkId,
      title: metric.title?.trim() || "제목 없는 지식 단위",
      sourceFileName,
      sourceSectionPath: sectionPath,
      contentPreview: hintParts.preview || fallbackPreview(charCount),
      charCount,
      status,
      statusLabel: statusLabel(status),
      issueTypes,
      issueTypeLabels: issueTypes.map((t) => ISSUE_TYPE_LABELS[t]),
      issueReason:
        status === "ok"
          ? "품질 점검에서 특이 이슈가 없습니다."
          : actionableReason(codes, messages),
      providerActionHint: actionHintFor(status, issueTypes, Boolean(doc)),
      sourceDocumentId: metric.sourceDocumentId?.trim() || doc?.id || null,
      relatedIssueCodes: codes,
    });
  }

  const attention = items.filter((i) => i.status !== "ok");
  const ok = items.filter((i) => i.status === "ok").slice(0, okLimit);
  const merged = [...attention, ...ok];

  const rank = (s: ProviderChunkReviewStatus) =>
    s === "needs_action" ? 0 : s === "warning" ? 1 : 2;
  merged.sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return a.title.localeCompare(b.title, "ko");
  });
  return merged;
}

export function filterProviderChunkReviewItems(
  items: readonly ProviderChunkReviewItem[],
  filter: ProviderChunkReviewFilter,
): ProviderChunkReviewItem[] {
  if (filter === "warning") {
    return items.filter((i) => i.status === "warning" || i.status === "needs_action");
  }
  if (filter === "needs_action") {
    return items.filter((i) => i.status === "needs_action");
  }
  return [...items];
}

export function countProviderChunkReviewByStatus(items: readonly ProviderChunkReviewItem[]): {
  ok: number;
  warning: number;
  needs_action: number;
} {
  let ok = 0;
  let warning = 0;
  let needs_action = 0;
  for (const item of items) {
    if (item.status === "needs_action") needs_action += 1;
    else if (item.status === "warning") warning += 1;
    else ok += 1;
  }
  return { ok, warning, needs_action };
}

export function seedChangesRequestFromChunkReviewItem(item: ProviderChunkReviewItem): {
  changeType: "CHUNKING";
  targetKind: "CHUNK";
  targetLabel: string;
  details: string;
} {
  const location =
    [item.sourceFileName, ...item.sourceSectionPath].filter(Boolean).join(" > ") ||
    "원본 위치 미상";
  return {
    changeType: "CHUNKING",
    targetKind: "CHUNK",
    targetLabel: [item.chunkId, item.title].filter(Boolean).join(" · "),
    details: [
      `[${item.issueTypeLabels.join(", ") || "청킹 확인"}] ${item.issueReason}`,
      `위치: ${location}`,
      `지식 단위 ID: ${item.chunkId}`,
      item.contentPreview ? `본문 일부: ${item.contentPreview.slice(0, 200)}` : null,
      `조치 힌트: ${item.providerActionHint}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
