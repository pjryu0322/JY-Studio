"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  fetchEnvironmentTestLast,
  fetchExecutionSetup,
  patchExecutionSetup,
  postEnvironmentTestRun,
  postExecutionSetupValidate,
  postRevealGithubAccessToken,
  type EnvironmentTestLastDto,
} from "@/components/project-spec/api";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { mergeValidateIntoSetup, type ValidateResponseData } from "@/components/project-spec/executionSetupValidateMerge";
import { ExecutionSetupPanel } from "@/components/project-spec/ExecutionSetupPanel";
import { formatTestedAt } from "@/components/project-spec/format";
import type { Project } from "@/components/project-spec/types";

type Props = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
  /** 프로젝트 OWNER만 저장된 Cursor API 키 일시 표시 */
  canRevealCursorApiKey?: boolean;
};

const PLACEHOLDERS = {
  gitRepoUrl: "https://github.com/조직이름/저장소이름",
  gitRepoName: "조직이름/저장소이름",
  baseBranch: "main",
} as const;

function toneColor(tone: "muted" | "ok" | "bad" | "warn"): string {
  if (tone === "ok") return "#15803d";
  if (tone === "bad") return "#b91c1c";
  if (tone === "warn") return "#b45309";
  return "#64748b";
}

function readinessTone(ok: boolean | null | undefined): "muted" | "ok" | "bad" | "warn" {
  if (ok === true) return "ok";
  if (ok === false) return "bad";
  return "warn";
}

/** Step 1 상태 칩: 연결됨 / 연결 안 됨 / 미검증 */
function externalConnectionChipLabel(ok: boolean | null | undefined): string {
  if (ok === true) return "연결됨";
  if (ok === false) return "연결 안 됨";
  return "미검증";
}

function normalizeWorkflowForUi(w: string | null | undefined): string {
  return String(w ?? "").trim().toLowerCase();
}

function environmentTestWorkflowLabel(wf: string | null | undefined, stage1Panel?: boolean): string {
  const w = normalizeWorkflowForUi(wf);
  if (!w) return "알 수 없음";
  if (w === EXECUTION_WORKFLOW.MERGED) return "머지 완료";
  if (w === EXECUTION_WORKFLOW.PR_OPENED) return "PR 생성 완료";
  if (w === EXECUTION_WORKFLOW.REVIEW_PENDING) return "리뷰 대기";
  if (w === EXECUTION_WORKFLOW.REVIEW_APPROVED) return "리뷰 통과";
  if (w === EXECUTION_WORKFLOW.REVIEW_REJECTED) return "리뷰 실패";
  if (w === EXECUTION_WORKFLOW.SECURITY_PENDING) return "Security 대기";
  if (w === EXECUTION_WORKFLOW.SECURITY_PASSED) return "Security 통과";
  if (w === EXECUTION_WORKFLOW.SECURITY_FAILED) return "Security 실패";
  if (w === EXECUTION_WORKFLOW.SCM_PENDING) return "SCM 대기";
  if (w === EXECUTION_WORKFLOW.MERGE_PENDING) return "SCM 머지 대기";
  if (w === EXECUTION_WORKFLOW.MERGE_BLOCKED) return "merge 차단";
  if (w === EXECUTION_WORKFLOW.VERIFY_FAILED) return "verify 실패";
  if (w === EXECUTION_WORKFLOW.PENDING_APPLY) return "GitHub 반영 확인 중";
  if (w === EXECUTION_WORKFLOW.FAILED) return "실패";
  if (w === EXECUTION_WORKFLOW.COMMITTED) return stage1Panel ? "PR 생성 시도 중" : "푸시 확인됨 (PR 처리 중)";
  if (w === EXECUTION_WORKFLOW.REVIEWING) return stage1Panel ? "PR 생성 시도 중" : "검토·동기화 중";
  if (w === EXECUTION_WORKFLOW.RUNNING) return "실행 중";
  return wf ?? w;
}

function environmentTestWorkflowInternalCode(wf: string | null | undefined): string | null {
  const w = normalizeWorkflowForUi(wf);
  if (w === EXECUTION_WORKFLOW.PR_OPENED) return "pr_opened";
  if (w === EXECUTION_WORKFLOW.MERGED) return "merged";
  return null;
}

function environmentTestTaskStatusKorean(taskStatus: string | undefined): string | null {
  const s = String(taskStatus ?? "").trim();
  if (!s || s === "TODO") return null;
  if (s === "MERGED") return "머지됨";
  if (s === "DONE") return "완료";
  if (s === "IN_PROGRESS") return "진행 중";
  return s;
}

function isStage1EnvironmentTestLast(last: Pick<EnvironmentTestLastDto, "taskKind">): boolean {
  const tk = String(last.taskKind ?? "").trim();
  return tk === "" || tk === ENV_TEST_TASK_KIND;
}

function formatStage1DurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms === 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) {
    const digits = sec >= 10 ? 0 : 1;
    return `${sec.toFixed(digits)}초`;
  }
  const minutes = Math.floor(sec / 60);
  const rest = sec - minutes * 60;
  const restLabel = rest < 0.5 ? "" : ` ${rest < 10 ? rest.toFixed(1) : Math.round(rest)}초`;
  return `${minutes}분${restLabel}`;
}

/**
 * Stage1 PR-first 스모크: `branchDetect` 시간이 비어 있으면 "생략"으로 보이지 않게 설명만 표시한다.
 */
function stage1BranchDetectTimingDisplayText(input: {
  ms: number | null;
  isLiveRow: boolean;
}): { mode: "duration" } | { mode: "note"; text: string } {
  const { ms, isLiveRow } = input;
  const finite = ms != null && Number.isFinite(ms);
  const showDuration = finite && (ms! > 0 || (isLiveRow && ms! >= 0));
  if (showDuration) return { mode: "duration" };
  if (isLiveRow) return { mode: "note", text: "PR 생성 단계에 포함 · 진행 중" };
  return { mode: "note", text: "PR 생성 단계에 포함" };
}

function stage1TimingLabel(key: string): string {
  const map: Record<string, string> = {
    branchDetect: "브랜치 확인",
    prCreation: "PR 생성",
    merge: "머지",
    cursor: "Cursor 실행",
    executor: "실행 준비",
  };
  return map[key] ?? key;
}

/** 서버 breakdown·페이즈 계산용 키 집합(순서는 누적 구간 계산용 파이프라인과 일치). */
const STAGE1_TIMING_ROW_KEYS = ["branchDetect", "prCreation", "merge", "cursor"] as const;

/** Stage1 결과 패널 표시 순서: Cursor → PR → 머지를 먼저, 브랜치 설명 행은 마지막. */
const STAGE1_TIMING_DISPLAY_KEYS = ["cursor", "prCreation", "merge", "branchDetect"] as const;

/** 실제 파이프라인 순서(누적 경과에서 “현재 단계” 한 줄을 나눌 때 사용) */
const STAGE1_PIPELINE_ORDER = ["cursor", "branchDetect", "prCreation", "merge"] as const;

function isStage1TerminalWorkflow(wfNorm: string): boolean {
  return (
    wfNorm === EXECUTION_WORKFLOW.MERGED ||
    wfNorm === EXECUTION_WORKFLOW.FAILED ||
    wfNorm === EXECUTION_WORKFLOW.VERIFY_FAILED
  );
}

/** 연속 폴링 실패 시 SYNC_LOST (3~5회 권장 구간) */
const STAGE1_POLL_SYNC_FAILURE_THRESHOLD = 4;

function computeStage1PollDisconnectFreezeMs(
  last: EnvironmentTestLastDto | null | undefined,
  sess: { taskId: string; startMs: number } | null | undefined
): number | null {
  if (last && isStage1EnvironmentTestLast(last) && typeof last.stage1ElapsedMsAtSnapshot === "number") {
    return last.stage1ElapsedMsAtSnapshot;
  }
  if (sess?.taskId === "pending") {
    return Math.max(0, Date.now() - sess.startMs);
  }
  if (!last || !isStage1EnvironmentTestLast(last)) return null;
  if (isStage1TerminalWorkflow(normalizeWorkflowForUi(last.workflowStatus))) return null;
  const tid = last.taskId;
  let anchor: number | null = null;
  if (sess && sess.taskId === tid) anchor = sess.startMs;
  else if (last.stage1RunCreatedAt) {
    const p = Date.parse(last.stage1RunCreatedAt);
    if (Number.isFinite(p)) anchor = p;
  }
  return anchor != null ? Math.max(0, Date.now() - anchor) : null;
}

function isStage1TerminalFromDto(last: EnvironmentTestLastDto): boolean {
  if (typeof last.isTerminal === "boolean") return last.isTerminal;
  return isStage1TerminalWorkflow(normalizeWorkflowForUi(last.workflowStatus));
}

/**
 * POST는 아직 `taskId`를 모르지만, 폴링으로 받은 DTO에 이미 Stage1 진행이 있으면 “시작하는 중” 대신 실시간 패널을 쓴다.
 * `pendingOnly`: true이면 이전 실행의 터미널 DTO는 무시한다(새 클릭 직후 오탐 방지).
 */
function stage1LastDtoShowsPipelineProgress(
  last: EnvironmentTestLastDto | null | undefined,
  pendingOnly: boolean
): boolean {
  if (!last || !isStage1EnvironmentTestLast(last)) return false;
  if (pendingOnly && isStage1TerminalFromDto(last)) return false;
  if (isStage1TerminalFromDto(last)) return true;
  if (last.isRunning === true) return true;
  const wf = normalizeWorkflowForUi(last.workflowStatus);
  return (
    wf === EXECUTION_WORKFLOW.RUNNING ||
    wf === EXECUTION_WORKFLOW.COMMITTED ||
    wf === EXECUTION_WORKFLOW.PENDING_APPLY ||
    wf === EXECUTION_WORKFLOW.PR_OPENED ||
    wf === EXECUTION_WORKFLOW.REVIEWING ||
    wf === EXECUTION_WORKFLOW.REVIEW_PENDING
  );
}

function sumStage1CommittedBeforeKey(
  k: (typeof STAGE1_TIMING_ROW_KEYS)[number],
  bd: Record<string, number> | null | undefined
): number {
  let s = 0;
  for (const step of STAGE1_PIPELINE_ORDER) {
    if (step === k) break;
    const v = typeof bd?.[step] === "number" && bd[step]! > 0 ? bd[step]! : 0;
    s += v;
  }
  return s;
}

/** 서버가 준 `stage1CurrentPhase`에만 ‘진행 중’ 구간을 붙여 가짜 누적을 막는다. */
function computeStage1BreakdownRowMsFromServerPhase(
  k: (typeof STAGE1_TIMING_ROW_KEYS)[number],
  bd: Record<string, number> | null | undefined,
  currentPhase: string | null | undefined,
  liveTotalMs: number | null
): number | null {
  const committed = typeof bd?.[k] === "number" && bd[k]! > 0 ? bd[k]! : null;
  if (committed != null) return committed;
  if (!currentPhase || currentPhase !== k) return null;
  if (liveTotalMs == null || !Number.isFinite(liveTotalMs)) return null;
  return Math.max(0, liveTotalMs - sumStage1CommittedBeforeKey(k, bd));
}

function computeStage1DisplayedTotalMs(input: {
  dto: EnvironmentTestLastDto | null;
  nowMs: number;
  pollOkAtClientMs: number | null;
  syncLost: boolean;
  frozenMs: number | null;
}): { totalMs: number | null; extending: boolean; staleLocal: boolean } {
  const d = input.dto;
  if (input.syncLost) {
    const m =
      input.frozenMs ??
      (d && isStage1EnvironmentTestLast(d) ? d.stage1ElapsedMsAtSnapshot : null) ??
      (d && typeof d.stage1TotalTimeMs === "number" ? d.stage1TotalTimeMs : null);
    return { totalMs: m, extending: false, staleLocal: true };
  }
  if (!d || !isStage1EnvironmentTestLast(d)) {
    return { totalMs: null, extending: false, staleLocal: false };
  }
  const terminal = isStage1TerminalFromDto(d);
  if (terminal) {
    const m =
      typeof d.stage1TotalTimeMs === "number" && d.stage1TotalTimeMs >= 0
        ? d.stage1TotalTimeMs
        : d.stage1ElapsedMsAtSnapshot ?? null;
    return { totalMs: m, extending: false, staleLocal: false };
  }
  const running = d.isRunning === true;
  if (!running) {
    return { totalMs: d.stage1ElapsedMsAtSnapshot ?? null, extending: false, staleLocal: false };
  }
  const base = d.stage1ElapsedMsAtSnapshot;
  const pollAt = input.pollOkAtClientMs;
  const staleMs = d.stage1PollStaleThresholdMs ?? 10_000;
  if (base == null || pollAt == null) {
    return { totalMs: base ?? null, extending: false, staleLocal: false };
  }
  const delta = input.nowMs - pollAt;
  const staleLocal = delta > staleMs;
  const add = staleLocal ? 0 : delta;
  return { totalMs: base + add, extending: !staleLocal, staleLocal };
}

/** 총 경과와 동일한 폴링·스테일·syncLost 규칙으로 임의 스냅샷 base(ms) 확장 */
function computeStage1DisplayedDerivedMs(input: {
  baseMs: number | null | undefined;
  nowMs: number;
  pollOkAtClientMs: number | null;
  syncLost: boolean;
  terminal: boolean;
  isRunning: boolean;
  pollStaleThresholdMs?: number | null;
}): { totalMs: number | null; extending: boolean; staleLocal: boolean } {
  if (input.syncLost) {
    const m = input.baseMs;
    return {
      totalMs: m != null && Number.isFinite(m) ? m : null,
      extending: false,
      staleLocal: true,
    };
  }
  if (input.terminal) {
    const m = input.baseMs;
    return {
      totalMs: m != null && Number.isFinite(m) ? m : null,
      extending: false,
      staleLocal: false,
    };
  }
  if (!input.isRunning) {
    return { totalMs: input.baseMs ?? null, extending: false, staleLocal: false };
  }
  const base = input.baseMs;
  const pollAt = input.pollOkAtClientMs;
  const staleMs = input.pollStaleThresholdMs ?? 10_000;
  if (base == null || !Number.isFinite(base) || pollAt == null) {
    return { totalMs: base ?? null, extending: false, staleLocal: false };
  }
  const delta = input.nowMs - pollAt;
  const staleLocal = delta > staleMs;
  const add = staleLocal ? 0 : delta;
  return { totalMs: base + add, extending: !staleLocal, staleLocal };
}

function stage1PollSyncHealthBannerText(streak: number, syncStopped: boolean): string | null {
  if (syncStopped) return null;
  if (streak >= 2) return "서버 응답 지연";
  if (streak === 1) return "서버 응답 확인 중…";
  return null;
}

function stage1EnvironmentHeadline(
  last: EnvironmentTestLastDto,
  opts: { mergeInProgress: boolean; syncLost: boolean }
): string {
  if (opts.mergeInProgress) return "머지 진행 중";
  if (opts.syncLost && !isStage1TerminalFromDto(last)) return "상태 동기화 중단";
  const wf = normalizeWorkflowForUi(last.workflowStatus);
  if (wf === EXECUTION_WORKFLOW.FAILED) {
    const http = last.stage1PrCreateFailureHttpStatus;
    const line = String(last.envTestStage1FailureLine ?? "");
    if (http != null && (/head.*invalid|invalid.*head|422/i.test(line) || /\b422\b/.test(line))) {
      return `PR 생성 실패 (HTTP ${http} / head invalid)`;
    }
    if (http != null) return `PR 생성 실패 (HTTP ${http})`;
    return "환경 연결 테스트에 실패했습니다";
  }
  if (wf === EXECUTION_WORKFLOW.MERGED) return "환경 연결 테스트가 정상 완료되었습니다.";
  if (wf === EXECUTION_WORKFLOW.PR_OPENED) return "PR이 생성되었습니다. 머지를 진행합니다.";
  if (wf === EXECUTION_WORKFLOW.PENDING_APPLY) return "GitHub 반영 확인 중";
  if (wf === EXECUTION_WORKFLOW.COMMITTED || wf === EXECUTION_WORKFLOW.REVIEWING) {
    return "PR 생성 시도 중";
  }
  if (wf === EXECUTION_WORKFLOW.RUNNING || wf === normalizeWorkflowForUi(EXECUTION_WORKFLOW.REVIEW_PENDING)) {
    return "실행 중";
  }
  const ts = String(last.taskStatus ?? "").trim();
  if (ts === "MERGED" || ts === "DONE") return "PR이 생성되었습니다. 머지를 진행합니다.";
  return "마지막 연결 테스트 상태를 확인하세요.";
}

function environmentTestStatusMessage(
  wf: string | null | undefined,
  taskStatus: string | undefined,
  taskKind?: string | null
): string {
  const w = normalizeWorkflowForUi(wf);
  const ts = String(taskStatus ?? "").trim();
  const stage1 = !taskKind || String(taskKind).trim() === ENV_TEST_TASK_KIND;
  if (w === EXECUTION_WORKFLOW.FAILED) return "환경 연결 테스트에 실패했습니다";
  if (w === EXECUTION_WORKFLOW.MERGED) {
    return stage1 ? "환경 연결 테스트가 정상 완료되었습니다." : "머지 완료";
  }
  if (w === EXECUTION_WORKFLOW.PR_OPENED) {
    return stage1 ? "PR이 생성되었습니다. 머지를 진행합니다." : "테스트 PR 생성이 완료되었습니다";
  }
  if (w === EXECUTION_WORKFLOW.PENDING_APPLY) {
    return "GitHub 반영 확인 중";
  }
  if (w === EXECUTION_WORKFLOW.COMMITTED || w === EXECUTION_WORKFLOW.REVIEWING) {
    return "PR 생성 중";
  }
  if (w === EXECUTION_WORKFLOW.RUNNING || w === normalizeWorkflowForUi(EXECUTION_WORKFLOW.REVIEW_PENDING)) {
    return "실행 중";
  }
  if (ts === "MERGED") return stage1 ? "환경 연결 테스트가 정상 완료되었습니다." : "머지 완료";
  if (ts === "DONE") return stage1 ? "PR이 생성되었습니다. 머지를 진행합니다." : "테스트 PR 생성이 완료되었습니다";
  return "마지막 연결 테스트 상태를 확인하세요.";
}

/** PR_OPENED 이후 후속 자동 진행 한 줄 요약(중복 '다음 Task' 문구 없음). Stage1 스모크 패널에서는 숨긴다. */
function environmentTestFollowUpLine(last: EnvironmentTestLastDto): string | null {
  if (isStage1EnvironmentTestLast(last)) return null;
  const wf = normalizeWorkflowForUi(last.workflowStatus);
  if (wf !== EXECUTION_WORKFLOW.PR_OPENED && wf !== EXECUTION_WORKFLOW.MERGED) return null;
  const mergeInProgress = wf === EXECUTION_WORKFLOW.PR_OPENED && Boolean(last.envTestMergeStartedAt) && !last.mergedAt;
  if (mergeInProgress) return null;
  if (last.nextTaskReady === true) {
    return "후속 작업을 바로 시작할 수 있습니다.";
  }
  if (last.nextTaskBlockedReason) {
    return last.nextTaskBlockedReason;
  }
  if (last.nextTaskId) {
    return "후속 작업은 아직 시작 조건을 충족하지 않습니다.";
  }
  return "이어서 자동으로 시작할 작업이 없습니다.";
}

type GitLinkDraft = {
  gitRepoUrl: string;
  gitRepoProvider: string;
  gitRepoName: string;
  baseBranch: string;
};

const stepBox: CSSProperties = {
  marginBottom: 14,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

export function ProjectExecutionEnvironmentPanel({
  projectId,
  project,
  canEdit,
  canRevealCursorApiKey = false,
}: Props) {
  const [executionSetup, setExecutionSetup] = useState<
    Awaited<ReturnType<typeof fetchExecutionSetup>>["json"]["data"] | null
  >(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [gitLinkDraft, setGitLinkDraft] = useState<GitLinkDraft>({
    gitRepoUrl: "",
    gitRepoProvider: "github",
    gitRepoName: "",
    baseBranch: "main",
  });
  const [busyGit, setBusyGit] = useState<"save" | "validate-repo" | null>(null);
  const [envTestLast, setEnvTestLast] = useState<EnvironmentTestLastDto | null>(null);
  const [busyEnvTest, setBusyEnvTest] = useState(false);
  const [busyGithubAuth, setBusyGithubAuth] = useState<"save" | "validate" | "delete" | "reveal" | null>(null);
  const [githubTokenDraft, setGithubTokenDraft] = useState("");
  const [githubReplaceMode, setGithubReplaceMode] = useState(false);
  const [githubTokenRevealPlaintext, setGithubTokenRevealPlaintext] = useState<string | null>(null);
  const [stage1DetailsOpen, setStage1DetailsOpen] = useState(false);
  /** Stage1 경과: 클릭 시각 기준(실행 시작 리셋). `pending`은 POST 응답 전까지 */
  const [stage1TimerSession, setStage1TimerSession] = useState<{
    taskId: string;
    startMs: number;
  } | null>(null);
  /** 1초마다 증가 — 경과 시간 표시용 리렌더 트리거 */
  const [stage1ElapsedTick, setStage1ElapsedTick] = useState(0);
  const [stage1PollSyncStopped, setStage1PollSyncStopped] = useState(false);
  const [stage1PollSyncFrozenElapsedMs, setStage1PollSyncFrozenElapsedMs] = useState<number | null>(null);
  const [stage1PollFailureStreak, setStage1PollFailureStreak] = useState(0);
  const stage1PollFailureStreakRef = useRef(0);
  const envTestLastRef = useRef<EnvironmentTestLastDto | null>(null);
  const stage1TimerSessionRef = useRef<{ taskId: string; startMs: number } | null>(null);
  /** 성공 폴링 수신 시각 — 서버 스냅샷 경과 + 클라 델타(스테일 임계 초과 시 델타 0) */
  const stage1LastPollOkAtClientRef = useRef<number | null>(null);

  useEffect(() => {
    envTestLastRef.current = envTestLast;
  }, [envTestLast]);
  useEffect(() => {
    stage1TimerSessionRef.current = stage1TimerSession;
  }, [stage1TimerSession]);

  const loadExecutionSetup = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchExecutionSetup(projectId);
      if (res.ok && json.success) {
        const row = json.data;
        setExecutionSetup(
          row
            ? {
                ...row,
                allowedPathGlobs: row.allowedPathGlobs ?? [],
              }
            : null
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    void loadExecutionSetup();
  }, [loadExecutionSetup]);

  const loadEnvTestLast = useCallback(async () => {
    if (!projectId.trim()) return;
    const pid = projectId.trim();
    const onPollDisconnect = () => {
      setStage1PollSyncStopped(true);
      let frozen = computeStage1PollDisconnectFreezeMs(envTestLastRef.current, stage1TimerSessionRef.current);
      if (frozen == null && stage1TimerSessionRef.current?.startMs != null) {
        frozen = Math.max(0, Date.now() - stage1TimerSessionRef.current.startMs);
      }
      setStage1PollSyncFrozenElapsedMs(frozen);
      const lastRef = envTestLastRef.current;
      const discBase = {
        projectId: pid,
        executionId: lastRef?.stage1ExecutionRunId ?? null,
        currentPhase: lastRef?.stage1CurrentPhase ?? null,
        workflowStatus: lastRef?.workflowStatus ?? null,
        taskStatus: lastRef?.taskStatus ?? null,
        consecutiveFailures: stage1PollFailureStreakRef.current,
        frozenElapsedMs: frozen,
      };
      console.warn(
        "[jy-orch]",
        JSON.stringify({ phase: "stage1_polling_disconnected", ...discBase })
      );
      console.warn(
        "[jy-orch]",
        JSON.stringify({ phase: "execution_timer_stopped_due_to_poll_disconnect", ...discBase })
      );
      console.warn(
        "[jy-orch]",
        JSON.stringify({
          phase: "stage1_timer_stopped_reason",
          reason: "polling_disconnected",
          ...discBase,
        })
      );
    };
    const recordPollFailure = () => {
      stage1PollFailureStreakRef.current = Math.min(stage1PollFailureStreakRef.current + 1, 4);
      const n = stage1PollFailureStreakRef.current;
      setStage1PollFailureStreak(n);
      const lastRef = envTestLastRef.current;
      const healthBase = {
        projectId: pid,
        executionId: lastRef?.stage1ExecutionRunId ?? null,
        currentPhase: lastRef?.stage1CurrentPhase ?? null,
        workflowStatus: lastRef?.workflowStatus ?? null,
        taskStatus: lastRef?.taskStatus ?? null,
        consecutiveFailures: n,
        frozenElapsedMs: null as number | null,
      };
      if (n === 1) {
        console.warn(
          "[jy-orch]",
          JSON.stringify({ phase: "stage1_polling_check_failed_once", ...healthBase })
        );
      } else if (n === 2) {
        console.warn("[jy-orch]", JSON.stringify({ phase: "stage1_polling_delayed", ...healthBase }));
      }
      if (n >= STAGE1_POLL_SYNC_FAILURE_THRESHOLD) {
        onPollDisconnect();
      }
    };
    try {
      const { res, json } = await fetchEnvironmentTestLast(projectId);
      if (res.ok && json.success && json.data) {
        stage1PollFailureStreakRef.current = 0;
        setStage1PollFailureStreak(0);
        setStage1PollSyncStopped(false);
        setStage1PollSyncFrozenElapsedMs(null);
        stage1LastPollOkAtClientRef.current = Date.now();
        setEnvTestLast(json.data.last ?? null);
        return;
      }
      recordPollFailure();
    } catch (e) {
      console.error(e);
      recordPollFailure();
    }
  }, [projectId]);

  useEffect(() => {
    void loadEnvTestLast();
  }, [loadEnvTestLast]);

  useEffect(() => {
    if (!projectId.trim()) return;
    const s1 = envTestLast && isStage1EnvironmentTestLast(envTestLast) ? envTestLast : null;
    const runningExplicit = s1?.isRunning === true;
    const legacyNonTerminal =
      s1 != null &&
      typeof s1.isRunning !== "boolean" &&
      !isStage1TerminalFromDto(s1);
    const inFlightStage1 =
      s1 != null && (runningExplicit || legacyNonTerminal) && !stage1PollSyncStopped;
    const pendingPoll =
      stage1TimerSession?.taskId === "pending" && !stage1PollSyncStopped;
    const active = busyEnvTest || pendingPoll || inFlightStage1;
    if (!active) return;
    const id = setInterval(() => {
      setStage1ElapsedTick((x) => x + 1);
      void loadEnvTestLast();
    }, 1000);
    return () => clearInterval(id);
  }, [
    projectId,
    busyEnvTest,
    stage1TimerSession?.taskId,
    envTestLast?.taskId,
    envTestLast?.taskKind,
    envTestLast?.workflowStatus,
    envTestLast?.isRunning,
    envTestLast?.isTerminal,
    stage1PollSyncStopped,
    loadEnvTestLast,
  ]);

  useEffect(() => {
    if (!stage1TimerSession || stage1TimerSession.taskId === "pending") return;
    if (!envTestLast?.taskId) return;
    if (envTestLast.taskId !== stage1TimerSession.taskId) {
      setStage1TimerSession(null);
    }
  }, [envTestLast?.taskId, stage1TimerSession]);

  useEffect(() => {
    if (!envTestLast || !isStage1EnvironmentTestLast(envTestLast)) return;
    if (!isStage1TerminalFromDto(envTestLast)) return;
    const tid = envTestLast.taskId;
    setStage1TimerSession((s) => (s && s.taskId !== "pending" && s.taskId === tid ? null : s));
  }, [envTestLast?.taskId, envTestLast?.workflowStatus, envTestLast?.taskKind, envTestLast?.isTerminal]);

  useEffect(() => {
    if (executionSetup) return;
    setGitLinkDraft((d) => ({
      ...d,
      gitRepoUrl: d.gitRepoUrl || project?.repoUrl || "",
    }));
  }, [executionSetup, project?.repoUrl]);

  const specWorkflowConfirmed = useMemo(
    () => Boolean(project?.currentSpecVersionId || project?.confirmedSpecAt),
    [project?.currentSpecVersionId, project?.confirmedSpecAt]
  );

  const gitVals = useMemo((): GitLinkDraft => {
    if (!executionSetup) return gitLinkDraft;
    return {
      gitRepoUrl: executionSetup.gitRepoUrl ?? "",
      gitRepoProvider: executionSetup.gitRepoProvider ?? "github",
      gitRepoName: executionSetup.gitRepoName ?? "",
      baseBranch: executionSetup.baseBranch || "main",
    };
  }, [executionSetup, gitLinkDraft]);

  const setGitField = useCallback(
    (patch: Partial<GitLinkDraft>) => {
      if (executionSetup) {
        setExecutionSetup((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...patch };
          if (patch.gitRepoName !== undefined) {
            next.gitRepoName = patch.gitRepoName.trim() ? patch.gitRepoName.trim() : null;
          }
          return next;
        });
      } else {
        setGitLinkDraft((d) => ({ ...d, ...patch }));
      }
    },
    [executionSetup]
  );

  const applyGithubExample = useCallback(() => {
    const ex: GitLinkDraft = {
      gitRepoUrl: "https://github.com/your-org/my-ai-chat",
      gitRepoProvider: "github",
      gitRepoName: "your-org/my-ai-chat",
      baseBranch: "main",
    };
    if (executionSetup) {
      setExecutionSetup((prev) =>
        prev
          ? {
              ...prev,
              ...ex,
              gitRepoName: ex.gitRepoName,
            }
          : prev
      );
    } else {
      setGitLinkDraft(ex);
    }
    setExecutionMessage("예시를 채웠습니다. 저장 후 검증하세요.");
  }, [executionSetup]);

  const handleSaveGit = useCallback(async () => {
    if (!projectId.trim()) return;
    setBusyGit("save");
    try {
      const { res, json } = await patchExecutionSetup(projectId, {
        gitRepoUrl: gitVals.gitRepoUrl,
        gitRepoProvider: gitVals.gitRepoProvider,
        gitRepoName: gitVals.gitRepoName.trim() || null,
        baseBranch: gitVals.baseBranch,
      });
      if (!res.ok || !json.success || !json.data) {
        setExecutionMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      setExecutionSetup(json.data);
      setExecutionMessage("저장했습니다.");
    } finally {
      setBusyGit(null);
    }
  }, [projectId, gitVals]);

  const handleEnvironmentTest = useCallback(async () => {
    if (!projectId.trim()) return;
    const startMs = Date.now();
    stage1PollFailureStreakRef.current = 0;
    setStage1PollFailureStreak(0);
    stage1LastPollOkAtClientRef.current = null;
    setStage1PollSyncStopped(false);
    setStage1PollSyncFrozenElapsedMs(null);
    setStage1TimerSession({ taskId: "pending", startMs });
    setBusyEnvTest(true);
    try {
      const { res, json } = await postEnvironmentTestRun(projectId);
      const apiSuccess = Boolean(json.success);
      const tidFromData =
        typeof json.data?.taskId === "string" && json.data.taskId.trim()
          ? json.data.taskId.trim()
          : null;
      if (json.data?.last != null) {
        setEnvTestLast(json.data.last);
        stage1LastPollOkAtClientRef.current = Date.now();
      } else {
        await loadEnvTestLast();
      }
      const tid =
        tidFromData ??
        (json.data?.last && typeof json.data.last.taskId === "string" ? json.data.last.taskId : null);
      if (tid) {
        setStage1TimerSession((s) =>
          s && s.taskId === "pending" ? { taskId: tid, startMs: s.startMs } : s
        );
      }
      if (!res.ok || !apiSuccess) {
        setStage1TimerSession(null);
        setExecutionMessage(
          (typeof json.message === "string" && json.message.trim()) ||
            (res.status === 422
              ? "연결 테스트를 시작하거나 완료하지 못했습니다."
              : "연결 테스트 요청이 실패했습니다.")
        );
        return;
      }
      setExecutionMessage(
        (typeof json.message === "string" && json.message.trim()) || "연결 테스트를 완료했습니다."
      );
    } finally {
      setBusyEnvTest(false);
    }
  }, [projectId, loadEnvTestLast]);

  const handleValidateGit = useCallback(async () => {
    if (!projectId.trim()) return;
    if (!executionSetup) {
      setExecutionMessage("먼저 저장하세요.");
      return;
    }
    setBusyGit("validate-repo");
    try {
      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "repository" });
      if (!res.ok || !json.success) {
        setExecutionMessage(json.message || "검증에 실패했습니다.");
        return;
      }
      if (json.data) {
        setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
      }
      const detail = (json.data?.messages ?? []).join(" / ");
      setExecutionMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
    } finally {
      setBusyGit(null);
    }
  }, [projectId, executionSetup]);

  if (!projectId.trim()) return null;

  const repoOk = executionSetup?.repoConnectionOk ?? null;
  const githubAuthOk = executionSetup?.githubAuthConnectionOk ?? null;
  const githubCap = executionSetup?.githubCapabilityValidation ?? null;
  /** PR 머지까지 포함한 스냅샷이 있고 operable일 때만 실행 준비에 반영 */
  const githubEffectiveOk =
    githubAuthOk === true && githubCap != null && githubCap.githubOperableOk === true;
  const cursorApiOk = executionSetup?.cursorApiConnectionOk ?? null;
  const execOk = executionSetup?.executorConnectionOk ?? null;
  const executionReady = repoOk === true && githubEffectiveOk && cursorApiOk === true && execOk === true;
  const baseBranchConfigured = Boolean(executionSetup?.baseBranch?.trim());
  const autoPushOn = executionSetup?.autoPush === true;
  const envTestStartOk = executionReady && baseBranchConfigured && autoPushOn;

  const secondaryBtn: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#fff",
    fontWeight: 600,
    fontSize: 12,
    cursor: canEdit ? "pointer" : "not-allowed",
  };

  const githubAuthSlot = (() => {
    const es = executionSetup;
    const hasTok = Boolean(es?.hasGithubAccessToken);
    const showInput = !hasTok || githubReplaceMode;
    const ghostBtn: CSSProperties = {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid #cbd5e1",
      background: "#fff",
      fontWeight: 800,
      fontSize: 12,
      cursor: !canEdit || busyGithubAuth ? "not-allowed" : "pointer",
    };
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>GitHub 인증</div>
        <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
          검증(다시 검증)은 서버에 저장된 토큰으로 수행됩니다. 토큰을 다시 입력할 필요가 없습니다. 권한 변경 시에는
          「새 토큰 교체」로 다시 저장하세요.
        </p>
        {showInput ? (
          <label style={{ display: "grid", gap: 4, marginBottom: 8, maxWidth: 720 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>GitHub Access Token</span>
            <input
              type="password"
              autoComplete="off"
              value={githubTokenDraft}
              disabled={!canEdit || !es}
              placeholder={githubReplaceMode ? "새 토큰 붙여넣기" : "ghp_… / github_pat_…"}
              onChange={(e) => setGithubTokenDraft(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
          </label>
        ) : (
          <div style={{ marginBottom: 10, fontSize: 12, color: "#334155", maxWidth: 720 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>저장된 토큰</div>
            <code
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                fontSize: 12,
                wordBreak: "break-all",
              }}
            >
              {githubTokenRevealPlaintext ?? es?.githubAccessTokenMasked ?? "—"}
            </code>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            disabled={!canEdit || !executionSetup || busyGithubAuth === "validate" || !executionSetup?.hasGithubAccessToken}
            title={!executionSetup?.hasGithubAccessToken ? "먼저 토큰을 저장하세요" : "저장된 토큰으로 GitHub 인증 검증"}
            onClick={async () => {
              if (!projectId.trim()) return;
              setBusyGithubAuth("validate");
              try {
                const { res, json } = await postExecutionSetupValidate(projectId, { scope: "github_auth" });
                if (!res.ok || !json.success) {
                  setExecutionMessage(json.message || "GitHub 인증 검증에 실패했습니다.");
                  return;
                }
                if (json.data) {
                  setExecutionSetup((p) => (p ? mergeValidateIntoSetup(p, json.data as ValidateResponseData) : p));
                }
                const detail = (json.data?.messages ?? []).join(" / ");
                setExecutionMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #0f766e",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : busyGithubAuth === "validate" ? "wait" : "pointer",
            }}
          >
            {busyGithubAuth === "validate" ? "검증 중…" : "다시 검증"}
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup || busyGithubAuth === "save"}
            onClick={async () => {
              if (!projectId.trim()) return;
              setBusyGithubAuth("save");
              try {
                const body: Parameters<typeof patchExecutionSetup>[1] = {};
                if (githubTokenDraft.trim()) body.githubAccessToken = githubTokenDraft.trim();
                const { res, json } = await patchExecutionSetup(projectId, body);
                if (!res.ok || !json.success || !json.data) {
                  setExecutionMessage(json.message || "저장에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setGithubTokenDraft("");
                setGithubReplaceMode(false);
                setGithubTokenRevealPlaintext(null);
                setExecutionMessage("GitHub 토큰을 저장했습니다. 「다시 검증」으로 연결을 확인할 수 있습니다.");
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : busyGithubAuth === "save" ? "wait" : "pointer",
            }}
          >
            {busyGithubAuth === "save" ? "저장 중…" : githubReplaceMode ? "새 토큰 저장" : "저장"}
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup || busyGithubAuth != null}
            onClick={() => {
              setGithubReplaceMode(true);
              setGithubTokenDraft("");
              setGithubTokenRevealPlaintext(null);
            }}
            style={ghostBtn}
          >
            새 토큰 교체
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup?.hasGithubAccessToken || busyGithubAuth != null}
            onClick={async () => {
              const ok = window.confirm("저장된 GitHub 토큰을 삭제합니다. 계속할까요?");
              if (!ok) return;
              if (!projectId.trim()) return;
              setBusyGithubAuth("delete");
              try {
                const { res, json } = await patchExecutionSetup(projectId, { githubAccessToken: null });
                if (!res.ok || !json.success || !json.data) {
                  setExecutionMessage(json.message || "삭제에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setGithubTokenDraft("");
                setGithubReplaceMode(false);
                setGithubTokenRevealPlaintext(null);
                setExecutionMessage("저장된 GitHub 토큰을 삭제했습니다.");
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{ ...ghostBtn, color: "#b91c1c", borderColor: "#fecaca" }}
          >
            {busyGithubAuth === "delete" ? "삭제 중…" : "삭제"}
          </button>

          <button
            type="button"
            disabled={!canEdit || !executionSetup?.hasGithubAccessToken || busyGithubAuth != null}
            onClick={async () => {
              if (!projectId.trim()) return;
              setBusyGithubAuth("reveal");
              try {
                const { res, json } = await postRevealGithubAccessToken(projectId);
                if (!res.ok || !json.success || !json.data?.plaintext) {
                  setExecutionMessage(json.message || "토큰을 표시할 수 없습니다. (프로젝트 소유자만 가능합니다.)");
                  return;
                }
                setGithubTokenRevealPlaintext(json.data.plaintext);
                setTimeout(() => setGithubTokenRevealPlaintext(null), 8000);
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={ghostBtn}
          >
            {busyGithubAuth === "reveal" ? "불러오는 중…" : "보기 / 숨기기"}
          </button>
        </div>

        {(() => {
          const cap = es?.githubCapabilityValidation;
          if (!cap) {
            if (es?.githubAuthValidatedAt && hasTok) {
              return (
                <p style={{ marginTop: 14, fontSize: 11, color: "#b45309", lineHeight: 1.55 }}>
                  세부 GitHub 권한(저장소/PR 조회/PR 생성/PR 머지) 스냅샷이 없습니다. 「다시 검증」으로 최신 권한을
                  확인하세요.
                </p>
              );
            }
            return null;
          }
          const okLabel = (v: boolean) => (v ? "정상" : "실패");
          return (
            <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.65, color: "#334155" }}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>권한 단계별 결과</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  저장소 접근: <strong>{okLabel(cap.repoAccessOk)}</strong>
                </li>
                <li>
                  PR 조회: <strong>{okLabel(cap.prReadOk)}</strong>
                </li>
                <li>
                  PR 생성 권한: <strong>{okLabel(cap.prCreateOk)}</strong>
                </li>
                <li>
                  PR 머지 권한: <strong>{okLabel(cap.prMergeOk)}</strong>
                </li>
                <li>
                  최종 GitHub 운영 가능: <strong>{cap.githubOperableOk ? "정상" : "실패"}</strong>
                </li>
              </ul>
              {cap.canonicalRepoGetAcceptedPermissions ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "#f8fafc",
                    borderRadius: 8,
                    fontSize: 10,
                    fontFamily: "ui-monospace, monospace",
                    wordBreak: "break-all",
                    color: "#334155",
                  }}
                >
                  GET /repos (기준) X-Accepted-GitHub-Permissions: {cap.canonicalRepoGetAcceptedPermissions}
                </div>
              ) : null}
              {cap.tokenSourceUsed != null ? (
                <div style={{ marginTop: 6, fontSize: 10, color: "#64748b" }}>
                  검증 시 토큰 출처: <strong>{String(cap.tokenSourceUsed).toUpperCase()}</strong>
                  {cap.validationEpoch != null ? ` · 검증 에포크: ${cap.validationEpoch}` : null}
                </div>
              ) : null}
              {!cap.githubOperableOk ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    background: "#fef2f2",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "#7f1d1d",
                    lineHeight: 1.55,
                  }}
                >
                  {cap.tokenMismatchHintKr ? (
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>{cap.tokenMismatchHintKr}</div>
                  ) : null}
                  {cap.lastErrorMessage ? <div>{cap.lastErrorMessage}</div> : null}
                  {cap.lastHttpStatus != null ? <div style={{ marginTop: 4 }}>HTTP {cap.lastHttpStatus}</div> : null}
                  {cap.acceptedPermissionsHeader ? (
                    <div style={{ marginTop: 4, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                      X-Accepted-GitHub-Permissions: {cap.acceptedPermissionsHeader}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })()}
      </div>
    );
  })();

  const externalSetupConnectedCount =
    (repoOk === true ? 1 : 0) + (githubEffectiveOk === true ? 1 : 0) + (cursorApiOk === true ? 1 : 0);

  const externalSystemsConnectionSlot = (
    <div style={{ ...stepBox, marginBottom: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.07em",
              color: "#0369a1",
              marginBottom: 6,
            }}
          >
            STEP 1
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>외부 시스템 연결</div>
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
            Git 저장소·GitHub 인증은 이 블록에서 설정합니다. Cursor API는 바로 아래 단계 카드에서 연결합니다.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 11,
                color: "#334155",
              }}
            >
              Git 저장소:{" "}
              <strong style={{ color: toneColor(readinessTone(repoOk)) }}>{externalConnectionChipLabel(repoOk)}</strong>
            </span>
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 11,
                color: "#334155",
              }}
            >
              GitHub 인증:{" "}
              <strong style={{ color: toneColor(readinessTone(githubEffectiveOk)) }}>
                {externalConnectionChipLabel(githubEffectiveOk)}
              </strong>
            </span>
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 11,
                color: "#334155",
              }}
            >
              Cursor API:{" "}
              <strong style={{ color: toneColor(readinessTone(cursorApiOk)) }}>
                {externalConnectionChipLabel(cursorApiOk)}
              </strong>
            </span>
          </div>
          <p style={{ margin: "0 0 12px 0", fontSize: 11, fontWeight: 700, color: "#475569" }}>
            연결 요약: {externalSetupConnectedCount}/3 항목 연결됨
            {executionReady ? (
              <span style={{ marginLeft: 8, color: "#15803d" }}>· 실행 준비 충족</span>
            ) : null}
          </p>
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
            예: {PLACEHOLDERS.gitRepoUrl} · {PLACEHOLDERS.gitRepoName} · {PLACEHOLDERS.baseBranch}
          </p>
          <div style={{ display: "grid", gap: 10, maxWidth: 720, marginBottom: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Repository URL</span>
              <input
                value={gitVals.gitRepoUrl}
                disabled={!canEdit}
                placeholder={PLACEHOLDERS.gitRepoUrl}
                onChange={(e) => setGitField({ gitRepoUrl: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>호스팅 제공자</span>
              <select
                value={gitVals.gitRepoProvider}
                disabled={!canEdit}
                onChange={(e) => setGitField({ gitRepoProvider: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              >
                <option value="github">GitHub</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Repository full name (owner/repo)</span>
              <input
                value={gitVals.gitRepoName}
                disabled={!canEdit}
                placeholder={PLACEHOLDERS.gitRepoName}
                onChange={(e) => setGitField({ gitRepoName: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Base branch</span>
              <input
                value={gitVals.baseBranch}
                disabled={!canEdit}
                placeholder={PLACEHOLDERS.baseBranch}
                onChange={(e) => setGitField({ baseBranch: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              disabled={!canEdit || busyGit === "save"}
              onClick={() => void handleSaveGit()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: !canEdit ? "not-allowed" : busyGit === "save" ? "wait" : "pointer",
              }}
            >
              {busyGit === "save" ? "저장 중…" : "저장소 설정 저장"}
            </button>
            <button
              type="button"
              disabled={!canEdit || busyGit === "validate-repo" || !executionSetup}
              onClick={() => void handleValidateGit()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: !canEdit || !executionSetup ? "not-allowed" : busyGit === "validate-repo" ? "wait" : "pointer",
              }}
              title={!executionSetup ? "먼저 저장하세요" : undefined}
            >
              {busyGit === "validate-repo" ? "검증 중…" : "저장소 연결 검증"}
            </button>
            <button type="button" disabled={!canEdit} onClick={() => void applyGithubExample()} style={secondaryBtn}>
              GitHub 예시 적용
            </button>
          </div>
          {githubAuthSlot}
    </div>
  );

  const stage1ValidationSlot = (
    <div>
            <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
              <strong>연결 검증</strong>은 Cursor가 브랜치에 푸시하고 PR·머지까지 진행하는지 확인합니다. Stage 2(역할 분리) 테스트는{" "}
              <strong>AI Members</strong> 탭에서 실행합니다.
            </p>
            <button
              type="button"
              disabled={!canEdit || busyEnvTest || !specWorkflowConfirmed || !envTestStartOk}
              onClick={() => void handleEnvironmentTest()}
              style={{
                padding: "12px 22px",
                borderRadius: 10,
                border: "1px solid #6d28d9",
                background: "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor:
                  !canEdit || busyEnvTest || !specWorkflowConfirmed || !envTestStartOk
                    ? "not-allowed"
                    : "pointer",
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
              }}
              title={
                !specWorkflowConfirmed
                  ? "Spec 확정 후 사용"
                  : !executionReady
                    ? "저장소·Cursor 검증 완료 필요"
                    : !baseBranchConfigured
                      ? "기본 브랜치 설정이 필요합니다"
                      : !autoPushOn
                        ? "ENV_TEST는 Push 가능한 실행 정책에서만 실행할 수 있습니다"
                        : undefined
              }
            >
              {busyEnvTest ? "실행 중…" : "연결 테스트 실행 (Stage 1)"}
            </button>
            <p style={{ margin: "10px 0 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
              Stage 2(역할 분리) 환경 테스트는 <strong>AI Members</strong> 탭에서 실행합니다.
            </p>
            {!specWorkflowConfirmed ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>Spec 확정 후 사용할 수 있습니다.</p>
            ) : null}
            {specWorkflowConfirmed && !executionReady ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>
                저장소·Cursor 검증을 모두 통과한 뒤 실행하세요.
              </p>
            ) : null}
            {specWorkflowConfirmed && executionReady && !baseBranchConfigured ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>기본 브랜치 설정이 필요합니다.</p>
            ) : null}
            {specWorkflowConfirmed && executionReady && baseBranchConfigured && !autoPushOn ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>
                ENV_TEST는 Push 가능한 실행 정책에서만 실행할 수 있습니다.
              </p>
            ) : null}
            {stage1TimerSession?.taskId === "pending" &&
            !stage1LastDtoShowsPipelineProgress(envTestLast, true) ? (
              <div style={{ marginTop: 12, fontSize: 12, color: "#334155", lineHeight: 1.65 }}>
                <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>현재 실행 결과</div>
                <div style={{ fontWeight: 600, color: "#1e293b" }}>
                  {stage1PollSyncStopped ? "서버와 상태를 동기화하지 못했습니다." : "연결 테스트를 시작하는 중입니다…"}
                </div>
                {(() => {
                  const hint = stage1PollSyncHealthBannerText(stage1PollFailureStreak, stage1PollSyncStopped);
                  return hint ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        fontSize: 11,
                        color: "#92400e",
                        fontWeight: 600,
                      }}
                    >
                      {hint}
                    </div>
                  ) : null;
                })()}
                {stage1PollSyncStopped ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#fff7ed",
                      border: "1px solid #fdba74",
                      fontSize: 11,
                      color: "#9a3412",
                      fontWeight: 600,
                    }}
                  >
                    상태 동기화 중단 — 새로고침하거나 잠시 후 다시 확인하세요.
                  </div>
                ) : null}
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 10px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ color: "#64748b" }}>경과 시간</span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {(() => {
                        void stage1ElapsedTick;
                        const ms = (() => {
                          if (stage1PollSyncStopped) {
                            const f = stage1PollSyncFrozenElapsedMs;
                            return f != null && Number.isFinite(f) ? f : 0;
                          }
                          return stage1TimerSession ? Math.max(0, Date.now() - stage1TimerSession.startMs) : 0;
                        })();
                        return formatStage1DurationMs(ms);
                      })()}
                      <span style={{ fontWeight: 500, color: "#94a3b8" }}>
                        {stage1PollSyncStopped ? " (동기화 중단)" : " (진행 중)"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : envTestLast ? (
              isStage1EnvironmentTestLast(envTestLast) ? (
                <div style={{ marginTop: 12, fontSize: 12, color: "#334155", lineHeight: 1.65 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>현재 실행 결과</div>
                  {(() => {
                    const wf = normalizeWorkflowForUi(envTestLast.workflowStatus);
                    const mergeInProgress =
                      wf === EXECUTION_WORKFLOW.PR_OPENED &&
                      Boolean(envTestLast.envTestMergeStartedAt) &&
                      !envTestLast.mergedAt;
                    const statusHeadline = stage1EnvironmentHeadline(envTestLast, {
                      mergeInProgress,
                      syncLost: stage1PollSyncStopped,
                    });
                    const bd = envTestLast.stage1TimingBreakdown ?? null;
                    const terminal = isStage1TerminalFromDto(envTestLast);
                    void stage1ElapsedTick;
                    const { totalMs, extending, staleLocal } = computeStage1DisplayedTotalMs({
                      dto: envTestLast,
                      nowMs: Date.now(),
                      pollOkAtClientMs: stage1LastPollOkAtClientRef.current,
                      syncLost: stage1PollSyncStopped,
                      frozenMs: stage1PollSyncFrozenElapsedMs,
                    });
                    const liveElapsedMs = totalMs;
                    const showRunningSuffix =
                      extending && !stage1PollSyncStopped && !terminal && liveElapsedMs != null;
                    const phaseBase = envTestLast.stage1CurrentPhaseElapsedMsAtSnapshot;
                    const phaseDerived = computeStage1DisplayedDerivedMs({
                      baseMs: phaseBase,
                      nowMs: Date.now(),
                      pollOkAtClientMs: stage1LastPollOkAtClientRef.current,
                      syncLost: stage1PollSyncStopped,
                      terminal,
                      isRunning: envTestLast.isRunning === true,
                      pollStaleThresholdMs: envTestLast.stage1PollStaleThresholdMs,
                    });
                    const syncHealthHint =
                      !terminal && stage1PollSyncHealthBannerText(stage1PollFailureStreak, stage1PollSyncStopped);
                    const stage1PrCreateFailedUi =
                      wf === EXECUTION_WORKFLOW.FAILED &&
                      (envTestLast.stage1PrCreateFailureHttpStatus != null ||
                        /\bPR 실패\b/.test(String(envTestLast.envTestStage1FailureLine ?? "")));
                    return (
                      <>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{statusHeadline}</div>
                        {syncHealthHint ? (
                          <div
                            style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: "#fffbeb",
                              border: "1px solid #fcd34d",
                              fontSize: 11,
                              color: "#92400e",
                              fontWeight: 600,
                            }}
                          >
                            {syncHealthHint}
                          </div>
                        ) : null}
                        {stage1PollSyncStopped && !isStage1TerminalFromDto(envTestLast) ? (
                          <div
                            style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: "#fff7ed",
                              border: "1px solid #fdba74",
                              fontSize: 11,
                              color: "#9a3412",
                              fontWeight: 600,
                            }}
                          >
                            상태 동기화 중단 — 새로고침하거나 잠시 후 다시 확인하세요.
                          </div>
                        ) : null}
                        <div style={{ marginTop: 6, fontSize: 11 }}>
                          <span style={{ color: "#64748b" }}>현재 상태</span>{" "}
                          <strong style={{ color: "#0f172a" }}>
                            {stage1PollSyncStopped && !isStage1TerminalFromDto(envTestLast)
                              ? "상태 동기화 중단"
                              : environmentTestWorkflowLabel(envTestLast.workflowStatus, true)}
                          </strong>
                        </div>
                        {stage1PrCreateFailedUi ? (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "10px 12px",
                              borderRadius: 8,
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              fontSize: 11,
                              lineHeight: 1.55,
                            }}
                          >
                            <div style={{ fontWeight: 800, color: "#991b1b", marginBottom: 6 }}>
                              Stage1 PR 생성 실패
                            </div>
                            {envTestLast.stage1PrCreateFailureHttpStatus != null ? (
                              <div style={{ color: "#7f1d1d" }}>
                                <span style={{ color: "#64748b" }}>HTTP</span>{" "}
                                <strong>{envTestLast.stage1PrCreateFailureHttpStatus}</strong>
                                {envTestLast.stage1PrCreateFailureGithubCode ? (
                                  <>
                                    {" "}
                                    · <span style={{ color: "#64748b" }}>코드</span>{" "}
                                    <code style={{ fontSize: 10 }}>{envTestLast.stage1PrCreateFailureGithubCode}</code>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                            {(envTestLast.stage1PrCreateFailureBranch ?? envTestLast.branchName) ? (
                              <div style={{ marginTop: 4, color: "#7f1d1d" }}>
                                <span style={{ color: "#64748b" }}>브랜치(head)</span>{" "}
                                <code style={{ fontSize: 10 }}>
                                  {envTestLast.stage1PrCreateFailureBranch ?? envTestLast.branchName}
                                </code>
                              </div>
                            ) : null}
                            {envTestLast.envTestStage1FailureLine ? (
                              <div style={{ marginTop: 6, color: "#450a0a", fontWeight: 600 }}>
                                {envTestLast.envTestStage1FailureLine}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {envTestLast.envTestStage1FailureLine && !stage1PrCreateFailedUi ? (
                          <div
                            style={{
                              marginTop: 6,
                              color: "#b91c1c",
                              fontWeight: 600,
                              fontSize: 11,
                              lineHeight: 1.5,
                            }}
                          >
                            {envTestLast.envTestStage1FailureLine}
                          </div>
                        ) : null}
                        <div
                          style={{
                            marginTop: 10,
                            padding: "10px 10px",
                            borderRadius: 8,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            fontSize: 11,
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: 4, color: "#0f172a" }}>수행 시간</div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#64748b",
                              lineHeight: 1.45,
                              marginBottom: 6,
                            }}
                          >
                            Stage1 연결 테스트는 <strong style={{ color: "#475569" }}>Cursor 실행 → PR 생성 → 머지</strong>
                            순으로 보여 줍니다. 원격 브랜치 확인은 별도 단계가 아니라{" "}
                            <strong style={{ color: "#475569" }}>PR 생성 흐름에 포함</strong>됩니다.
                          </div>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <span style={{ color: "#64748b" }}>총 수행 시간</span>
                              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                {formatStage1DurationMs(totalMs)}
                                {showRunningSuffix ? (
                                  <span style={{ fontWeight: 500, color: "#94a3b8" }}> (진행 중)</span>
                                ) : null}
                                {staleLocal && !terminal && !stage1PollSyncStopped ? (
                                  <span style={{ fontWeight: 500, color: "#94a3b8" }}>
                                    {" "}
                                    (서버 응답 지연 — 타이머 일시 정지)
                                  </span>
                                ) : null}
                                {stage1PollSyncStopped && !terminal && liveElapsedMs != null ? (
                                  <span style={{ fontWeight: 500, color: "#94a3b8" }}> (동기화 중단)</span>
                                ) : null}
                              </span>
                            </div>
                            {STAGE1_TIMING_DISPLAY_KEYS.map((k) => {
                              const committedRow =
                                typeof bd?.[k] === "number" && bd[k]! > 0 ? bd[k]! : null;
                              const phaseSnapOk =
                                typeof phaseBase === "number" &&
                                Number.isFinite(phaseBase) &&
                                k === envTestLast.stage1CurrentPhase;
                              let ms: number | null = committedRow;
                              if (ms == null && phaseSnapOk) {
                                ms = phaseDerived.totalMs;
                              }
                              if (ms == null) {
                                ms = computeStage1BreakdownRowMsFromServerPhase(
                                  k,
                                  bd,
                                  envTestLast.stage1CurrentPhase ?? null,
                                  terminal ? null : liveElapsedMs
                                );
                              }
                              const usesPhaseSnap = phaseSnapOk && committedRow == null;
                              const isLiveRow =
                                !terminal &&
                                envTestLast.isRunning === true &&
                                envTestLast.stage1CurrentPhase === k &&
                                committedRow == null &&
                                !stage1PollSyncStopped &&
                                (usesPhaseSnap ? phaseDerived.extending : true) &&
                                (ms != null || k === "branchDetect");
                              const branchDetectNote =
                                k === "branchDetect"
                                  ? stage1BranchDetectTimingDisplayText({ ms, isLiveRow })
                                  : null;
                              return (
                                <div
                                  key={k}
                                  style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                                >
                                  <span style={{ color: "#64748b" }}>{stage1TimingLabel(k)}</span>
                                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                    {branchDetectNote?.mode === "note" ? (
                                      <span
                                        style={{
                                          fontWeight: 500,
                                          color: "#475569",
                                          fontVariantNumeric: "normal",
                                        }}
                                      >
                                        {branchDetectNote.text}
                                      </span>
                                    ) : (
                                      <>
                                        {formatStage1DurationMs(ms)}
                                        {isLiveRow ? (
                                          <span style={{ fontWeight: 500, color: "#94a3b8" }}>
                                            {" "}
                                            · 진행 중
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {terminal &&
                          typeof envTestLast.stage1TopBottleneckMs === "number" &&
                          envTestLast.stage1TopBottleneckMs > 0 &&
                          envTestLast.stage1TopBottleneckStage ? (
                            <div style={{ marginTop: 8, fontSize: 10, color: "#64748b" }}>
                              가장 긴 단계:{" "}
                              <strong style={{ color: "#334155" }}>
                                {stage1TimingLabel(envTestLast.stage1TopBottleneckStage)}
                              </strong>{" "}
                              ({formatStage1DurationMs(envTestLast.stage1TopBottleneckMs)})
                            </div>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 10, fontSize: 11 }}>
                          {envTestLast.branchName ? (
                            <div>
                              <span style={{ color: "#64748b" }}>브랜치</span>{" "}
                              <code style={{ fontSize: 11 }}>{envTestLast.branchName}</code>
                            </div>
                          ) : null}
                          {envTestLast.prUrl ? (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ color: "#64748b" }}>PR</span>{" "}
                              <a href={envTestLast.prUrl} target="_blank" rel="noreferrer">
                                링크 열기
                              </a>
                            </div>
                          ) : null}
                          {wf === EXECUTION_WORKFLOW.MERGED && envTestLast.mergeCommitSha ? (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ color: "#64748b" }}>머지 커밋</span>{" "}
                              <code style={{ fontSize: 11 }}>{envTestLast.mergeCommitSha.slice(0, 7)}</code>
                            </div>
                          ) : null}
                          {wf === EXECUTION_WORKFLOW.PR_OPENED ? (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ color: "#64748b" }}>머지 상태</span>{" "}
                              {envTestLast.envTestMergeBlockedReason ? (
                                <span style={{ fontWeight: 800, color: "#b91c1c" }}>차단됨</span>
                              ) : envTestLast.envTestMergeStartedAt ? (
                                <span style={{ fontWeight: 700 }}>진행 중</span>
                              ) : (
                                <span style={{ fontWeight: 600 }}>대기 (자동 머지)</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setStage1DetailsOpen((o) => !o)}
                          style={{
                            marginTop: 10,
                            padding: 0,
                            border: "none",
                            background: "none",
                            color: "#2563eb",
                            fontWeight: 700,
                            fontSize: 11,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {stage1DetailsOpen ? "추가 정보 접기" : "추가 정보 펼치기 (작업명·타임스탬프 등)"}
                        </button>
                        {stage1DetailsOpen ? (
                          <div
                            style={{
                              marginTop: 8,
                              padding: 10,
                              borderRadius: 8,
                              border: "1px dashed #cbd5e1",
                              background: "#fff",
                              fontSize: 11,
                              color: "#475569",
                            }}
                          >
                            <div>
                              <span style={{ color: "#64748b" }}>작업 이름</span> {envTestLast.name}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <span style={{ color: "#64748b" }}>업데이트</span>{" "}
                              {formatTestedAt(envTestLast.updatedAt)}
                            </div>
                            {envTestLast.mergedAt ? (
                              <div style={{ marginTop: 4 }}>
                                <span style={{ color: "#64748b" }}>머지 시각</span>{" "}
                                {formatTestedAt(envTestLast.mergedAt)}
                              </div>
                            ) : null}
                            {(() => {
                              const code = environmentTestWorkflowInternalCode(envTestLast.workflowStatus);
                              return code ? (
                                <div style={{ marginTop: 4, fontSize: 10, color: "#94a3b8" }}>
                                  워크플로 코드 · {code}
                                </div>
                              ) : null;
                            })()}
                            {(() => {
                              const tk = environmentTestTaskStatusKorean(envTestLast.taskStatus);
                              return tk ? (
                                <div style={{ marginTop: 4 }}>
                                  <span style={{ color: "#64748b" }}>작업 상태</span> {tk}
                                </div>
                              ) : null;
                            })()}
                            {envTestLast.envTestRemoteBranchDeletedAt ? (
                              <div style={{ marginTop: 6, color: "#15803d", fontWeight: 700 }}>
                                브랜치 정리 완료 ({formatTestedAt(envTestLast.envTestRemoteBranchDeletedAt)})
                              </div>
                            ) : null}
                            {envTestLast.envTestMergeBlockedReason &&
                            envTestLast.envTestMergeBlockedReason !== envTestLast.envTestStage1FailureLine ? (
                              <div style={{ marginTop: 6, color: "#b91c1c", lineHeight: 1.5 }}>
                                머지 차단 사유(전체): {envTestLast.envTestMergeBlockedReason}
                              </div>
                            ) : null}
                            {(() => {
                              const line = environmentTestFollowUpLine(envTestLast);
                              if (!line) return null;
                              return (
                                <div style={{ marginTop: 6 }}>
                                  <span style={{ color: "#64748b" }}>후속 진행</span>{" "}
                                  <span style={{ color: "#334155" }}>{line}</span>
                                  {envTestLast.nextTaskReady === true && envTestLast.nextTaskName ? (
                                    <span style={{ fontSize: 11, color: "#64748b" }}>
                                      {" "}
                                      · {envTestLast.nextTaskName}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ marginTop: 12, fontSize: 11, color: "#334155", lineHeight: 1.65 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>최근 결과</div>
                  <div>
                    {normalizeWorkflowForUi(envTestLast.workflowStatus) === EXECUTION_WORKFLOW.PR_OPENED &&
                    envTestLast.envTestMergeStartedAt &&
                    !envTestLast.mergedAt
                      ? "머지 진행 중"
                      : environmentTestStatusMessage(
                          envTestLast.workflowStatus,
                          envTestLast.taskStatus,
                          envTestLast.taskKind
                        )}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: "#64748b" }}>작업 이름</span> {envTestLast.name}
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>상태</span>{" "}
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>
                      {environmentTestWorkflowLabel(envTestLast.workflowStatus)}
                    </span>
                    {(() => {
                      const code = environmentTestWorkflowInternalCode(envTestLast.workflowStatus);
                      return code ? (
                        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}> · {code}</span>
                      ) : null;
                    })()}
                    {(() => {
                      const tk = environmentTestTaskStatusKorean(envTestLast.taskStatus);
                      return tk ? (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}> · 작업 {tk}</span>
                      ) : null;
                    })()}
                  </div>
                  {envTestLast.branchName ? (
                    <div>
                      <span style={{ color: "#64748b" }}>브랜치</span> {envTestLast.branchName}
                    </div>
                  ) : null}
                  {envTestLast.prUrl ? (
                    <div>
                      <span style={{ color: "#64748b" }}>PR</span>{" "}
                      <a href={envTestLast.prUrl} target="_blank" rel="noreferrer">
                        링크 열기
                      </a>
                    </div>
                  ) : null}
                  {normalizeWorkflowForUi(envTestLast.workflowStatus) === EXECUTION_WORKFLOW.PR_OPENED ? (
                    <div>
                      <span style={{ color: "#64748b" }}>머지</span>{" "}
                      {envTestLast.envTestMergeBlockedReason ? (
                        <span style={{ fontWeight: 800, color: "#b91c1c" }}>차단됨</span>
                      ) : envTestLast.envTestMergeStartedAt ? (
                        <span style={{ fontWeight: 700 }}>진행 중</span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>대기 (자동 머지 진행)</span>
                      )}
                      {envTestLast.envTestMergeBlockedReason ? (
                        <div style={{ marginTop: 4, color: "#b91c1c", fontSize: 11, fontWeight: 600 }}>
                          머지 차단 사유: {envTestLast.envTestMergeBlockedReason}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {normalizeWorkflowForUi(envTestLast.workflowStatus) === EXECUTION_WORKFLOW.MERGED ? (
                    <div>
                      <span style={{ color: "#64748b" }}>머지</span>{" "}
                      <span style={{ fontWeight: 700, color: "#15803d" }}>완료</span>
                      {envTestLast.mergeCommitSha ? (
                        <span style={{ marginLeft: 6, color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>
                          {envTestLast.mergeCommitSha.slice(0, 7)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {envTestLast.mergedAt ? (
                    <div>
                      <span style={{ color: "#64748b" }}>머지 시각</span> {formatTestedAt(envTestLast.mergedAt)}
                    </div>
                  ) : null}
                  {envTestLast.envTestRemoteBranchDeletedAt ? (
                    <div style={{ color: "#15803d", fontWeight: 700 }}>
                      브랜치 정리가 완료되었습니다 ({formatTestedAt(envTestLast.envTestRemoteBranchDeletedAt)})
                    </div>
                  ) : null}
                  {(() => {
                    const line = environmentTestFollowUpLine(envTestLast);
                    if (!line) return null;
                    return (
                      <div style={{ marginTop: 6 }}>
                        <span style={{ color: "#64748b" }}>후속 진행</span>{" "}
                        <span style={{ color: "#334155" }}>{line}</span>
                        {envTestLast.nextTaskReady === true && envTestLast.nextTaskName ? (
                          <span style={{ fontSize: 11, color: "#64748b" }}> · {envTestLast.nextTaskName}</span>
                        ) : null}
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: 4, color: "#64748b" }}>
                    업데이트 {formatTestedAt(envTestLast.updatedAt)}
                  </div>
                </div>
              )
            ) : null}
    </div>
  );

  return (
    <div
      data-testid="project-execution-environment-panel"
      data-ui-label="[P-6-4] 실행 환경 — 연결·정책·검증"
      style={{ marginBottom: 8 }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a" }}>
          실행 환경 <span style={{ fontWeight: 600, color: "#64748b", fontSize: 16 }}>(Execution Environment)</span>
        </h1>
        <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          외부 시스템을 연결한 뒤 Stage 1 연결 검증으로 실제 푸시·PR 경로를 확인합니다. 실행 정책은 필요할 때만 고급 설정에서 조정합니다.
        </p>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e9d5ff",
            background: "#faf5ff",
            fontSize: 13,
            fontWeight: 700,
            color: "#5b21b6",
            lineHeight: 1.5,
          }}
        >
          1. 외부 시스템 연결 → 2. 연결 테스트 실행 → 3. (선택) 실행 정책 설정
        </div>
      </header>

      <ExecutionSetupPanel
        projectId={projectId}
        canEdit={canEdit}
        specWorkflowConfirmed={specWorkflowConfirmed}
        executionSetup={executionSetup}
        setExecutionSetup={setExecutionSetup}
        setMessage={setExecutionMessage}
        formatTestedAt={formatTestedAt}
        flatLayout
        unifiedExecutionEnvironment
        executionEnvironmentFlow
        connectionSlotBeforeCursor={externalSystemsConnectionSlot}
        connectionSlotAfterCursor={stage1ValidationSlot}
        canRevealCursorApiKey={canRevealCursorApiKey}
      />

      {executionMessage ? (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: "#334155" }} role="status">
          {executionMessage}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated 프로젝트 설정은 `ProjectExecutionEnvironmentPanel`을 사용하세요. */
export const ProjectGitIntegrationPanel = ProjectExecutionEnvironmentPanel;
