import { formatPrototypePlannerUserMessage } from "@/lib/prototype/prototypePlannerLlm";
import { summarizeWorkUnitsForPlanner, workUnitProgressFromRun } from "@/lib/prototype/prototypePlannerService";
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

/** 서버 `inferPlannerInputFromRun` 의 repositoryStructureHint 와 동일 */
export const PROTOTYPE_PLAN_REPOSITORY_HINT =
  "Vite React 웹은 `web/package.json`, `web/vite.config.ts`, `web/index.html`, `web/src/**` 구조를 기본으로 가정합니다.";

export type PlannerUserMessagePreviewParams = Readonly<{
  projectName: string;
  plannerContext: {
    projectDescription: string;
    actorFlowSummary: string;
    featureDraftTitles: readonly string[];
    ideationSummary?: string;
  };
  selectedTemplate: string;
  promptSnapshot: string;
  userFeedback: string;
  latestRun: PrototypeRun | null;
}>;

/** AI 작업계획(OpenAI) user 메시지 — 서버 전송 본문과 동일 포맷 */
export function buildDisplayedPlannerUserMessage(p: PlannerUserMessagePreviewParams): string {
  return formatPrototypePlannerUserMessage({
    projectName: p.projectName,
    projectDescription: p.plannerContext.projectDescription,
    ideationSummary: p.plannerContext.ideationSummary ?? "",
    actorFlowSummary: p.plannerContext.actorFlowSummary,
    featureDraftTitles: p.plannerContext.featureDraftTitles,
    selectedTemplate: p.selectedTemplate,
    promptSnapshot: p.promptSnapshot,
    repositoryStructureHint: PROTOTYPE_PLAN_REPOSITORY_HINT,
    userFeedback: p.userFeedback.trim(),
    previousWorkUnitsSummary: p.latestRun?.workUnits?.length ? summarizeWorkUnitsForPlanner(p.latestRun) : "",
  });
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
  run?: PrototypeRun | null,
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
    const draftOnly =
      run?.status === "PREVIEW_READY" &&
      !String(run.publicUrl ?? "").trim() &&
      run.deploymentStatus !== "DONE";
    if (draftOnly) {
      return [
        mk("cursor", "Cursor", "완료", "done"),
        mk("git", "Git Push", "완료", "done"),
        mk("ai", "AI 검토", "완료", "done"),
        mk("pr", "Preview", "준비됨", "done"),
        mk("merge", "정식 배포", "검토 단계", "pending"),
      ];
    }
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
