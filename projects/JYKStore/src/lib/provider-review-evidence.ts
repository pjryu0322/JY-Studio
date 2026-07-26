/**
 * Build provider-facing review evidence from stored quality DTOs
 * (no schema change — joins issue.field → metrics → source documents).
 */

import { formatProviderReviewQualityLabel } from "@/lib/provider-review-workbench";
import type { ProviderChangesRequestTarget, ProviderChangesRequestType } from "@/lib/provider-review-workbench";

export type ProviderReviewIssueSeverityLabel = "주의 필요" | "실패" | "정보";

export type ProviderReviewIssueEvidence = {
  id: string;
  area: "structure" | "chunk" | "retrieval";
  code: string;
  issueTypeLabel: string;
  severityLabel: ProviderReviewIssueSeverityLabel;
  message: string;
  locationLabel: string | null;
  /** Linked source document when join is possible. */
  sourceDocumentId: string | null;
  targetId: string | null;
  problemPreview: string | null;
  expectation: string;
  serviceImpact: string;
  providerAction: string;
  hasConcreteEvidence: boolean;
  evidenceGapReason: string | null;
  suggestedChangeType: ProviderChangesRequestType;
  suggestedTargetKind: ProviderChangesRequestTarget;
  suggestedTargetLabel: string;
};

export type ProviderReviewAreaGuidance = {
  area: "structure" | "chunk" | "retrieval";
  areaLabel: string;
  statusLabel: string;
  problem: string;
  serviceImpact: string;
  providerAction: string;
};

type RawIssue = {
  severity?: string | null;
  code?: string | null;
  message?: string | null;
  field?: string | null;
  hint?: string | null;
};

type RawMetric = {
  chunkId?: string | null;
  sourceDocumentId?: string | null;
  title?: string | null;
  contentLength?: number | null;
  tokenEstimate?: number | null;
  status?: string | null;
  issues?: string[] | null;
};

type RawSourceDoc = {
  id: string;
  title?: string | null;
};

type RawRetrievalFail = {
  query?: string | null;
  status?: string | null;
  issueCodes?: string[] | null;
  caseId?: string | null;
  retrievalMode?: string | null;
  firstHitRank?: number | null;
  hit?: boolean | null;
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  SHORT_CHUNK: "짧은 chunk",
  LONG_CHUNK: "긴 chunk",
  EMPTY_CHUNK: "빈 chunk",
  CHUNK_TITLE_MISSING: "제목 없는 chunk",
  CHUNK_SECTION_MISSING: "섹션 누락 chunk",
  CHUNK_TAGS_MISSING: "태그 누락 chunk",
  CHUNK_METADATA_MISSING: "메타데이터 누락 chunk",
  DUPLICATE_CHUNK: "중복 chunk",
  NEAR_DUPLICATE_CHUNK: "유사 중복 chunk",
  ORPHAN_CHUNK: "원본 연결 없는 chunk",
  MISSING_SOURCE_CHUNK: "원본 미커버",
};

function severityLabel(severity: string | null | undefined): ProviderReviewIssueSeverityLabel {
  const s = (severity ?? "").toUpperCase();
  if (s === "BLOCKER" || s === "FAIL" || s === "FAILED" || s === "ERROR") return "실패";
  if (s === "WARNING" || s === "WARN") return "주의 필요";
  return "정보";
}

function issueTypeLabel(code: string): string {
  return ISSUE_TYPE_LABELS[code] ?? code.replace(/_/g, " ").toLowerCase();
}

function expectationForCode(code: string, area: ProviderReviewIssueEvidence["area"]): string {
  if (area === "chunk") {
    if (code === "SHORT_CHUNK") {
      return "본문이 너무 짧아 독립 검색 단위로 의미가 부족합니다. 부모 지식단위 병합이 필요할 수 있습니다.";
    }
    if (code === "LONG_CHUNK") {
      return "본문이 과도하게 길어 검색·인용 단위로 쓰기 어렵습니다.";
    }
    if (code.startsWith("DUPLICATE") || code.includes("DUPLICATE")) {
      return "서로 다른 지식단위에 동일·유사 내용이 중복되어 검색 결과가 흔들릴 수 있습니다.";
    }
    if (code === "EMPTY_CHUNK" || code === "CHUNK_TITLE_MISSING") {
      return "검색·인용에 필요한 제목/본문이 없습니다.";
    }
    return "청킹 품질 기준을 충족하지 못합니다.";
  }
  if (area === "structure") {
    return "문서 구조화/지식 품질 기준을 충족하지 못합니다.";
  }
  return "검색 평가 기대 결과와 일치하지 않습니다.";
}

function serviceImpactForCode(code: string, area: ProviderReviewIssueEvidence["area"]): string {
  if (area === "chunk") {
    if (code === "SHORT_CHUNK") {
      return "구체 API·기능 질문에서 정확한 근거 chunk로 매칭되지 않을 수 있습니다.";
    }
    if (code.startsWith("DUPLICATE") || code.includes("DUPLICATE")) {
      return "검색 결과가 중복·분산되어 답변 근거가 불명확해질 수 있습니다.";
    }
    return "API/MCP/RAG Export 검색·인용 품질이 떨어질 수 있습니다.";
  }
  if (area === "structure") {
    return "섹션·표·헤딩이 누락되면 지식 구조와 검색 커버리지가 약해질 수 있습니다.";
  }
  return "사용자 질문이 기대 답변 chunk에 연결되지 않을 수 있습니다.";
}

function providerActionFor(
  code: string,
  area: ProviderReviewIssueEvidence["area"],
  hasEvidence: boolean,
): string {
  if (!hasEvidence) {
    return "상세 근거가 부족합니다. 보완 요청으로 관리자 재처리·품질점검 데이터 보강을 요청하세요.";
  }
  if (area === "chunk") {
    if (code === "SHORT_CHUNK" || code === "EMPTY_CHUNK") {
      return "이 항목은 부모 지식단위와 병합하는 것이 적정해 보입니다. 보완요청에 \"병합 필요\"를 남겨 주세요. 원문 누락 여부도 확인해 주세요.";
    }
    if (code === "LONG_CHUNK") {
      return "원문에서 해당 섹션이 누락됐는지 확인하세요. 원문은 정상인데 chunk가 과도하게 분리·병합됐다면 보완 요청으로 재청킹을 요청하세요.";
    }
    if (code.startsWith("DUPLICATE") || code.includes("DUPLICATE")) {
      return "같은 설명이 여러 지식단위에 반복되어 검색 결과가 중복될 수 있습니다. 중복 제거 요청이 필요합니다.";
    }
    return "원문과 생성 결과를 비교한 뒤, 원문 문제면 자료를 수정하고 Store 생성 문제면 보완 요청을 제출하세요.";
  }
  if (area === "structure") {
    return "원문 구조(헤딩/표/섹션)를 확인하세요. 원문은 정상인데 구조화가 틀렸다면 보완 요청을 제출하세요.";
  }
  return "실패·주의 질문을 확인하고, 기대 답변이 원문에 있다면 보완 요청으로 검색/청킹 재처리를 요청하세요.";
}

function suggestedChange(
  area: ProviderReviewIssueEvidence["area"],
  code: string,
): { changeType: ProviderChangesRequestType; targetKind: ProviderChangesRequestTarget } {
  if (area === "retrieval") {
    return { changeType: "RETRIEVAL", targetKind: "QUERY" };
  }
  if (area === "structure") {
    return { changeType: "STRUCTURE", targetKind: "SECTION" };
  }
  if (code === "EMPTY_CHUNK" || code === "MISSING_SOURCE_CHUNK") {
    return { changeType: "MISSING", targetKind: "CHUNK" };
  }
  return { changeType: "CHUNKING", targetKind: "CHUNK" };
}

function previewFromHint(hint: string | null | undefined): string | null {
  const t = hint?.trim();
  if (!t) return null;
  return t.length > 280 ? `${t.slice(0, 277)}…` : t;
}

export function buildChunkIssueEvidence(input: {
  issues: readonly RawIssue[];
  metrics: readonly RawMetric[];
  sourceDocuments: readonly RawSourceDoc[];
  limit?: number;
}): ProviderReviewIssueEvidence[] {
  const limit = input.limit ?? 20;
  const metricByChunkId = new Map(
    input.metrics
      .filter((m) => m.chunkId)
      .map((m) => [m.chunkId as string, m] as const),
  );
  const docById = new Map(input.sourceDocuments.map((d) => [d.id, d] as const));

  return input.issues.slice(0, limit).map((issue, idx) => {
    const code = (issue.code ?? "UNKNOWN").trim() || "UNKNOWN";
    const chunkId = issue.field?.trim() || null;
    const metric = chunkId ? metricByChunkId.get(chunkId) : undefined;
    const doc =
      metric?.sourceDocumentId != null ? docById.get(metric.sourceDocumentId) : undefined;
    const hintPreview = previewFromHint(issue.hint);
    const locationParts = [
      doc?.title?.trim() || null,
      metric?.title?.trim() || null,
    ].filter(Boolean);
    const locationLabel = locationParts.length > 0 ? locationParts.join(" > ") : null;
    const lengthNote =
      typeof metric?.contentLength === "number"
        ? `본문 길이 ${metric.contentLength}자` +
          (typeof metric.tokenEstimate === "number"
            ? ` · 약 ${metric.tokenEstimate}토큰`
            : "")
        : null;
    const problemPreview = hintPreview
      ? hintPreview
      : lengthNote
        ? `${lengthNote} (본문 미리보기 없음)`
        : null;
    const hasConcreteEvidence = Boolean(chunkId || locationLabel || hintPreview);
    const { changeType, targetKind } = suggestedChange("chunk", code);
    const suggestedTargetLabel =
      [chunkId, doc?.title, metric?.title].filter(Boolean).join(" · ") || code;

    return {
      id: `chunk-${idx}-${code}-${chunkId ?? "x"}`,
      area: "chunk",
      code,
      issueTypeLabel: issueTypeLabel(code),
      severityLabel: severityLabel(issue.severity),
      message: issue.message?.trim() || issueTypeLabel(code),
      locationLabel,
      sourceDocumentId: metric?.sourceDocumentId?.trim() || doc?.id || null,
      targetId: chunkId,
      problemPreview,
      expectation: expectationForCode(code, "chunk"),
      serviceImpact: serviceImpactForCode(code, "chunk"),
      providerAction: providerActionFor(code, "chunk", hasConcreteEvidence),
      hasConcreteEvidence,
      evidenceGapReason: hasConcreteEvidence
        ? hintPreview
          ? null
          : "저장된 품질점검 결과에 chunk 본문 미리보기가 없습니다."
        : "상세 근거 데이터 없음 — 관리자 재처리 또는 품질점검 데이터 보강이 필요합니다.",
      suggestedChangeType: changeType,
      suggestedTargetKind: targetKind,
      suggestedTargetLabel,
    };
  });
}

export function buildStructureIssueEvidence(input: {
  issues: readonly RawIssue[];
  sourceDocuments?: readonly RawSourceDoc[];
  limit?: number;
}): ProviderReviewIssueEvidence[] {
  const limit = input.limit ?? 20;
  const docs = input.sourceDocuments ?? [];
  return input.issues.slice(0, limit).map((issue, idx) => {
    const code = (issue.code ?? "UNKNOWN").trim() || "UNKNOWN";
    const field = issue.field?.trim() || null;
    const hintPreview = previewFromHint(issue.hint);
    const matchedDoc =
      docs.find((d) => d.id === field) ??
      docs.find((d) => {
        const title = d.title?.trim();
        return Boolean(title && field && (field.includes(title) || title.includes(field)));
      });
    const hasConcreteEvidence = Boolean(field || hintPreview);
    const { changeType, targetKind } = suggestedChange("structure", code);
    return {
      id: `structure-${idx}-${code}-${field ?? "x"}`,
      area: "structure",
      code,
      issueTypeLabel: issueTypeLabel(code),
      severityLabel: severityLabel(issue.severity),
      message: issue.message?.trim() || issueTypeLabel(code),
      locationLabel: field,
      sourceDocumentId: matchedDoc?.id ?? null,
      targetId: field,
      problemPreview: hintPreview,
      expectation: expectationForCode(code, "structure"),
      serviceImpact: serviceImpactForCode(code, "structure"),
      providerAction: providerActionFor(code, "structure", hasConcreteEvidence),
      hasConcreteEvidence,
      evidenceGapReason: hasConcreteEvidence
        ? null
        : "상세 근거 데이터 없음 — 구조화 재처리 또는 품질점검 데이터 보강이 필요합니다.",
      suggestedChangeType: changeType,
      suggestedTargetKind: targetKind,
      suggestedTargetLabel: field || code,
    };
  });
}

export function buildRetrievalIssueEvidence(input: {
  failedResults: readonly RawRetrievalFail[];
  limit?: number;
}): ProviderReviewIssueEvidence[] {
  const limit = input.limit ?? 10;
  return input.failedResults.slice(0, limit).map((row, idx) => {
    const query = row.query?.trim() || `검색 질문 ${idx + 1}`;
    const codes = (row.issueCodes ?? []).filter(Boolean);
    const reason =
      codes.length > 0
        ? `이슈 코드: ${codes.join(", ")}`
        : row.status
          ? `평가 상태: ${formatProviderReviewQualityLabel(row.status)}`
          : null;
    const problemParts = [
      `질문: ${query}`,
      row.retrievalMode ? `검색 모드: ${row.retrievalMode}` : null,
      codes.length > 0 ? `이슈 코드: ${codes.join(", ")}` : null,
      row.status ? `평가 상태: ${formatProviderReviewQualityLabel(row.status)}` : null,
      typeof row.firstHitRank === "number"
        ? `첫 적중 순위: ${row.firstHitRank}`
        : "첫 적중 순위: 없음",
      typeof row.hit === "boolean" ? `적중 여부: ${row.hit ? "예" : "아니오"}` : null,
    ].filter(Boolean);
    const hasConcreteEvidence = Boolean(query);
    return {
      id: `retrieval-${idx}-${row.caseId ?? query.slice(0, 24)}`,
      area: "retrieval" as const,
      code: codes[0] ?? "RETRIEVAL_FAIL",
      issueTypeLabel: "검색 결과 부정확",
      severityLabel: "실패" as const,
      message: reason || "검색 평가가 기대와 일치하지 않습니다.",
      locationLabel: [
        query,
        row.retrievalMode ? `모드 ${row.retrievalMode}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      sourceDocumentId: null,
      targetId: row.caseId?.trim() || null,
      problemPreview: problemParts.join("\n"),
      expectation: "평가 질문이 기대 근거 chunk/답변에 연결되어야 합니다.",
      serviceImpact: serviceImpactForCode("RETRIEVAL_FAIL", "retrieval"),
      providerAction: providerActionFor("RETRIEVAL_FAIL", "retrieval", hasConcreteEvidence),
      hasConcreteEvidence,
      evidenceGapReason: null,
      suggestedChangeType: "RETRIEVAL" as const,
      suggestedTargetKind: "QUERY" as const,
      suggestedTargetLabel: query,
    };
  });
}

export function buildProviderReviewAreaGuidance(input: {
  structureStatus?: string | null;
  chunkStatus?: string | null;
  retrievalStatus?: string | null;
  structureIssueCount?: number;
  chunkIssueCount?: number;
  retrievalFailCount?: number;
}): ProviderReviewAreaGuidance[] {
  const rows: Array<{
    area: ProviderReviewAreaGuidance["area"];
    areaLabel: string;
    status?: string | null;
    issueCount: number;
  }> = [
    {
      area: "structure",
      areaLabel: "구조화",
      status: input.structureStatus,
      issueCount: input.structureIssueCount ?? 0,
    },
    {
      area: "chunk",
      areaLabel: "청킹",
      status: input.chunkStatus,
      issueCount: input.chunkIssueCount ?? 0,
    },
    {
      area: "retrieval",
      areaLabel: "검색 평가",
      status: input.retrievalStatus,
      issueCount: input.retrievalFailCount ?? 0,
    },
  ];

  return rows
    .filter((row) => {
      const s = (row.status ?? "").toUpperCase();
      return s === "WARNING" || s === "WARN" || s === "FAIL" || s === "FAILED" || s === "ERROR" || s === "STALE";
    })
    .map((row) => {
      const statusLabel = formatProviderReviewQualityLabel(row.status);
      const isFail = statusLabel === "실패";
      if (row.area === "chunk") {
        return {
          area: row.area,
          areaLabel: row.areaLabel,
          statusLabel,
          problem: isFail
            ? `청킹 품질이 실패입니다. 이슈 ${row.issueCount}건을 확인하세요.`
            : `일부 chunk가 짧거나 중복·메타데이터 부족으로 독립 검색 근거로 쓰기 어렵습니다. (이슈 ${row.issueCount}건)`,
          serviceImpact:
            "셀 병합 API처럼 구체 질문에서 검색 정확도가 낮아지거나 근거 chunk가 흔들릴 수 있습니다.",
          providerAction: isFail
            ? "확인 완료할 수 없습니다. 이슈를 검토한 뒤 보완 요청을 제출하세요."
            : "원문 누락 여부를 확인하고, 원문은 정상이라면 보완 요청으로 재청킹을 요청하세요. 경미하면 이슈를 확인한 뒤 확인 완료할 수 있습니다.",
        };
      }
      if (row.area === "structure") {
        return {
          area: row.area,
          areaLabel: row.areaLabel,
          statusLabel,
          problem: isFail
            ? `구조화/지식 품질이 실패입니다. 이슈 ${row.issueCount}건을 확인하세요.`
            : `헤딩·표·섹션 추출 등 구조화에 주의가 필요합니다. (이슈 ${row.issueCount}건)`,
          serviceImpact: "섹션 커버리지가 약하면 지식 구조와 검색·인용 품질이 떨어질 수 있습니다.",
          providerAction: isFail
            ? "확인 완료할 수 없습니다. 원문 위치와 이슈를 확인한 뒤 보완 요청을 제출하세요."
            : "원문 구조가 정상인지 확인하세요. Store 구조화 문제면 보완 요청을 작성하세요.",
        };
      }
      return {
        area: row.area,
        areaLabel: row.areaLabel,
        statusLabel,
        problem: isFail
          ? `검색 평가가 실패했습니다. 실패 질문 ${row.issueCount}건을 확인하세요.`
          : `검색 평가에 주의가 필요합니다. (실패/주의 ${row.issueCount}건)`,
        serviceImpact: "사용자 질문이 기대 답변·근거 chunk에 연결되지 않을 수 있습니다.",
        providerAction: isFail
          ? "확인 완료할 수 없습니다. 실패 질문을 확인한 뒤 보완 요청을 제출하세요."
          : "실패·주의 질문을 확인한 뒤, 원문은 정상인데 검색이 틀리면 보완 요청을 제출하세요.",
      };
    });
}

export function providerReviewHasBlockingFail(input: {
  structureStatus?: string | null;
  chunkStatus?: string | null;
  retrievalStatus?: string | null;
}): boolean {
  return [input.structureStatus, input.chunkStatus, input.retrievalStatus].some((s) =>
    providerReviewStatusIsFail(s),
  );
}

export function providerReviewStatusIsFail(status?: string | null): boolean {
  const n = (status ?? "").toUpperCase();
  return n === "FAIL" || n === "FAILED" || n === "ERROR";
}

export function providerReviewStatusNeedsAttention(status?: string | null): boolean {
  const n = (status ?? "").toUpperCase();
  return (
    n === "WARNING" ||
    n === "WARN" ||
    n === "FAIL" ||
    n === "FAILED" ||
    n === "ERROR" ||
    n === "STALE"
  );
}

/** Pure confirm gate used by ProviderGenerationReviewPanel (and tests). */
export function providerReviewConfirmBlockReason(input: {
  structureStatus?: string | null;
  chunkStatus?: string | null;
  retrievalStatus?: string | null;
  structureReviewComplete: boolean;
  chunkReviewComplete: boolean;
  retrievalReviewComplete: boolean;
  unreviewedAttentionChunkCount?: number;
  hasPendingChangesDraft?: boolean;
}): string | null {
  if (
    providerReviewHasBlockingFail({
      structureStatus: input.structureStatus,
      chunkStatus: input.chunkStatus,
      retrievalStatus: input.retrievalStatus,
    })
  ) {
    return "실패 상태인 품질 항목이 있어 확인 완료할 수 없습니다. 보완 요청 또는 재처리 요청을 제출해 주세요.";
  }
  if (!input.structureReviewComplete) {
    return "구조화 주의·실패 이슈가 있는 원본 파일의 경고 아이콘을 눌러 상세를 확인한 뒤 확인 완료해 주세요.";
  }
  if (!input.chunkReviewComplete) {
    const left = input.unreviewedAttentionChunkCount ?? 0;
    return `주의·보완이 필요한 검색 지식 단위를 각각 명시적으로 판단해 주세요. (남은 ${left}건)`;
  }
  if (!input.retrievalReviewComplete) {
    return "검색 평가 이슈를 각각 확인하거나 보완 요청에 추가한 뒤 확인 완료해 주세요.";
  }
  if (input.hasPendingChangesDraft) {
    return "작성 중인 보완 요청이 있습니다. 제출하거나 취소한 뒤 확인 완료해 주세요.";
  }
  return null;
}

/** Attention chunk is judged only by explicit OK or supplement — not by opening detail. */
export function isProviderAttentionChunkJudged(input: {
  chunkId: string;
  status: "ok" | "warning" | "needs_action";
  reviewedChunkIds: ReadonlySet<string>;
  supplementChunkIds: ReadonlySet<string>;
}): boolean {
  if (input.status === "ok") return true;
  if (input.supplementChunkIds.has(input.chunkId)) return true;
  // FAIL-level chunks must be routed to supplement, not silent OK.
  if (input.status === "needs_action") return false;
  return input.reviewedChunkIds.has(input.chunkId);
}

/** Retrieval issues are judged per id; opening the modal does not count. */
export function areProviderRetrievalIssuesJudged(input: {
  retrievalStatus?: string | null;
  issueIds: readonly string[];
  confirmedIssueIds: ReadonlySet<string>;
  supplementIssueIds: ReadonlySet<string>;
}): boolean {
  if (input.issueIds.length === 0) {
    return !providerReviewStatusIsFail(input.retrievalStatus);
  }
  const failStatus = providerReviewStatusIsFail(input.retrievalStatus);
  return input.issueIds.every((id) => {
    if (input.supplementIssueIds.has(id)) return true;
    if (failStatus) return false;
    return input.confirmedIssueIds.has(id);
  });
}

export function providerReviewHasWarning(input: {
  structureStatus?: string | null;
  chunkStatus?: string | null;
  retrievalStatus?: string | null;
}): boolean {
  return [input.structureStatus, input.chunkStatus, input.retrievalStatus].some((s) => {
    const n = (s ?? "").toUpperCase();
    return n === "WARNING" || n === "WARN" || n === "STALE";
  });
}

export function countProviderReviewIssueSeverity(issues: readonly ProviderReviewIssueEvidence[]): {
  warning: number;
  fail: number;
} {
  let warning = 0;
  let fail = 0;
  for (const issue of issues) {
    if (issue.severityLabel === "실패") fail += 1;
    else if (issue.severityLabel === "주의 필요") warning += 1;
  }
  return { warning, fail };
}

/** Issues linked to a source document id (excludes pack-level / unlinked). */
export function issuesForSourceDocument(
  issues: readonly ProviderReviewIssueEvidence[],
  sourceDocumentId: string,
): ProviderReviewIssueEvidence[] {
  return issues.filter((issue) => issue.sourceDocumentId === sourceDocumentId);
}

export function sourceDocumentIdsWithIssues(
  issues: readonly ProviderReviewIssueEvidence[],
): Set<string> {
  const ids = new Set<string>();
  for (const issue of issues) {
    if (issue.sourceDocumentId) ids.add(issue.sourceDocumentId);
  }
  return ids;
}
