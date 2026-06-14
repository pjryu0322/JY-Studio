import type {
  ImplementationWorkingQueueAffectedArea,
  ImplementationWorkingQueueRiskLevel,
} from "@/lib/prototype/implementationWorkingQueueTypes";

/** @legacy Product path must not import infer* helpers — tests and LLM-failure-only helpers only. */
const SUPPLEMENT_KEYWORDS = [
  "수정",
  "바꿔",
  "변경",
  "올려",
  "내려",
  "키워",
  "줄여",
  "색상",
  "버튼",
  "메뉴",
  "화면",
  "오류",
  "안돼",
  "안 돼",
  "느려",
  "이상해",
  "보완",
  "추가",
  "삭제",
  "조정",
  "개선",
  "맞춰",
  "틀려",
  "깨져",
  "클릭",
  "탭",
  "이벤트",
  "적용",
  "보여",
  "표시",
] as const;

/** 명령형 chip/CTA는 보완요청으로 분류하지 않음 */
const NON_SUPPLEMENT_EXACT = new Set(
  [
    "진행해",
    "모두 진행해",
    "환경설정 열기",
    "생성요청",
    "구현 작업안 초안 생성",
    "구현 작업안 확정",
    "상태 새로고침",
  ].map((s) => s.trim()),
);

/**
 * Legacy keyword supplement detector — not used on the default Working Queue LLM path.
 * Retained for tests and LLM-failure fallback in `implementationWorkingQueueClassifier`.
 */
export function isImplementationSupplementRequest(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 4) return false;
  if (NON_SUPPLEMENT_EXACT.has(t)) return false;
  const lower = t.toLowerCase();
  return SUPPLEMENT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export function inferWorkingQueueAffectedArea(text: string): ImplementationWorkingQueueAffectedArea {
  const t = text.toLowerCase();
  if (/오류|버그|안돼|안 돼|깨|crash|error/.test(t)) return "bug";
  if (/색|색상|어두|밝|font|글자|스타일|디자인/.test(t)) return "style";
  if (/버튼|메뉴|레이아웃|위치|올려|내려|ui|화면|클릭|탭|이벤트/.test(t)) return "ui";
  if (/흐름|단계|절차|flow/.test(t)) return "flow";
  if (/데이터|db|저장|조회/.test(t)) return "data";
  if (/기능|추가|삭제/.test(t)) return "feature";
  return "unknown";
}

export function inferWorkingQueueRiskLevel(
  area: ImplementationWorkingQueueAffectedArea,
  text: string,
): ImplementationWorkingQueueRiskLevel {
  const t = text.toLowerCase();
  if (/삭제|데이터|db|결제|인증|로그인/.test(t)) return "high";
  if (area === "bug" || area === "data" || area === "flow") return "medium";
  if (area === "style" || area === "ui") return "low";
  return "low";
}

export function buildWorkingQueueItemTitle(rawUserMessage: string): string {
  const line = rawUserMessage.trim().split(/\n/)[0]?.trim() ?? "";
  const compact = line.replace(/\s+/g, " ");
  if (compact.length <= 48) return compact;
  return `${compact.slice(0, 45)}…`;
}

export function affectedAreaLabelKo(area: ImplementationWorkingQueueAffectedArea): string {
  switch (area) {
    case "ui":
      return "UI";
    case "flow":
      return "흐름";
    case "feature":
      return "기능";
    case "data":
      return "데이터";
    case "style":
      return "스타일";
    case "bug":
      return "오류";
    default:
      return "기타";
  }
}

export function riskLevelLabelKo(risk: ImplementationWorkingQueueRiskLevel): string {
  switch (risk) {
    case "low":
      return "낮음";
    case "medium":
      return "보통";
    case "high":
      return "높음";
  }
}

export function workingQueueStatusLabelKo(status: import("@/lib/prototype/implementationWorkingQueueTypes").ImplementationWorkingQueueStatus): string {
  switch (status) {
    case "pending":
      return "승인 대기";
    case "approved":
      return "승인됨";
    case "running":
      return "진행 중";
    case "completed":
      return "완료";
    case "rejected":
      return "거절";
    case "deferred":
      return "보류";
  }
}
