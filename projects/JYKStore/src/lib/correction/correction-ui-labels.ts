/**
 * P5.1B — Correction Workbench UI labels and pure UX helpers.
 * Internal enums/codes stay English; UI strings are Korean only.
 */

import type { AdminCorrectionCase } from "@/lib/admin-review-api";

export const CORRECTION_SEVERITY_UI: Record<"BLOCKER" | "WARNING", string> = {
  BLOCKER: "차단",
  WARNING: "주의",
};

export const CORRECTION_STATUS_UI: Record<AdminCorrectionCase["status"], string> = {
  OPEN: "미처리",
  APPLIED: "적용",
  REGENERATED: "재생성",
  VERIFIED: "검증",
  CLOSED: "완료",
};

export const CORRECTION_ACTION_UI: Record<string, string> = {
  FILE_EXCLUDE: "제외",
  FILE_REQUEST_PROVIDER: "제공자 확인",
  STRUCTURE_DELETE: "삭제",
  STRUCTURE_MERGE: "통합",
  CHUNK_DELETE: "삭제",
  CHUNK_MERGE: "통합",
};

export const CORRECTION_ACTION_HINT_UI: Record<string, string> = {
  FILE_EXCLUDE: "이 파일을 지식화 대상에서 제외합니다",
  FILE_REQUEST_PROVIDER: "제공자에게 확인·보완을 요청합니다",
  STRUCTURE_DELETE: "해당 구조의 활성 항목을 제거합니다",
  STRUCTURE_MERGE: "선택한 구조를 대상에 통합합니다",
  CHUNK_DELETE: "해당 청크를 검색에서 제외합니다",
  CHUNK_MERGE: "선택한 청크를 대상에 통합합니다",
};

export const CORRECTION_PRIMARY_ACTIONS = new Set([
  "FILE_EXCLUDE",
  "STRUCTURE_MERGE",
  "STRUCTURE_DELETE",
  "CHUNK_MERGE",
  "CHUNK_DELETE",
]);

/** Dense workbench layout — stacks on mobile, 3 columns on desktop. */
export const CORRECTION_WORKBENCH_GRID_CLASS =
  "grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]";

export function severityUiLabel(severity: "BLOCKER" | "WARNING", done = false): string {
  if (done) return "완료";
  return CORRECTION_SEVERITY_UI[severity];
}

export function statusUiLabel(status: AdminCorrectionCase["status"]): string {
  return CORRECTION_STATUS_UI[status] ?? status;
}

export function actionUiLabel(action: string | null | undefined): string {
  if (!action) return "—";
  return CORRECTION_ACTION_UI[action] ?? action;
}

export function outcomeUiLabel(outcome: string | null | undefined): string {
  if (!outcome) return "—";
  switch (outcome) {
    case "SUCCEEDED":
      return "성공";
    case "SUCCEEDED_WITH_WARNINGS":
      return "성공(주의)";
    case "CORRECTION_REQUIRED":
      return "보정 필요";
    case "FAILED":
      return "실패";
    case "RUNNING":
      return "진행 중";
    case "READY":
      return "대기";
    default:
      return outcome;
  }
}

export function splitCorrectionActions(availableActions: readonly string[]): {
  primary: string[];
  more: string[];
} {
  const primary = availableActions.filter((a) => CORRECTION_PRIMARY_ACTIONS.has(a));
  const more = availableActions.filter((a) => !CORRECTION_PRIMARY_ACTIONS.has(a));
  return { primary, more };
}

export function resolveSelectedCorrectionCase(input: {
  cases: readonly AdminCorrectionCase[];
  filtered: readonly AdminCorrectionCase[];
  selectedId: string | null;
}): AdminCorrectionCase | null {
  const { cases, filtered, selectedId } = input;
  if (selectedId) {
    return (
      filtered.find((c) => c.id === selectedId) ??
      cases.find((c) => c.id === selectedId) ??
      null
    );
  }
  return filtered[0] ?? null;
}

export function filterCorrectionCases(
  cases: readonly AdminCorrectionCase[],
  filter: "all" | "BLOCKER" | "WARNING",
): AdminCorrectionCase[] {
  if (filter === "all") return [...cases];
  return cases.filter((c) => c.severity === filter);
}

export function shouldShowAdvancedDetails(showAdvanced: boolean): boolean {
  return showAdvanced;
}

export function shouldShowMoreMenu(moreActions: readonly string[], moreOpen: boolean): boolean {
  return moreActions.length > 0 && moreOpen;
}

export function canRunPrimaryApply(status: AdminCorrectionCase["status"] | null): boolean {
  return status === "OPEN";
}
