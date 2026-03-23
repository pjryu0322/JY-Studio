/** Display labels for TaskHistory.eventType (API values unchanged). */
export function taskHistoryEventLabel(eventType: string): string {
  const map: Record<string, string> = {
    PROMPT_CREATED: "프롬프트 생성",
    PROMPT_REVISED: "프롬프트 개정",
    RUN_STARTED: "실행 시작",
    RUN_COMPLETED: "실행 완료",
    RUN_FAILED: "실행 실패",
    VALIDATION_PASSED: "검증 통과",
    VALIDATION_FAILED: "검증 실패",
    RETRY_TRIGGERED: "재시도",
    GIT_REQUEST_CREATED: "Git 요청 등록",
    GIT_APPLY_STARTED: "Git 반영 시작",
    GIT_APPLY_COMPLETED: "Git 반영 완료",
    GIT_APPLY_FAILED: "Git 반영 실패",
    GIT_APPROVAL_REQUIRED: "Git 승인 필요(등록)",
    GIT_APPROVED: "Git 반영 승인",
    GIT_REJECTED: "Git 반영 반려",
    GIT_PR_CREATED: "GitHub PR 생성",
    GIT_PR_SYNCED: "GitHub PR 상태 동기화",
    GIT_PR_APPROVED: "GitHub PR 승인(리뷰)",
    GIT_PR_CHANGES_REQUESTED: "GitHub PR 변경 요청",
    GIT_PR_MERGED: "GitHub PR 병합",
    MANUAL_APPROVED: "수동 승인",
    MANUAL_REJECTED: "수동 거절",
    MANUAL_CANCELLED: "수동 취소",
    MANUAL_FORCED_COMPLETE: "강제 완료",
    MANUAL_BLOCKED: "수동 차단",
    TASK_REORDERED: "순서 변경",
    FOLLOWUP_TASK_CREATED: "보완 Task 생성",
  };
  return map[eventType] ?? eventType.replace(/_/g, " ");
}

export type EventBadgeTone = "prompt" | "run" | "git" | "retry" | "risk" | "neutral";

export function taskHistoryEventTone(eventType: string): EventBadgeTone {
  if (eventType.startsWith("PROMPT_")) return "prompt";
  if (eventType.startsWith("RUN_")) return eventType.includes("FAIL") ? "risk" : "run";
  if (eventType.startsWith("GIT_")) return eventType.includes("FAIL") ? "risk" : "git";
  if (eventType.startsWith("VALIDATION_")) return eventType.includes("FAIL") ? "risk" : "run";
  if (eventType === "RETRY_TRIGGERED") return "retry";
  if (eventType.startsWith("MANUAL_")) return "neutral";
  if (eventType.startsWith("TASK_")) return "neutral";
  if (eventType.startsWith("FOLLOWUP")) return "neutral";
  return "neutral";
}

const toneStyles: Record<
  EventBadgeTone,
  { bg: string; color: string; border: string }
> = {
  prompt: { bg: "#e3f2fd", color: "#0d47a1", border: "#90caf9" },
  run: { bg: "#e8f5e9", color: "#1b5e20", border: "#81c784" },
  git: { bg: "#f3e5f5", color: "#4a148c", border: "#ce93d8" },
  retry: { bg: "#fff8e1", color: "#e65100", border: "#ffcc80" },
  risk: { bg: "#ffebee", color: "#b71c1c", border: "#ef9a9a" },
  neutral: { bg: "#eceff1", color: "#37474f", border: "#b0bec5" },
};

export function taskHistoryBadgeColors(eventType: string) {
  return toneStyles[taskHistoryEventTone(eventType)];
}

export function taskHistoryActorLabel(actorType: string, actorId: string | null): string {
  const typeKo: Record<string, string> = {
    USER: "사용자",
    SYSTEM: "시스템",
    LLM: "LLM",
    CURSOR: "Cursor",
    GIT: "Git",
  };
  const t = typeKo[actorType] ?? actorType;
  if (actorId) {
    return `${t} · ${actorId}`;
  }
  return t;
}
