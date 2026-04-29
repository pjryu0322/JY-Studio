import { workUnitProgressFromRun } from "@/lib/prototype/prototypePlannerService";
import type { PrototypeRun, PrototypeWorkUnit, PrototypeWorkUnitStatus } from "@/lib/prototype/prototypeRunTypes";

export const WU_STATUS_ORDER: PrototypeWorkUnitStatus[] = [
  "PENDING",
  "CURSOR_RUNNING",
  "CURSOR_DONE",
  "GIT_PUSHED",
  "REVIEWING",
  "REVIEW_PASS",
  "PR_OPENED",
  "MERGED",
];

export function workUnitStatusRank(s: PrototypeWorkUnitStatus): number {
  if (s === "FAILED") return -1;
  if (s === "REVIEW_REWORK") return WU_STATUS_ORDER.indexOf("REVIEWING");
  if (s === "SKIPPED") return WU_STATUS_ORDER.indexOf("MERGED") + 1;
  const i = WU_STATUS_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

export function resolveFocusWorkUnit(run: PrototypeRun | null): PrototypeWorkUnit | null {
  if (!run?.workUnits?.length) return null;
  const sorted = [...run.workUnits].sort((a, b) => a.order - b.order);
  const failed = sorted.find((wu) => wu.status === "FAILED");
  if (failed) return failed;
  const co = run.currentWorkUnitOrder;
  if (typeof co === "number" && Number.isFinite(co)) {
    const match = sorted.find((wu) => wu.order === co);
    if (match && match.status !== "MERGED" && match.status !== "SKIPPED") return match;
  }
  return sorted.find((wu) => wu.status !== "MERGED" && wu.status !== "SKIPPED") ?? null;
}

export function workUnitRowStatusKo(u: PrototypeWorkUnit): string {
  switch (u.status) {
    case "MERGED":
      return "완료";
    case "SKIPPED":
      return "건너뜀";
    case "FAILED":
      return "실패";
    case "PENDING":
      return "대기";
    default:
      return "진행중";
  }
}

export function workUnitDetailLinesKo(u: PrototypeWorkUnit): readonly { label: string; state: string }[] {
  if (u.status === "SKIPPED") {
    return [
      { label: "Cursor 요청", state: "건너뜀" },
      { label: "코드 생성", state: "건너뜀" },
      { label: "Commit", state: "건너뜀" },
      { label: "Push", state: "건너뜀" },
      { label: "AI 검토", state: "건너뜀" },
      { label: "PR 생성", state: "건너뜀" },
      { label: "Merge", state: "건너뜀" },
    ];
  }
  const r = workUnitStatusRank(u.status);
  const failed = u.status === "FAILED";
  const rework = u.status === "REVIEW_REWORK";
  const ix = (s: PrototypeWorkUnitStatus) => WU_STATUS_ORDER.indexOf(s);
  const cell = (label: string, doneIdx: number, runIdx: number) => {
    if (failed) return { label, state: "실패" };
    if (r >= doneIdx) return { label, state: "완료" };
    if (r >= runIdx) return { label, state: "진행중" };
    return { label, state: "대기" };
  };
  const cursorReq = (): { label: string; state: string } => {
    if (failed) return { label: "Cursor 요청", state: "실패" };
    if (r >= ix("CURSOR_RUNNING")) return { label: "Cursor 요청", state: "완료" };
    return { label: "Cursor 요청", state: "대기" };
  };
  const codeGen = (): { label: string; state: string } => {
    if (failed) return { label: "코드 생성", state: "실패" };
    if (r >= ix("CURSOR_DONE")) return { label: "코드 생성", state: "완료" };
    if (r >= ix("CURSOR_RUNNING")) return { label: "코드 생성", state: "진행중" };
    return { label: "코드 생성", state: "대기" };
  };
  const commitLine = (): { label: string; state: string } => {
    if (failed) return { label: "Commit", state: "실패" };
    if (Boolean(u.commitSha?.trim()) || r >= ix("GIT_PUSHED")) return { label: "Commit", state: "완료" };
    if (r >= ix("CURSOR_DONE")) return { label: "Commit", state: "진행중" };
    return { label: "Commit", state: "대기" };
  };
  const pushLine = (): { label: string; state: string } => {
    if (failed) return { label: "Push", state: "실패" };
    if (r >= ix("GIT_PUSHED")) return { label: "Push", state: "완료" };
    if (Boolean(u.commitSha?.trim())) return { label: "Push", state: "진행중" };
    return { label: "Push", state: "대기" };
  };
  return [
    cursorReq(),
    codeGen(),
    commitLine(),
    pushLine(),
    {
      label: rework ? "AI 검토(보완 필요)" : "AI 검토",
      state: failed ? "실패" : r >= ix("REVIEW_PASS") ? "완료" : r >= ix("GIT_PUSHED") ? "진행중" : "대기",
    },
    cell("PR 생성", ix("PR_OPENED"), ix("REVIEW_PASS")),
    cell("Merge", ix("MERGED"), ix("PR_OPENED")),
  ];
}

export function workUnitSummaryLabel(
  unit: PrototypeWorkUnit,
  run: PrototypeRun | null,
  prog: ReturnType<typeof workUnitProgressFromRun>,
): { row: "done" | "running" | "pending" | "failed"; text: string } {
  if (unit.status === "MERGED") return { row: "done", text: "완료" };
  if (unit.status === "SKIPPED") return { row: "done", text: "건너뜀" };
  if (unit.status === "FAILED") return { row: "failed", text: "실패" };
  if (!prog || prog.allMerged) return { row: "done", text: "완료" };
  if (unit.order < prog.current) return { row: "done", text: "완료" };
  if (unit.order > prog.current) return { row: "pending", text: "대기" };
  if (unit.status === "PENDING" && run?.status === "WORK_UNITS_READY" && !run.cursorRunId) {
    return { row: "pending", text: "대기" };
  }
  return { row: "running", text: "진행중" };
}

export function workUnitProgressAllMerged(run: PrototypeRun | null): boolean {
  if (!run?.workUnits.length) return false;
  return run.workUnits.every((u) => u.status === "MERGED" || u.status === "SKIPPED");
}

/** WorkUnit 목록·요약용 상태 라벨(기획 화면). */
export function mapWorkUnitPlanStatusKo(status: PrototypeWorkUnitStatus): string {
  switch (status) {
    case "PENDING":
      return "대기";
    case "CURSOR_RUNNING":
    case "CURSOR_DONE":
    case "GIT_PUSHED":
    case "REVIEWING":
    case "REVIEW_PASS":
    case "PR_OPENED":
      return "진행중";
    case "MERGED":
      return "완료";
    case "FAILED":
      return "실패";
    case "REVIEW_REWORK":
      return "보완필요";
    case "SKIPPED":
      return "완료";
    default:
      return "대기";
  }
}

/**
 * 현재 패널의 활성 WorkUnit: currentWorkUnitOrder 우선, 없으면 MERGED/SKIPPED가 아닌 첫 유닛,
 * 모두 끝났고 FAILED만 있으면 해당 FAILED 유닛.
 */
export function resolveActiveWorkUnitForPanel(run: PrototypeRun | null): PrototypeWorkUnit | null {
  if (!run?.workUnits?.length) return null;
  const sorted = [...run.workUnits].sort((a, b) => a.order - b.order);
  const co = run.currentWorkUnitOrder;
  if (typeof co === "number" && Number.isFinite(co)) {
    const m = sorted.find((u) => u.order === co);
    if (m && m.status !== "MERGED" && m.status !== "SKIPPED") return m;
  }
  const notDone = sorted.find((u) => u.status !== "MERGED" && u.status !== "SKIPPED" && u.status !== "FAILED");
  if (notDone) return notDone;
  return sorted.find((u) => u.status === "FAILED") ?? null;
}

export type StepTone = "done" | "running" | "pending" | "failed" | "warn";

export function buildFiveStepPipelineRows(
  u: PrototypeWorkUnit,
): ReadonlyArray<{ key: string; label: string; stateKo: string; tone: StepTone }> {
  const mk = (key: string, label: string, stateKo: string, tone: StepTone) => ({ key, label, stateKo, tone });
  const s = u.status;
  if (s === "FAILED") {
    return ["cursor", "git", "ai", "pr", "merge"].map((k, i) =>
      mk(k, ["Cursor", "Git", "AI 검토", "PR", "Merge"][i]!, "실패", "failed"),
    );
  }
  if (s === "MERGED" || s === "SKIPPED") {
    return ["cursor", "git", "ai", "pr", "merge"].map((k, i) =>
      mk(k, ["Cursor", "Git", "AI 검토", "PR", "Merge"][i]!, "완료", "done"),
    );
  }
  if (s === "PENDING") {
    return ["cursor", "git", "ai", "pr", "merge"].map((k, i) =>
      mk(k, ["Cursor", "Git", "AI 검토", "PR", "Merge"][i]!, "대기", "pending"),
    );
  }
  if (s === "CURSOR_RUNNING") {
    return [
      mk("cursor", "Cursor", "진행중", "running"),
      mk("git", "Git", "대기", "pending"),
      mk("ai", "AI 검토", "대기", "pending"),
      mk("pr", "PR", "대기", "pending"),
      mk("merge", "Merge", "대기", "pending"),
    ];
  }
  if (s === "CURSOR_DONE") {
    return [
      mk("cursor", "Cursor", "완료", "done"),
      mk("git", "Git", "진행중", "running"),
      mk("ai", "AI 검토", "대기", "pending"),
      mk("pr", "PR", "대기", "pending"),
      mk("merge", "Merge", "대기", "pending"),
    ];
  }
  if (s === "GIT_PUSHED" || s === "REVIEWING") {
    return [
      mk("cursor", "Cursor", "완료", "done"),
      mk("git", "Git", "완료", "done"),
      mk("ai", "AI 검토", "진행중", "running"),
      mk("pr", "PR", "대기", "pending"),
      mk("merge", "Merge", "대기", "pending"),
    ];
  }
  if (s === "REVIEW_REWORK") {
    return [
      mk("cursor", "Cursor", "완료", "done"),
      mk("git", "Git", "완료", "done"),
      mk("ai", "AI 검토", "보완필요", "warn"),
      mk("pr", "PR", "대기", "pending"),
      mk("merge", "Merge", "대기", "pending"),
    ];
  }
  if (s === "REVIEW_PASS") {
    return [
      mk("cursor", "Cursor", "완료", "done"),
      mk("git", "Git", "완료", "done"),
      mk("ai", "AI 검토", "완료", "done"),
      mk("pr", "PR", "진행중", "running"),
      mk("merge", "Merge", "대기", "pending"),
    ];
  }
  if (s === "PR_OPENED") {
    return [
      mk("cursor", "Cursor", "완료", "done"),
      mk("git", "Git", "완료", "done"),
      mk("ai", "AI 검토", "완료", "done"),
      mk("pr", "PR", "완료", "done"),
      mk("merge", "Merge", "진행중", "running"),
    ];
  }
  return ["cursor", "git", "ai", "pr", "merge"].map((k, i) =>
    mk(k, ["Cursor", "Git", "AI 검토", "PR", "Merge"][i]!, "대기", "pending"),
  );
}
