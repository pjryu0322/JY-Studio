import type { PrototypeRun, PrototypeRunStatus, PrototypeRunStatusReason } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeTimelineStepStatus = "pending" | "running" | "success" | "failed" | "blocked";

export type PrototypeTimelineRow = Readonly<{ label: string; status: PrototypeTimelineStepStatus }>;

const ORDER: PrototypeRunStatus[] = [
  "DRAFT",
  "PROMPT_READY",
  "PLANNER_ANALYZING",
  "WORK_UNITS_READY",
  "CURSOR_REQUESTED",
  "CURSOR_RUNNING",
  "COMMIT_DETECTED",
  "PUSH_CONFIRMED",
  "AI_REVIEWING",
  "REWORK_REQUIRED",
  "PR_OPENED",
  "MERGED",
  "DEPLOY_CONFIGURING",
  "DEPLOYING",
  "PREVIEW_READY",
  "DEPLOY_FAILED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "FAILED",
  "BLOCKED",
];

function idx(s: PrototypeRunStatus): number {
  const i = ORDER.indexOf(s);
  return i >= 0 ? i : 0;
}

function atLeast(run: PrototypeRun, s: PrototypeRunStatus): boolean {
  if (run.status === "FAILED" || run.status === "BLOCKED") return false;
  if (run.status === "DEPLOY_FAILED") return idx(s) <= idx("MERGED");
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
      { label: prototypeRunStatusLabelKo("PLANNER_ANALYZING"), status: "pending" },
      { label: prototypeRunStatusLabelKo("WORK_UNITS_READY"), status: "pending" },
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
      label: prototypeRunStatusLabelKo("PLANNER_ANALYZING"),
      status: atLeast(run, "WORK_UNITS_READY")
        ? "success"
        : active(run, "PLANNER_ANALYZING")
          ? "running"
          : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("WORK_UNITS_READY"),
      status: atLeast(run, "CURSOR_REQUESTED")
        ? "success"
        : active(run, "WORK_UNITS_READY")
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
      status: atLeast(run, "DEPLOY_CONFIGURING") ? "success" : active(run, "MERGED") ? "running" : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("DEPLOY_CONFIGURING"),
      status: atLeast(run, "DEPLOYING") ? "success" : active(run, "DEPLOY_CONFIGURING") ? "running" : "pending",
    },
    {
      label: prototypeRunStatusLabelKo("DEPLOYING"),
      status: atLeast(run, "PREVIEW_READY") ? "success" : active(run, "DEPLOYING") ? "running" : "pending",
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
    PROMPT_READY: "프롬프트 준비",
    PLANNER_ANALYZING: "AI 기획자 분석",
    WORK_UNITS_READY: "WorkUnit 생성",
    CURSOR_REQUESTED: "Cursor 요청됨",
    CURSOR_RUNNING: "Cursor 실행 중",
    COMMIT_DETECTED: "커밋 감지됨",
    PUSH_CONFIRMED: "Git 반영(푸시)",
    AI_REVIEWING: "AI 검토중",
    REWORK_REQUIRED: "보완 필요",
    PR_OPENED: "PR 생성",
    MERGED: "Merge",
    DEPLOY_CONFIGURING: "Pages 배포 설정",
    DEPLOYING: "GitHub Pages 배포",
    PREVIEW_READY: "결과 URL 연결",
    DEPLOY_FAILED: "배포 실패",
    CANCEL_REQUESTED: "중단 요청됨",
    CANCELLED: "실행 중단됨",
    FAILED: "실패",
    BLOCKED: "차단",
  };
  return m[status] ?? status;
}

export type PrototypeLifecycleCell = "complete" | "in_progress" | "waiting" | "not_wired" | "failed" | "blocked";

export type PrototypeLifecycleRow = Readonly<{
  code: PrototypeRunStatus;
  labelKo: string;
  cell: PrototypeLifecycleCell;
}>;

export function prototypeLifecycleCellLabelKo(cell: PrototypeLifecycleCell): string {
  const m: Record<PrototypeLifecycleCell, string> = {
    complete: "완료",
    in_progress: "진행",
    waiting: "대기",
    not_wired: "미연동",
    failed: "실패",
    blocked: "차단",
  };
  return m[cell];
}

function stepNotWired(step: PrototypeRunStatus, reason: PrototypeRunStatusReason | null): boolean {
  if (step === "FAILED" || step === "BLOCKED") return false;
  if (!reason) return false;
  if (reason === "GIT_PIPELINE_NOT_IMPLEMENTED") {
    return (
      step === "COMMIT_DETECTED" ||
      step === "PUSH_CONFIRMED" ||
      step === "PR_OPENED" ||
      step === "MERGED"
    );
  }
  if (reason === "AI_REVIEW_NOT_IMPLEMENTED") {
    return step === "AI_REVIEWING" || step === "REWORK_REQUIRED";
  }
  if (
    reason === "CURSOR_API_NOT_CONNECTED" ||
    reason === "CURSOR_NOT_CONNECTED" ||
    reason === "STUB_CURSOR_ENABLED"
  ) {
    return step === "CURSOR_REQUESTED" || step === "CURSOR_RUNNING";
  }
  return false;
}

function failureOrderIndex(reason: PrototypeRunStatusReason | null): number {
  switch (reason) {
    case "CURSOR_LAUNCH_FAILED":
    case "CURSOR_POLL_FAILED":
      return ORDER.indexOf("CURSOR_RUNNING");
    case "CURSOR_API_NOT_CONNECTED":
    case "CURSOR_NOT_CONNECTED":
    case "EXECUTION_SETUP_INVALID":
    case "MANUAL_CURSOR_EXECUTION_REQUIRED":
      return ORDER.indexOf("CURSOR_REQUESTED");
    default:
      return ORDER.indexOf("PROMPT_READY");
  }
}

function computeLinearLifecycleCell(
  run: PrototypeRun | null,
  step: PrototypeRunStatus,
  effectiveReason: PrototypeRunStatusReason | null,
): PrototypeLifecycleCell {
  if (stepNotWired(step, effectiveReason)) return "not_wired";
  if (!run) return "waiting";

  if (run.status === "FAILED") {
    const fi = failureOrderIndex(run.statusReason);
    const si = ORDER.indexOf(step);
    if (si < 0) return "waiting";
    if (si < fi) return "complete";
    if (si === fi) return "failed";
    return "waiting";
  }

  if (run.status === "BLOCKED") {
    const bi = ORDER.indexOf("REWORK_REQUIRED");
    const si = ORDER.indexOf(step);
    if (si < 0) return "waiting";
    if (si < bi) return "complete";
    if (si === bi) return "blocked";
    return "waiting";
  }

  if (run.status === "DRAFT") return "waiting";

  if (run.status === "PREVIEW_READY" && step === "PREVIEW_READY") {
    return run.previewUrl ? "complete" : "in_progress";
  }

  const si = ORDER.indexOf(step);
  const ri = ORDER.indexOf(run.status);
  if (si < 0 || ri < 0) return "waiting";
  if (si < ri) return "complete";
  if (si === ri) return "in_progress";
  return "waiting";
}

function computeTerminalLifecycleCell(run: PrototypeRun | null, terminal: "FAILED" | "BLOCKED"): PrototypeLifecycleCell {
  if (!run) return "waiting";
  if (terminal === "FAILED") return run.status === "FAILED" ? "failed" : "waiting";
  return run.status === "BLOCKED" ? "blocked" : "waiting";
}

/** PrototypeRun 단계별 표(자동화 파이프라인 상태). */
export function buildPrototypeLifecycleRows(
  run: PrototypeRun | null,
  automationBlockReason: PrototypeRunStatusReason | null,
): PrototypeLifecycleRow[] {
  const effectiveReason = run?.statusReason ?? automationBlockReason;
  const linearSteps = ORDER.slice(1) as PrototypeRunStatus[];
  const rows: PrototypeLifecycleRow[] = linearSteps.map((code) => ({
    code,
    labelKo: prototypeRunStatusLabelKo(code),
    cell: computeLinearLifecycleCell(run, code, effectiveReason),
  }));
  rows.push(
    {
      code: "FAILED",
      labelKo: prototypeRunStatusLabelKo("FAILED"),
      cell: computeTerminalLifecycleCell(run, "FAILED"),
    },
    {
      code: "BLOCKED",
      labelKo: prototypeRunStatusLabelKo("BLOCKED"),
      cell: computeTerminalLifecycleCell(run, "BLOCKED"),
    },
  );
  return rows;
}
