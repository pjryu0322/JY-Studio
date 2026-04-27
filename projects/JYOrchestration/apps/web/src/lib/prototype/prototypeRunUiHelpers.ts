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
  "PR_OPENED",
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

/** 서버 PrototypeRun 기반 타임라인(한국어 라벨). */
export function buildTimelineFromPrototypeRun(run: PrototypeRun | null): PrototypeTimelineRow[] {
  if (!run) {
    return [
      { label: "실행 없음 — 생성 시작 가능", status: "pending" },
      { label: prototypeRunStatusLabelKo("PROMPT_READY"), status: "pending" },
      { label: prototypeRunStatusLabelKo("CURSOR_REQUESTED"), status: "pending" },
      { label: prototypeRunStatusLabelKo("COMMIT_DETECTED"), status: "pending" },
      { label: prototypeRunStatusLabelKo("AI_REVIEWING"), status: "pending" },
      { label: prototypeRunStatusLabelKo("PREVIEW_READY"), status: "pending" },
    ];
  }

  return [
    {
      label: prototypeRunStatusLabelKo("PROMPT_READY"),
      status:
        atLeast(run, "CURSOR_REQUESTED") || atLeast(run, "CURSOR_RUNNING")
          ? "success"
          : active(run, "PROMPT_READY")
            ? "running"
            : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("CURSOR_REQUESTED"),
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
      label: prototypeRunStatusLabelKo("COMMIT_DETECTED"),
      status: atLeast(run, "PUSH_CONFIRMED") ? "success" : active(run, "COMMIT_DETECTED") ? "running" : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("PUSH_CONFIRMED"),
      status: atLeast(run, "AI_REVIEWING") || atLeast(run, "REWORK_REQUIRED") ? "success" : active(run, "PUSH_CONFIRMED") ? "running" : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("AI_REVIEWING"),
      status:
        atLeast(run, "PR_OPENED") || atLeast(run, "MERGED")
          ? "success"
          : active(run, "AI_REVIEWING") || active(run, "REWORK_REQUIRED")
            ? "running"
            : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("PR_OPENED"),
      status: atLeast(run, "MERGED") ? "success" : active(run, "PR_OPENED") ? "running" : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("MERGED"),
      status: atLeast(run, "PREVIEW_READY") ? "success" : active(run, "MERGED") ? "running" : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("PREVIEW_READY"),
      status: run.previewUrl ? "success" : "pending",
    },
  ];
}

export function prototypeRunStatusLabelKo(status: PrototypeRunStatus): string {
  const m: Record<PrototypeRunStatus, string> = {
    DRAFT: "초안",
    PROMPT_READY: "프롬프트 준비 완료",
    CURSOR_REQUESTED: "Cursor 요청됨",
    CURSOR_RUNNING: "Cursor 실행 중",
    COMMIT_DETECTED: "커밋 감지됨",
    PUSH_CONFIRMED: "푸시 확인됨",
    AI_REVIEWING: "AI 검토중",
    REWORK_REQUIRED: "보완 필요",
    PR_OPENED: "PR 생성 완료",
    MERGED: "머지 완료",
    PREVIEW_READY: "결과물 연결 완료",
    FAILED: "실패",
    BLOCKED: "차단",
  };
  return m[status] ?? status;
}
