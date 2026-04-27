import type { PrototypeRun, PrototypeRunStatus } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeTimelineStepStatus = "pending" | "running" | "success" | "failed" | "blocked";

export type PrototypeTimelineRow = Readonly<{ label: string; status: PrototypeTimelineStepStatus }>;

const ORDER: PrototypeRunStatus[] = [
  "DRAFT",
  "PROMPT_READY",
  "CURSOR_REQUESTED",
  "CURSOR_RUNNING",
  "COMMIT_DETECTED",
  "PUSH_CONFIRMED",
  "AI_REVIEWING",
  "REWORK_REQUIRED",
  "PR_READY",
  "PR_OPENED",
  "MERGE_READY",
  "MERGED",
  "PREVIEW_READY",
];

function idx(s: PrototypeRunStatus): number {
  const i = ORDER.indexOf(s);
  return i >= 0 ? i : 0;
}

function atLeast(run: PrototypeRun, s: PrototypeRunStatus): boolean {
  if (run.status === "FAILED" || run.status === "BLOCKED") return false;
  return idx(run.status) >= idx(s);
}

function active(run: PrototypeRun, s: PrototypeRunStatus): boolean {
  return run.status === s;
}

/** 서버 PrototypeRun 이 있을 때 타임라인 행을 만듭니다(컴팩트). */
export function buildTimelineFromPrototypeRun(run: PrototypeRun | null): PrototypeTimelineRow[] {
  if (!run) {
    return [
      { label: "실행 기록 없음", status: "pending" },
      { label: "프롬프트 준비", status: "pending" },
      { label: "Cursor 수동/자동 생성", status: "pending" },
      { label: "Commit 감지 (미연동)", status: "pending" },
      { label: "PR / Merge (미연동)", status: "pending" },
      { label: "결과 URL", status: "pending" },
    ];
  }

  const rows: PrototypeTimelineRow[] = [
    {
      label: "프롬프트 스냅샷",
      status: atLeast(run, "PROMPT_READY") || atLeast(run, "CURSOR_REQUESTED") ? "success" : run.status === "DRAFT" ? "running" : "pending",
    },
    {
      label: run.status === "PROMPT_READY" ? "프롬프트 준비됨 (수동 실행 가능)" : "프롬프트 준비",
      status:
        atLeast(run, "CURSOR_REQUESTED") || atLeast(run, "CURSOR_RUNNING")
          ? "success"
          : active(run, "PROMPT_READY")
            ? "running"
            : "pending",
    },
    {
      label: "Cursor 에이전트",
      status:
        run.status === "FAILED" && (run.statusReason === "CURSOR_LAUNCH_FAILED" || run.statusReason === "CURSOR_POLL_FAILED")
          ? "failed"
          : atLeast(run, "COMMIT_DETECTED")
            ? "success"
            : active(run, "CURSOR_REQUESTED") || active(run, "CURSOR_RUNNING")
              ? "running"
              : run.status === "FAILED"
                ? "failed"
                : "pending",
    },
    {
      label: "Commit / Push",
      status: atLeast(run, "COMMIT_DETECTED") ? "success" : active(run, "CURSOR_RUNNING") ? "blocked" : "pending",
    },
    {
      label: "AI 검토",
      status:
        atLeast(run, "REWORK_REQUIRED") || atLeast(run, "PR_READY")
          ? "success"
          : active(run, "AI_REVIEWING")
            ? "running"
            : "pending",
    },
    {
      label: "결과 URL",
      status: run.previewUrl ? "success" : atLeast(run, "MERGED") ? "running" : "pending",
    },
  ];

  return rows;
}

export function prototypeRunStatusLabelKo(status: PrototypeRunStatus): string {
  const m: Record<PrototypeRunStatus, string> = {
    DRAFT: "초안",
    PROMPT_READY: "프롬프트 준비됨",
    CURSOR_REQUESTED: "Cursor 요청됨",
    CURSOR_RUNNING: "Cursor 실행 중",
    COMMIT_DETECTED: "커밋 감지",
    PUSH_CONFIRMED: "푸시 확인",
    AI_REVIEWING: "AI 검토",
    REWORK_REQUIRED: "보완 필요",
    PR_READY: "PR 준비",
    PR_OPENED: "PR 열림",
    MERGE_READY: "머지 준비",
    MERGED: "머지 완료",
    PREVIEW_READY: "미리보기 준비",
    FAILED: "실패",
    BLOCKED: "차단",
  };
  return m[status] ?? status;
}
