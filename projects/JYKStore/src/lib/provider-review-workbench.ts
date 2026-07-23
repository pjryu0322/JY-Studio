/**
 * User-facing labels for provider generation-result review quality statuses.
 */

export function formatProviderReviewQualityLabel(
  status: string | null | undefined,
): string {
  const normalized = (status ?? "").trim().toUpperCase();
  if (!normalized) return "미확인";
  if (normalized === "PASS" || normalized === "PASSED" || normalized === "OK") {
    return "통과";
  }
  if (normalized === "WARNING" || normalized === "WARN") {
    return "주의 필요";
  }
  if (normalized === "FAIL" || normalized === "FAILED" || normalized === "ERROR") {
    return "실패";
  }
  if (normalized === "PENDING" || normalized === "RUNNING") {
    return "진행 중";
  }
  if (normalized === "STALE") return "재검토 필요";
  return status!.trim();
}

export function overallProviderReviewQualityLabel(input: {
  structure?: string | null;
  chunk?: string | null;
  retrieval?: string | null;
}): string {
  const statuses = [input.structure, input.chunk, input.retrieval]
    .map((s) => (s ?? "").trim().toUpperCase())
    .filter(Boolean);
  if (statuses.length === 0) return "미확인";
  if (statuses.some((s) => s === "FAIL" || s === "FAILED" || s === "ERROR")) {
    return "실패";
  }
  if (statuses.some((s) => s === "WARNING" || s === "WARN" || s === "STALE")) {
    return "주의 필요";
  }
  if (statuses.every((s) => s === "PASS" || s === "PASSED" || s === "OK")) {
    return "통과";
  }
  return "확인 필요";
}

export const PROVIDER_CHANGES_REQUEST_TYPES = [
  { value: "STRUCTURE", label: "구조화 오류" },
  { value: "MISSING", label: "누락" },
  { value: "CHUNKING", label: "청킹 부적정" },
  { value: "RETRIEVAL", label: "검색 결과 부정확" },
  { value: "OTHER", label: "기타" },
] as const;

export const PROVIDER_CHANGES_REQUEST_TARGETS = [
  { value: "FILE", label: "파일" },
  { value: "SECTION", label: "문서 섹션" },
  { value: "KU", label: "Knowledge Unit" },
  { value: "CHUNK", label: "Chunk" },
  { value: "QUERY", label: "검색 질문/결과" },
  { value: "OTHER", label: "기타" },
] as const;

export type ProviderChangesRequestType =
  (typeof PROVIDER_CHANGES_REQUEST_TYPES)[number]["value"];
export type ProviderChangesRequestTarget =
  (typeof PROVIDER_CHANGES_REQUEST_TARGETS)[number]["value"];

export type ProviderChangesRequestPayload = {
  changeType: ProviderChangesRequestType;
  targetKind: ProviderChangesRequestTarget;
  targetLabel?: string;
  details: string;
};

export const PROVIDER_CHANGES_REQUEST_SUMMARY_KIND = "provider_changes_request" as const;

export function encodeProviderChangesRequestSummary(
  input: ProviderChangesRequestPayload,
): string {
  return JSON.stringify({
    v: 1,
    kind: PROVIDER_CHANGES_REQUEST_SUMMARY_KIND,
    changeType: input.changeType,
    targetKind: input.targetKind,
    targetLabel: input.targetLabel?.trim() || null,
    details: input.details.trim(),
  });
}

export function parseProviderChangesRequestSummary(
  summary: string | null | undefined,
): ProviderChangesRequestPayload | null {
  if (!summary?.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(summary) as Partial<ProviderChangesRequestPayload> & {
      v?: number;
      kind?: string;
    };
    if (parsed.kind !== PROVIDER_CHANGES_REQUEST_SUMMARY_KIND) return null;
    if (typeof parsed.details !== "string" || !parsed.details.trim()) return null;
    if (typeof parsed.changeType !== "string" || typeof parsed.targetKind !== "string") {
      return null;
    }
    return {
      changeType: parsed.changeType as ProviderChangesRequestType,
      targetKind: parsed.targetKind as ProviderChangesRequestTarget,
      targetLabel:
        typeof parsed.targetLabel === "string" ? parsed.targetLabel : undefined,
      details: parsed.details.trim(),
    };
  } catch {
    return null;
  }
}
