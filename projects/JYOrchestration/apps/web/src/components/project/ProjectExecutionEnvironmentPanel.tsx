"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  fetchEnvironmentTestLast,
  fetchExecutionSetup,
  type ExecutionSetupDto,
  patchExecutionSetup,
  postEnvironmentTestRun,
  postExecutionSetupValidate,
  postRevealGithubAccessToken,
  type EnvironmentTestLastDto,
} from "@/components/project-spec/api";
import { ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import { inferGithubHttpsUrlFromOwnerRepo } from "@/lib/executionSetup/inferGithubRepoUrl";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { mergeValidateIntoSetup, type ValidateResponseData } from "@/components/project-spec/executionSetupValidateMerge";
import {
  ExecutionSetupPanel,
  type ExecutionSetupPanelHandle,
} from "@/components/project-spec/ExecutionSetupPanel";
import { ProjectIntegrationOverridesPanel } from "@/components/project/ProjectIntegrationOverridesPanel";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { postAutoGenerationTestConnection } from "@/components/project-spec/api";
import { PlanningDatabaseSettingsSection } from "@/components/planning/PlanningDatabaseSettingsSection";
import { resolveAutoGenerationSettingsConnectionState } from "@/lib/prototype/autoGenerationSettingsState";
import {
  mergeConnectionTestPreservingEnvcheckEvidence,
  type AutoGenerationSettingsConnectionTestResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";
import {
  buildEnvcheckEvidenceExecutionMessage,
  buildEnvcheckResultsFromEnvironmentTest,
} from "@/lib/prototype/envcheckConnectionResultMapper";
import {
  PrototypeEnvSettingsGithubTokenErrorContent,
  PrototypeEnvSettingsGithubTokenStepCard,
  PrototypeEnvSettingsStepCard,
} from "@/components/project/prototypeEnvSettingsUx";
import { PrototypeEnvSettingsModalLayout } from "@/components/project/PrototypeEnvSettingsModalLayout";
import {
  buildPrototypeEnvModalTableRows,
  type PrototypeEnvModalRowKey,
} from "@/lib/project/prototypeEnvSettingsModalRows";
import {
  isGithubTokenCredentialsError,
  resolvePrototypeEnvTestDisabledTitle,
} from "@/lib/project/prototypeEnvSettingsReadiness";
import {
  buildMvpAiExecutionSettingsPatch,
  llmRefinementStatusLabel,
  openaiPlannerCredentialLooksStored,
  resolvePlannerKeyUiState,
  syncEnableLlmCodeTaskRefinementFromSetup,
} from "@/lib/project/prototypeAiExecutionSettings";
import { ImplementationLlmProviderSettingsBlock } from "@/components/project/ImplementationLlmProviderSettingsBlock";
import {
  githubCredentialLooksStored,
  cursorCredentialLooksStored,
  peerGithubCredentialMasked,
  secretMaskedDisplay,
} from "@/components/project-spec/credentialUiMask";
import { formatTestedAt } from "@/components/project-spec/format";
import type { Project } from "@/components/project-spec/types";

type Props = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
  /** 프로젝트 OWNER만 저장된 Cursor API 키 일시 표시 */
  canRevealCursorApiKey?: boolean;
  /** 프로젝트 관리 설정 화면 전용 톤(문구만 조정, 로직 동일) */
  settingsSurface?: "admin" | "modal";
  settingsPurpose?: "prototype" | "env-test";
  /** modal surface: open with this settings row selected */
  initialModalRow?: PrototypeEnvModalRowKey;
  onExecutionSetupChanged?: (setup: ExecutionSetupDto) => void;
};

const PLACEHOLDERS = {
  gitRepoUrl: "https://github.com/조직이름/저장소이름",
  gitRepoName: "조직이름/저장소이름",
  baseBranch: "main",
} as const;

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
  const mergeMode = last.connectionTestMergeMode ?? "auto";
  if (wf === EXECUTION_WORKFLOW.FAILED) {
    const http = last.stage1PrCreateFailureHttpStatus;
    const line = String(last.envTestStage1FailureLine ?? "");
    if (/403|권한|permission denied|forbidden/i.test(line)) return "권한 부족";
    if (/cursor|Cursor 실행|cloud agent|agent/i.test(line)) return "Cursor 실행 실패";
    if (/repo|저장소|404|not\s*found|compare/i.test(line)) return "저장소 접근 실패";
    if (http != null && (/head.*invalid|invalid.*head|422/i.test(line) || /\b422\b/.test(line))) {
      return `PR 생성 실패 (HTTP ${http} / head invalid)`;
    }
    if (http != null) return `PR 생성 실패 (HTTP ${http})`;
    return "연결 테스트 실패";
  }
  if (wf === EXECUTION_WORKFLOW.MERGED) return "연결 테스트 성공 (Merge 완료)";
  if (wf === EXECUTION_WORKFLOW.PR_OPENED) {
    if (isStage1TerminalFromDto(last) && mergeMode === "skip" && !String(last.envTestStage1FailureLine ?? "").trim()) {
      return "연결 테스트 성공 (PR 생성 완료)";
    }
    return "PR이 생성되었습니다. 머지를 진행합니다.";
  }
  if (wf === EXECUTION_WORKFLOW.PENDING_APPLY) return "GitHub 반영 확인 중";
  if (wf === EXECUTION_WORKFLOW.COMMITTED || wf === EXECUTION_WORKFLOW.REVIEWING) {
    return "PR 생성 시도 중";
  }
  if (wf === EXECUTION_WORKFLOW.RUNNING || wf === normalizeWorkflowForUi(EXECUTION_WORKFLOW.REVIEW_PENDING)) {
    return "실행 중";
  }
  const ts = String(last.taskStatus ?? "").trim();
  if (ts === "MERGED") return "연결 테스트 성공 (Merge 완료)";
  if (ts === "DONE") {
    const lw = normalizeWorkflowForUi(last.workflowStatus);
    if (lw === EXECUTION_WORKFLOW.PR_OPENED && mergeMode === "skip") {
      return String(last.envTestStage1FailureLine ?? "").trim()
        ? "연결 테스트 실패"
        : "연결 테스트 성공 (PR 생성 완료)";
    }
    return "PR이 생성되었습니다. 머지를 진행합니다.";
  }
  return "마지막 연결 테스트 상태를 확인하세요.";
}

function environmentTestStatusMessage(
  wf: string | null | undefined,
  taskStatus: string | undefined,
  taskKind?: string | null,
  mergeMode?: "skip" | "auto" | null
): string {
  const w = normalizeWorkflowForUi(wf);
  const ts = String(taskStatus ?? "").trim();
  const stage1 = !taskKind || String(taskKind).trim() === ENV_TEST_TASK_KIND;
  const mode = mergeMode ?? "auto";
  if (w === EXECUTION_WORKFLOW.FAILED) return "연결 테스트 실패";
  if (w === EXECUTION_WORKFLOW.MERGED) {
    return stage1 ? "연결 테스트 성공 (Merge 완료)" : "머지 완료";
  }
  if (w === EXECUTION_WORKFLOW.PR_OPENED) {
    if (stage1 && mode === "skip") return "연결 테스트 성공 (PR 생성 완료)";
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
  if (ts === "MERGED") return stage1 ? "연결 테스트 성공 (Merge 완료)" : "머지 완료";
  if (ts === "DONE") {
    return stage1 ? "PR이 생성되었습니다. 머지를 진행합니다." : "테스트 PR 생성이 완료되었습니다";
  }
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
  settingsSurface,
  settingsPurpose,
  initialModalRow,
  onExecutionSetupChanged,
}: Props) {
  const isModalCompact = settingsSurface === "modal";
  const isAdminSettings = settingsSurface === "admin";
  const effectivePurpose: "prototype" | "env-test" =
    settingsPurpose ?? (isAdminSettings || isModalCompact ? "prototype" : "env-test");
  const isPrototypeMvpUi = effectivePurpose === "prototype";
  const [selectedModalRow, setSelectedModalRow] = useState<PrototypeEnvModalRowKey | null>(
    initialModalRow ?? "repo",
  );
  useEffect(() => {
    if (isModalCompact && initialModalRow) {
      setSelectedModalRow(initialModalRow);
    }
  }, [isModalCompact, initialModalRow]);
  const [executionSetup, setExecutionSetup] = useState<ExecutionSetupDto | null>(null);
  /** execution_setup 행이 없을 때 GET이 내려주는 동일 계정 peer 힌트 */
  const [peerHintsWhenNoSetup, setPeerHintsWhenNoSetup] = useState<
    NonNullable<ExecutionSetupDto["peerCredentialHints"]> | null
  >(null);
  const [connectionTestAttempted, setConnectionTestAttempted] = useState(false);
  const [localConnectionTestResult, setLocalConnectionTestResult] =
    useState<AutoGenerationSettingsConnectionTestResultV1 | null>(null);
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
  const [enableLlmCodeTaskRefinement, setEnableLlmCodeTaskRefinement] = useState(false);
  const [openaiPlannerApiKeyInput, setOpenaiPlannerApiKeyInput] = useState("");
  const [openaiPlannerApiKeyPendingDelete, setOpenaiPlannerApiKeyPendingDelete] = useState(false);
  const [openaiPlannerReplaceMode, setOpenaiPlannerReplaceMode] = useState(false);
  const [stage1DetailsOpen, setStage1DetailsOpen] = useState(false);
  /** true = PR 생성 후 자동 Merge 테스트 (mergeMode `auto`) */
  const [mergeAfterPr, setMergeAfterPr] = useState(false);
  const [busyMvpSave, setBusyMvpSave] = useState(false);
  const [busyModalValidate, setBusyModalValidate] = useState(false);
  const notifyExecutionSetupChanged = useCallback(
    (setup: ExecutionSetupDto) => {
      onExecutionSetupChanged?.(setup);
    },
    [onExecutionSetupChanged],
  );
  const executionSetupPanelRef = useRef<ExecutionSetupPanelHandle>(null);
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
        if (row) {
          setPeerHintsWhenNoSetup(null);
          setExecutionSetup({
            ...row,
            allowedPathGlobs: row.allowedPathGlobs ?? [],
          });
        } else {
          setExecutionSetup(null);
          const hints = json.peerCredentialHints;
          if (hints && (hints.githubAccessTokenMasked || hints.cursorApiTokenMasked)) {
            setPeerHintsWhenNoSetup(hints);
          } else {
            setPeerHintsWhenNoSetup(null);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    void loadExecutionSetup();
  }, [loadExecutionSetup]);

  useEffect(() => {
    setEnableLlmCodeTaskRefinement(syncEnableLlmCodeTaskRefinementFromSetup(executionSetup));
  }, [executionSetup?.enableLlmCodeTaskRefinement]);

  useEffect(() => {
    setOpenaiPlannerApiKeyInput("");
    setOpenaiPlannerApiKeyPendingDelete(false);
    setOpenaiPlannerReplaceMode(false);
  }, [projectId]);

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
          const extra: Partial<ExecutionSetupDto> = {};
          if (patch.gitRepoName !== undefined) {
            const name = String(patch.gitRepoName ?? "").trim();
            extra.gitRepoName = name ? name : null;
            const urlEmpty = !String(prev.gitRepoUrl ?? "").trim();
            const prov = String(prev.gitRepoProvider ?? "github").toLowerCase();
            if (urlEmpty && (prov === "github" || !prov)) {
              const inferred = inferGithubHttpsUrlFromOwnerRepo(name);
              if (inferred) extra.gitRepoUrl = inferred;
            }
          }
          return { ...prev, ...patch, ...extra };
        });
      } else {
        setGitLinkDraft((d) => {
          let next: GitLinkDraft = { ...d, ...patch };
          if (patch.gitRepoName !== undefined) {
            const name = String(patch.gitRepoName ?? "").trim();
            next.gitRepoName = name;
            const urlEmpty = !String(d.gitRepoUrl ?? "").trim();
            const prov = String(d.gitRepoProvider ?? "github").toLowerCase();
            if (urlEmpty && (prov === "github" || !prov)) {
              const inferred = inferGithubHttpsUrlFromOwnerRepo(name);
              if (inferred) next = { ...next, gitRepoUrl: inferred };
            }
          }
          return next;
        });
      }
    },
    [executionSetup]
  );

  const handleSaveGit = useCallback(async () => {
    if (!projectId.trim()) return;
    setBusyGit("save");
    try {
      const nameTrim = gitVals.gitRepoName.trim();
      const inferredUrl = inferGithubHttpsUrlFromOwnerRepo(nameTrim);
      const gitRepoUrlResolved =
        String(gitVals.gitRepoUrl ?? "").trim() ||
        (String(gitVals.gitRepoProvider ?? "github").toLowerCase() === "github" ? inferredUrl ?? "" : "");
      const { res, json } = await patchExecutionSetup(projectId, {
        gitRepoUrl: gitRepoUrlResolved,
        gitRepoProvider: gitVals.gitRepoProvider,
        gitRepoName: nameTrim || null,
        baseBranch: gitVals.baseBranch,
      });
      if (!res.ok || !json.success || !json.data) {
        setExecutionMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      setPeerHintsWhenNoSetup(null);
      setExecutionSetup(json.data);
      notifyExecutionSetupChanged(json.data);
      setExecutionMessage("저장했습니다.");
    } finally {
      setBusyGit(null);
    }
  }, [projectId, gitVals, notifyExecutionSetupChanged]);

  const handleMvpSaveAll = useCallback(async () => {
    if (!projectId.trim()) return;
    setBusyMvpSave(true);
    try {
      const nameTrim = gitVals.gitRepoName.trim();
      const inferredUrl = inferGithubHttpsUrlFromOwnerRepo(nameTrim);
      const gitRepoUrlResolved =
        String(gitVals.gitRepoUrl ?? "").trim() ||
        (String(gitVals.gitRepoProvider ?? "github").toLowerCase() === "github" ? inferredUrl ?? "" : "");
      const policyPatch = executionSetupPanelRef.current?.getPendingPrototypePolicyPatch?.() ?? {};
      const body: Parameters<typeof patchExecutionSetup>[1] = {
        gitRepoUrl: gitRepoUrlResolved,
        gitRepoProvider: gitVals.gitRepoProvider,
        gitRepoName: gitVals.gitRepoName.trim() || null,
        baseBranch: gitVals.baseBranch,
        ...policyPatch,
      };
      if (githubTokenDraft.trim()) body.githubAccessToken = githubTokenDraft.trim();
      Object.assign(
        body,
        buildMvpAiExecutionSettingsPatch({
          enableLlmCodeTaskRefinement,
          openaiPlannerApiKeyInput,
          openaiPlannerApiKeyPendingDelete,
        })
      );
      const { res, json } = await patchExecutionSetup(projectId, body);
      if (!res.ok || !json.success || !json.data) {
        setExecutionMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      setPeerHintsWhenNoSetup(null);
      setExecutionSetup(json.data);
      setGithubTokenDraft("");
      setGithubReplaceMode(false);
      setGithubTokenRevealPlaintext(null);
      setOpenaiPlannerApiKeyInput("");
      setOpenaiPlannerApiKeyPendingDelete(false);
      setOpenaiPlannerReplaceMode(false);
      setEnableLlmCodeTaskRefinement(syncEnableLlmCodeTaskRefinementFromSetup(json.data));
      const cursorOk = (await executionSetupPanelRef.current?.saveCursorConnection(json.data)) ?? true;
      if (!cursorOk) return;
      let latestSetup = json.data;
      const { res: vres, json: vjson } = await postExecutionSetupValidate(projectId, { scope: "all" });
      if (vres.ok && vjson.success && vjson.data) {
        latestSetup = mergeValidateIntoSetup(latestSetup, vjson.data as ValidateResponseData);
        setExecutionSetup(latestSetup);
      }
      notifyExecutionSetupChanged(latestSetup);
      await loadExecutionSetup();
      setExecutionMessage("저장했습니다.");
    } finally {
      setBusyMvpSave(false);
    }
  }, [
    projectId,
    gitVals,
    githubTokenDraft,
    enableLlmCodeTaskRefinement,
    openaiPlannerApiKeyInput,
    openaiPlannerApiKeyPendingDelete,
    notifyExecutionSetupChanged,
    loadExecutionSetup,
  ]);

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
      const mergeMode: "auto" | "skip" =
        effectivePurpose === "prototype"
          ? executionSetup?.autoPush === true && executionSetup?.stopOnOutOfScopeChange === false
            ? "auto"
            : "skip"
          : mergeAfterPr
            ? "auto"
            : "skip";
      const { res, json } = await postEnvironmentTestRun(projectId, {
        mergeMode,
        allowUnvalidated: isPrototypeMvpUi,
      });
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

      const lastDto = json.data?.last ?? null;
      let envEvidenceConnectionTest: AutoGenerationSettingsConnectionTestResultV1 | null = null;

      if (isPrototypeMvpUi) {
        setConnectionTestAttempted(true);
        const envcheckRows = buildEnvcheckResultsFromEnvironmentTest({
          responseOk: res.ok,
          apiSuccess,
          taskId: tid,
          last: lastDto,
          message: typeof json.message === "string" ? json.message : null,
        });
        let connectionResult = normalizeAutoGenerationConnectionTestResult({
          executionSetupForBasic: executionSetup,
          envcheck: envcheckRows,
          checkedAt: new Date().toISOString(),
          settingsConnectionTestOnly: true,
        });

        try {
          const { res: tcRes, json: tcJson } = await postAutoGenerationTestConnection(projectId);
          if (tcJson.data) {
            connectionResult = mergeConnectionTestPreservingEnvcheckEvidence(connectionResult, tcJson.data);
          }
          if (tcRes.ok) {
            const setupRes2 = await fetchExecutionSetup(projectId);
            if (setupRes2.res.ok && setupRes2.json.success && setupRes2.json.data) {
              setExecutionSetup(setupRes2.json.data);
              notifyExecutionSetupChanged(setupRes2.json.data);
            }
          }
        } catch (connectionTestError) {
          console.info(
            JSON.stringify({
              action: "auto_generation_connection_test_preserve_envcheck_evidence",
              projectId,
            }),
          );
          void connectionTestError;
        }

        envEvidenceConnectionTest = connectionResult;
        setLocalConnectionTestResult(connectionResult);
        setExecutionMessage(buildEnvcheckEvidenceExecutionMessage(connectionResult.envcheck));
      }

      if (!res.ok || !apiSuccess) {
        setStage1TimerSession(null);
        if (!envEvidenceConnectionTest) {
          setExecutionMessage(
            (typeof json.message === "string" && json.message.trim()) ||
              (res.status === 422
                ? "연결 테스트를 시작하거나 완료하지 못했습니다."
                : "연결 테스트 요청이 실패했습니다.")
          );
        }
        if (!isPrototypeMvpUi) {
          const setupRes = await fetchExecutionSetup(projectId);
          if (setupRes.res.ok && setupRes.json.success && setupRes.json.data) {
            setExecutionSetup(setupRes.json.data);
            notifyExecutionSetupChanged(setupRes.json.data);
          }
        }
        return;
      }
      if (!isPrototypeMvpUi) {
        setExecutionMessage(
          (typeof json.message === "string" && json.message.trim()) || "연결 테스트를 완료했습니다."
        );
      } else if (!envEvidenceConnectionTest) {
        setExecutionMessage(
          (typeof json.message === "string" && json.message.trim()) || "연결 테스트를 완료했습니다."
        );
      }
      const setupRes = await fetchExecutionSetup(projectId);
      if (setupRes.res.ok && setupRes.json.success && setupRes.json.data) {
        setExecutionSetup(setupRes.json.data);
        notifyExecutionSetupChanged(setupRes.json.data);
      }
    } finally {
      setBusyEnvTest(false);
    }
  }, [
    projectId,
    loadEnvTestLast,
    mergeAfterPr,
    effectivePurpose,
    executionSetup,
    isPrototypeMvpUi,
    executionSetup?.autoPush,
    executionSetup?.stopOnOutOfScopeChange,
    notifyExecutionSetupChanged,
  ]);

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
        const merged = mergeValidateIntoSetup(executionSetup, json.data as ValidateResponseData);
        setExecutionSetup(merged);
        notifyExecutionSetupChanged(merged);
      }
      const detail = (json.data?.messages ?? []).join(" / ");
      setExecutionMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? ""));
    } finally {
      setBusyGit(null);
    }
  }, [projectId, executionSetup, notifyExecutionSetupChanged]);

  const handleModalValidateAll = useCallback(async () => {
    if (!projectId.trim()) return;
    if (!executionSetup) {
      setExecutionMessage("먼저 저장하세요.");
      return;
    }
    setBusyModalValidate(true);
    try {
      const { res, json } = await postExecutionSetupValidate(projectId, { scope: "all" });
      if (!res.ok || !json.success) {
        setExecutionMessage(json.message || "검증에 실패했습니다.");
        return;
      }
      if (json.data) {
        const merged = mergeValidateIntoSetup(executionSetup, json.data as ValidateResponseData);
        setExecutionSetup(merged);
        notifyExecutionSetupChanged(merged);
      }
      const detail = (json.data?.messages ?? []).join(" / ");
      setExecutionMessage(detail ? `${json.message ?? ""} · ${detail}` : (json.message ?? "검증을 완료했습니다."));
    } finally {
      setBusyModalValidate(false);
    }
  }, [projectId, executionSetup, notifyExecutionSetupChanged]);

  const connectionTestSatisfied = useMemo(() => {
    const last = envTestLast;
    if (!last || !isStage1EnvironmentTestLast(last)) return false;
    if (!isStage1TerminalFromDto(last)) return false;
    const wf = normalizeWorkflowForUi(last.workflowStatus);
    if (wf === EXECUTION_WORKFLOW.FAILED || wf === EXECUTION_WORKFLOW.VERIFY_FAILED) return false;
    if (String(last.envTestStage1FailureLine ?? "").trim()) return false;
    if (wf === EXECUTION_WORKFLOW.MERGED) return true;
    const mode = last.connectionTestMergeMode ?? "auto";
    if (wf === EXECUTION_WORKFLOW.PR_OPENED && mode === "skip") return true;
    return false;
  }, [envTestLast]);

  const modalTableRows = useMemo(
    () => buildPrototypeEnvModalTableRows({ executionSetup }),
    [executionSetup],
  );

  const autoGenConnectionState = useMemo(
    () => resolveAutoGenerationSettingsConnectionState(executionSetup),
    [executionSetup],
  );

  const displayedConnectionTest =
    localConnectionTestResult ?? autoGenConnectionState.connectionTest;

  useEffect(() => {
    if (autoGenConnectionState.connectionTest?.checkedAt) {
      setConnectionTestAttempted(true);
    }
  }, [autoGenConnectionState.connectionTest?.checkedAt]);

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
  const envTestStartOk = (() => {
    if (!isPrototypeMvpUi) return executionReady && baseBranchConfigured && autoPushOn;
    const es = executionSetup ?? null;
    if (!es) return false;
    const repoConfigured = Boolean(String(es.gitRepoUrl ?? "").trim()) && Boolean(String(es.gitRepoName ?? "").trim());
    const ghTokStored = githubCredentialLooksStored(es);
    const curTokStored = cursorCredentialLooksStored(es);
    return repoConfigured && baseBranchConfigured && ghTokStored && curTokStored;
  })();

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
        {effectivePurpose === "prototype" &&
        es?.peerCredentialHints?.githubAccessTokenMasked &&
        !es?.hasGithubAccessToken ? (
          <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "#0369a1", lineHeight: 1.55 }}>
            동일 계정의 다른 프로젝트에서 검증된 GitHub 토큰 마스크:{" "}
            <code style={{ fontSize: 10 }}>{es.peerCredentialHints.githubAccessTokenMasked}</code> — 필요 시 그
            프로젝트에서 토큰을 확인해 여기에 저장하세요.
          </p>
        ) : null}
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
                notifyExecutionSetupChanged(json.data);
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
                notifyExecutionSetupChanged(json.data);
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

  const gitRepositorySlot = (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 10, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
        Git 저장소 URL과 기본 브랜치를 입력한 뒤 저장/검증을 실행하세요.
      </div>
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Git 저장소 URL</span>
          <input
            value={gitVals.gitRepoUrl}
            disabled={!canEdit}
            placeholder={PLACEHOLDERS.gitRepoUrl}
            onChange={(e) => setGitField({ gitRepoUrl: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>저장소명 owner/repo</span>
          <input
            value={gitVals.gitRepoName}
            disabled={!canEdit}
            placeholder={PLACEHOLDERS.gitRepoName}
            onChange={(e) => setGitField({ gitRepoName: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>기본 브랜치</span>
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
          {busyGit === "validate-repo" ? "검증 중…" : "저장소·GitHub 검증"}
        </button>
      </div>
    </div>
  );

  const stage1ValidationSlotExpanded = (
    <div>
            <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
              <strong>연결 테스트</strong>를 누르면 Cursor가 Hello World 수준의 작은 파일을 만들고 Git에 커밋한 뒤 원격으로
              푸시합니다. 그다음 <strong>플랫폼</strong>이 GitHub에서 PR을 열고, 아래 옵션에 따라 머지까지 진행합니다(PR은
              Cursor가 만들지 않습니다).
            </p>
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 12,
                fontSize: 12.5,
                color: "#334155",
                cursor: !canEdit ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={mergeAfterPr}
                disabled={!canEdit}
                onChange={(e) => setMergeAfterPr(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>PR 생성 후 자동 Merge 테스트</strong>
                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
                  ON이면 PR 생성 후 자동 머지까지 수행합니다. OFF이면 PR 생성 완료 시 성공으로 처리합니다.
                </span>
              </span>
            </label>
            <button
              type="button"
              disabled={!canEdit || busyEnvTest || !envTestStartOk}
              onClick={() => void handleEnvironmentTest()}
              style={{
                padding: "12px 22px",
                borderRadius: 10,
                border: "1px solid #6d28d9",
                background: "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: !canEdit || busyEnvTest || !envTestStartOk ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
              }}
              title={
                !executionReady
                  ? "저장소·Cursor 검증 완료 필요"
                  : !baseBranchConfigured
                    ? "기본 브랜치 설정이 필요합니다"
                    : !autoPushOn
                      ? "연결 테스트는 Push 가능한 실행 정책에서만 실행할 수 있습니다"
                      : undefined
              }
            >
              {busyEnvTest ? "실행 중…" : "연결 테스트"}
            </button>
            {!executionReady ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>
                저장소·Cursor 검증을 모두 통과한 뒤 실행하세요.
              </p>
            ) : null}
            {executionReady && !baseBranchConfigured ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>기본 브랜치 설정이 필요합니다.</p>
            ) : null}
            {executionReady && baseBranchConfigured && !autoPushOn ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309" }}>
                연결 테스트는 Push 가능한 실행 정책에서만 실행할 수 있습니다.
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
                            <div style={{ fontWeight: 800, color: "#991b1b", marginBottom: 6 }}>PR 생성 실패</div>
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
                            연결 테스트는{" "}
                            <strong style={{ color: "#475569" }}>
                              Cursor(파일·커밋·푸시) → 플랫폼 PR → 머지(옵션)
                            </strong>
                            순으로 보여 줍니다. GitHub에 브랜치가 보이는지는{" "}
                            <strong style={{ color: "#475569" }}>PR 생성 단계와 함께</strong> 확인합니다.
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
                              ) : envTestLast.connectionTestMergeMode === "skip" && isStage1TerminalFromDto(envTestLast) ? (
                                <span style={{ fontWeight: 700, color: "#15803d" }}>완료 (머지 생략)</span>
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
                          envTestLast.taskKind,
                          envTestLast.connectionTestMergeMode ?? null
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

  const stage1ValidationSlot = stage1ValidationSlotExpanded;

  /** 이 프로젝트 execution_setup 행에만 저장된 토큰 */
  const githubTokenOnThisProject = githubCredentialLooksStored(executionSetup);
  /** 동일 계정 다른 프로젝트에서 온 마스크 힌트(행 없을 때 GET peerCredentialHints 포함) */
  const githubPeerMask =
    peerGithubCredentialMasked(executionSetup) ??
    (String(peerHintsWhenNoSetup?.githubAccessTokenMasked ?? "").trim() || null);
  const plannerKeyOnThisProject = openaiPlannerCredentialLooksStored(executionSetup);
  const plannerKeyUi = resolvePlannerKeyUiState({
    executionSetup,
    pendingDelete: openaiPlannerApiKeyPendingDelete,
  });

  const envTestDisabledTitle = isPrototypeMvpUi
    ? resolvePrototypeEnvTestDisabledTitle({
        isPrototypeMvpUi: true,
        executionSetup,
        baseBranchConfigured,
      })
    : !executionReady
      ? "저장소·GitHub·Cursor 검증을 통과해야 합니다"
      : !baseBranchConfigured
        ? "기본 브랜치가 필요합니다"
        : !autoPushOn
          ? "연결 테스트는 Push 가능한 실행 정책에서만 실행할 수 있습니다"
          : undefined;

  const modalGithubRepoFields = isModalCompact ? (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>owner/repo</span>
        <input
          value={gitVals.gitRepoName}
          disabled={!canEdit}
          placeholder={PLACEHOLDERS.gitRepoName}
          onChange={(e) => setGitField({ gitRepoName: e.target.value })}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>기본 브랜치</span>
        <input
          value={gitVals.baseBranch}
          disabled={!canEdit}
          placeholder={PLACEHOLDERS.baseBranch}
          onChange={(e) => setGitField({ baseBranch: e.target.value })}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
      </label>
      <div style={{ fontSize: 12, color: "#475569" }}>
        <span style={{ fontWeight: 700, color: "#334155" }}>자동 생성 URL: </span>
        <code style={{ fontSize: 12, wordBreak: "break-all" }}>
          {inferGithubHttpsUrlFromOwnerRepo(gitVals.gitRepoName.trim()) ?? "—"}
        </code>
      </div>
    </div>
  ) : null;

  const mvpGithubRepoFields = isPrototypeMvpUi && !isModalCompact ? (
    <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>저장소 URL</span>
          <input
            value={gitVals.gitRepoUrl}
            disabled={!canEdit}
            placeholder={PLACEHOLDERS.gitRepoUrl}
            onChange={(e) => setGitField({ gitRepoUrl: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>owner/repo</span>
          <input
            value={gitVals.gitRepoName}
            disabled={!canEdit}
            placeholder={PLACEHOLDERS.gitRepoName}
            onChange={(e) => setGitField({ gitRepoName: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>기본 브랜치</span>
          <input
            value={gitVals.baseBranch}
            disabled={!canEdit}
            placeholder={PLACEHOLDERS.baseBranch}
            onChange={(e) => setGitField({ baseBranch: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
    </div>
  ) : null;

  const mvpGithubTokenFields = isPrototypeMvpUi ? (
    <div>
        {githubPeerMask && !githubTokenOnThisProject ? (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #bae6fd",
              background: "#f0f9ff",
              fontSize: 12,
              color: "#0c4a6e",
              lineHeight: 1.55,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6, color: "#075985" }}>다른 프로젝트에만 저장된 토큰 (참고)</div>
            <div style={{ fontSize: 11, color: "#0369a1", marginBottom: 8 }}>
              자동으로 이 프로젝트에 복사되지는 않습니다. 아래에 PAT를 붙여넣은 뒤 하단「저장」을 누르면 이 프로젝트에 저장됩니다.
            </div>
            <code
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #7dd3fc",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                wordBreak: "break-all",
                color: "#0f172a",
              }}
            >
              {githubPeerMask}
            </code>
          </div>
        ) : null}
        {!githubTokenOnThisProject || githubReplaceMode ? (
          <label style={{ display: "grid", gap: 4, marginBottom: 8, maxWidth: 720 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Personal Access Token</span>
            {githubReplaceMode && githubTokenOnThisProject ? (
              <div style={{ marginBottom: 6, fontSize: 11, color: "#475569", lineHeight: 1.45 }}>
                현재 저장:{" "}
                <code style={{ fontSize: 11, color: "#0f172a" }}>
                  {secretMaskedDisplay(
                    executionSetup?.githubAccessTokenMasked ?? null,
                    githubTokenRevealPlaintext,
                    githubTokenOnThisProject
                  )}
                </code>
              </div>
            ) : null}
            <input
              type="password"
              autoComplete="off"
              value={githubTokenDraft}
              disabled={!canEdit}
              placeholder={
                githubReplaceMode
                  ? "새 토큰 붙여넣기"
                  : githubTokenOnThisProject
                    ? "(서버에 저장됨)"
                    : githubPeerMask
                      ? "이 프로젝트에 쓸 PAT 붙여넣기 (자동 복사 없음)"
                      : "ghp_… / github_pat_…"
              }
              onChange={(e) => setGithubTokenDraft(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
          </label>
        ) : (
          <div style={{ marginBottom: 10, fontSize: 12, color: "#334155", maxWidth: 720 }}>
            <code
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 8,
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                fontSize: 13,
                wordBreak: "break-all",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: 0.02,
                color: "#0f172a",
              }}
            >
              {secretMaskedDisplay(
                executionSetup?.githubAccessTokenMasked ?? null,
                githubTokenRevealPlaintext,
                githubTokenOnThisProject
              )}
            </code>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            disabled={!canEdit || !githubTokenOnThisProject || busyGithubAuth != null}
            onClick={() => {
              setGithubReplaceMode(true);
              setGithubTokenDraft("");
              setGithubTokenRevealPlaintext(null);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : "pointer",
            }}
          >
            새 토큰 교체
          </button>
          <button
            type="button"
            disabled={!canEdit || !githubTokenOnThisProject || busyGithubAuth != null}
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
                notifyExecutionSetupChanged(json.data);
                setGithubTokenDraft("");
                setGithubReplaceMode(false);
                setGithubTokenRevealPlaintext(null);
                setExecutionMessage("GitHub 토큰을 삭제했습니다.");
              } finally {
                setBusyGithubAuth(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#b91c1c",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : "pointer",
            }}
          >
            {busyGithubAuth === "delete" ? "삭제 중…" : "삭제"}
          </button>
          <button
            type="button"
            disabled={!canEdit || !githubTokenOnThisProject || busyGithubAuth != null}
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
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit ? "not-allowed" : "pointer",
            }}
          >
            {busyGithubAuth === "reveal" ? "불러오는 중…" : "토큰 보기"}
          </button>
        </div>
      {executionSetup?.githubCapabilityValidation != null &&
      executionSetup.githubCapabilityValidation.githubOperableOk === false &&
      !isGithubTokenCredentialsError(executionSetup.githubCapabilityValidation) ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 11, fontWeight: 700, color: "#b45309", cursor: "pointer" }}>
            GitHub 권한 검증 상세
          </summary>
          <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b45309", lineHeight: 1.45 }}>
            {executionSetup.githubCapabilityValidation.lastErrorMessage ?? "GitHub 권한을 확인할 수 없습니다."}
          </p>
        </details>
      ) : null}
    </div>
  ) : null;

  const mvpAiExecutionSettingsFields = isPrototypeMvpUi && !isModalCompact ? (
    <div id="execution-ai-settings-panel" data-testid="execution-ai-settings-panel">
      <p style={{ margin: "0 0 10px 0", fontSize: 12, fontWeight: 700, color: "#475569", lineHeight: 1.55 }}>
        LLM 기반 CodeTask 정제는 기획 내용을 실제 Cursor 작업 단위로 더 정교하게 분해합니다. 비활성화 시 기본
        규칙(heuristic) 기반으로 CodeTask를 생성합니다.
      </p>
      <p style={{ margin: "0 0 12px 0", fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
        LLM 기반 CodeTask 정제는 Quick Design 확정 시 자동으로 적용됩니다. 설정 변경 후 기획단계를 초기화하고 Quick
        Design을 다시 확정하면 새 설정으로 구현준비 산출물이 생성됩니다.
      </p>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          padding: "8px 0",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>LLM 기반 CodeTask 정제 사용</span>
        <input
          type="checkbox"
          data-testid="enable-llm-codetask-refinement-toggle"
          disabled={!canEdit}
          checked={enableLlmCodeTaskRefinement}
          onChange={(e) => setEnableLlmCodeTaskRefinement(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: canEdit ? "pointer" : "not-allowed" }}
        />
      </label>

      <div style={{ marginBottom: 10, fontSize: 12, color: "#334155" }}>
        <span style={{ fontWeight: 800 }}>Planner API Key: </span>
        <span data-testid="planner-api-key-status">{plannerKeyUi.statusLabel}</span>
        {openaiPlannerApiKeyPendingDelete ? (
          <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309", fontWeight: 700 }}>
            (저장 시 삭제됩니다)
          </span>
        ) : null}
      </div>

      {!plannerKeyUi.hasKey || openaiPlannerReplaceMode ? (
        <label style={{ display: "grid", gap: 4, marginBottom: 8, maxWidth: 720 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>OpenAI Planner API Key</span>
          {openaiPlannerReplaceMode && plannerKeyUi.hasKey ? (
            <div style={{ marginBottom: 6, fontSize: 11, color: "#475569", lineHeight: 1.45 }}>
              현재 저장:{" "}
              <code style={{ fontSize: 11, color: "#0f172a" }} data-testid="planner-api-key-masked">
                {plannerKeyUi.masked}
              </code>
            </div>
          ) : null}
          <input
            type="password"
            autoComplete="off"
            data-testid="openai-planner-api-key-input"
            value={openaiPlannerApiKeyInput}
            disabled={!canEdit}
            placeholder={openaiPlannerReplaceMode ? "새 키 붙여넣기" : "sk-…"}
            onChange={(e) => setOpenaiPlannerApiKeyInput(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
          />
        </label>
      ) : (
        <div style={{ marginBottom: 10, fontSize: 12, color: "#334155", maxWidth: 720 }}>
          <code
            data-testid="planner-api-key-masked"
            style={{
              display: "block",
              padding: "8px 10px",
              borderRadius: 8,
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              fontSize: 13,
              wordBreak: "break-all",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: 0.02,
              color: "#0f172a",
            }}
          >
            {plannerKeyUi.masked}
          </code>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button
          type="button"
          disabled={!canEdit || !plannerKeyUi.hasKey}
          onClick={() => {
            setOpenaiPlannerReplaceMode(true);
            setOpenaiPlannerApiKeyInput("");
            setOpenaiPlannerApiKeyPendingDelete(false);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: !canEdit || !plannerKeyUi.hasKey ? "not-allowed" : "pointer",
          }}
        >
          새 키로 교체
        </button>
        <button
          type="button"
          disabled={!canEdit || !plannerKeyOnThisProject || openaiPlannerApiKeyPendingDelete}
          onClick={() => {
            const ok = window.confirm("저장된 Planner API Key를 삭제합니다. 저장 버튼을 누르면 반영됩니다. 계속할까요?");
            if (!ok) return;
            setOpenaiPlannerApiKeyPendingDelete(true);
            setOpenaiPlannerApiKeyInput("");
            setOpenaiPlannerReplaceMode(false);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fff",
            color: "#b91c1c",
            fontWeight: 800,
            fontSize: 12,
            cursor: !canEdit ? "not-allowed" : "pointer",
          }}
        >
          삭제
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.55 }}>
        LLM 기반 CodeTask 정제는 Planner API Key가 설정된 경우 기획 확정/구현준비 동기화 시 사용됩니다.
      </p>

      <ImplementationLlmProviderSettingsBlock
        projectId={projectId}
        canEdit={canEdit}
        hasProjectApiKey={plannerKeyOnThisProject}
        openaiPlannerApiKeyMasked={executionSetup?.openaiPlannerApiKeyMasked ?? null}
        initialProjectConfig={executionSetup?.implementationLlmProviderConfig ?? null}
        onSaved={(config) =>
          setExecutionSetup((prev) => (prev ? { ...prev, implementationLlmProviderConfig: config } : prev))
        }
        onProjectApiKeySaved={(hasKey, masked) =>
          setExecutionSetup((prev) =>
            prev
              ? {
                  ...prev,
                  hasOpenaiPlannerApiKey: hasKey,
                  openaiPlannerApiKeyMasked: masked,
                }
              : prev,
          )
        }
      />
    </div>
  ) : null;

  const prototypeMvpAiConnectionStatus = isPrototypeMvpUi && !isModalCompact ? (
    <div
      data-testid="prototype-ai-connection-status"
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontSize: 12,
        color: "#475569",
        lineHeight: 1.55,
      }}
    >
      <div>
        <span style={{ fontWeight: 800, color: "#334155" }}>Planner API Key: </span>
        {plannerKeyUi.statusLabel}
      </div>
      <div>
        <span style={{ fontWeight: 800, color: "#334155" }}>LLM CodeTask 정제: </span>
        <span data-testid="llm-codetask-refinement-status">{llmRefinementStatusLabel(enableLlmCodeTaskRefinement)}</span>
      </div>
    </div>
  ) : null;

  const prototypeMvpToolbar = isPrototypeMvpUi ? (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
      <button
        type="button"
        disabled={!canEdit || busyMvpSave || busyEnvTest}
        onClick={() => void handleMvpSaveAll()}
        style={{
          padding: "12px 22px",
          borderRadius: 10,
          border: "1px solid #2563eb",
          background: "#2563eb",
          color: "#fff",
          fontWeight: 800,
          fontSize: 14,
          cursor: !canEdit || busyMvpSave || busyEnvTest ? "not-allowed" : "pointer",
        }}
      >
        {busyMvpSave ? "저장 중…" : "저장"}
      </button>
      <button
        type="button"
        disabled={!canEdit || busyEnvTest || !envTestStartOk || busyMvpSave}
        onClick={() => void handleEnvironmentTest()}
        style={{
          padding: "12px 22px",
          borderRadius: 10,
          border: "1px solid #6d28d9",
          background: envTestStartOk
            ? "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)"
            : "#e2e8f0",
          color: envTestStartOk ? "#fff" : "#64748b",
          fontWeight: 800,
          fontSize: 14,
          cursor: !canEdit || busyEnvTest || !envTestStartOk || busyMvpSave ? "not-allowed" : "pointer",
          boxShadow: envTestStartOk ? "0 4px 14px rgba(124, 58, 237, 0.35)" : "none",
        }}
        title={envTestDisabledTitle}
      >
        {busyEnvTest ? "실행 중…" : "연결 테스트"}
      </button>
      <span style={{ fontSize: 12, fontWeight: 700, color: connectionTestSatisfied ? "#15803d" : "#64748b" }}>
        {connectionTestSatisfied ? "연결 테스트 완료" : "연결 테스트 미완료"}
      </span>
    </div>
  ) : null;

  const prototypeMvpEnvTestProgress =
    isPrototypeMvpUi &&
    (busyEnvTest ||
      (stage1TimerSession?.taskId === "pending" && !stage1LastDtoShowsPipelineProgress(envTestLast, true))) ? (
      <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#334155" }}>연결 테스트를 진행하는 중입니다…</p>
    ) : null;

  const renderModalDetail = () => {
    if (!selectedModalRow) return null;
    if (selectedModalRow === "repo") return modalGithubRepoFields;
    if (selectedModalRow === "token") {
      return (
        <>
          {isGithubTokenCredentialsError(executionSetup?.githubCapabilityValidation) ? (
            <div style={{ marginBottom: 12 }}>
              <PrototypeEnvSettingsGithubTokenErrorContent executionSetup={executionSetup} />
            </div>
          ) : null}
          {mvpGithubTokenFields}
        </>
      );
    }
    if (selectedModalRow === "database") {
      return (
        <PlanningDatabaseSettingsSection
          projectId={projectId}
          canEdit={canEdit}
          gitRepoName={executionSetup?.gitRepoName ?? null}
        />
      );
    }
    if (selectedModalRow === "cursor") {
      return (
        <ExecutionSetupPanel
          ref={executionSetupPanelRef}
          projectId={projectId}
          canEdit={canEdit}
          executionSetup={executionSetup}
          setExecutionSetup={setExecutionSetup}
          setMessage={setExecutionMessage}
          formatTestedAt={formatTestedAt}
          flatLayout
          unifiedExecutionEnvironment
          executionEnvironmentFlow={false}
          prototypeStagedLayout
          prototypeMvpLayout
          connectionTestSatisfied={connectionTestSatisfied}
          peerCredentialHintsFallback={peerHintsWhenNoSetup}
          canRevealCursorApiKey={canRevealCursorApiKey}
          onSetupPersisted={notifyExecutionSetupChanged}
        />
      );
    }
    return null;
  };

  const modalFooterBtn: CSSProperties = {
    padding: "10px 18px",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  };

  if (isModalCompact && isPrototypeMvpUi) {
    return (
      <div
        data-testid="project-execution-environment-panel"
        style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
      >
        <PrototypeEnvSettingsModalLayout
          rows={modalTableRows}
          selectedRow={selectedModalRow}
          onSelectRow={setSelectedModalRow}
          belowTable={
            <AutoGenerationSplitPreflightPanel
              connectionTest={displayedConnectionTest}
              connectionTestAttempted={connectionTestAttempted}
              onFocusGithubToken={() => setSelectedModalRow("token")}
            />
          }
          detail={renderModalDetail()}
          footer={
            <>
              <button
                type="button"
                disabled={!canEdit || busyMvpSave || busyEnvTest}
                onClick={() => void handleMvpSaveAll()}
                style={{
                  ...modalFooterBtn,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: !canEdit || busyMvpSave || busyEnvTest ? "not-allowed" : "pointer",
                }}
              >
                {busyMvpSave ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                disabled={!canEdit || busyEnvTest || !envTestStartOk || busyMvpSave}
                onClick={() => void handleEnvironmentTest()}
                title={envTestDisabledTitle}
                style={{
                  ...modalFooterBtn,
                  border: "1px solid #6d28d9",
                  background: envTestStartOk ? "#6d28d9" : "#e2e8f0",
                  color: envTestStartOk ? "#fff" : "#64748b",
                  cursor: !canEdit || busyEnvTest || !envTestStartOk || busyMvpSave ? "not-allowed" : "pointer",
                }}
              >
                {busyEnvTest ? "실행 중…" : "연결 테스트"}
              </button>
            </>
          }
        />
        {executionMessage ? (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: "#334155" }} role="status">
            {executionMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="project-execution-environment-panel"
      data-ui-label="[P-6-4] 실행 환경 — 연결·정책·검증"
      style={{ marginBottom: 8 }}
    >
      {isAdminSettings && effectivePurpose === "prototype" ? null : (
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a" }}>
            {isAdminSettings ? "환경 검증/설정" : "실행 환경"}
          </h1>
          {!isAdminSettings ? (
            <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
              외부 시스템을 연결한 뒤, 연결 테스트로 Cursor의 Hello World 수준 커밋·푸시와 플랫폼의 PR·머지 경로를 함께
              확인합니다. 실행 정책은 필요할 때만 고급 설정에서 조정합니다.
            </p>
          ) : null}
          {isAdminSettings ? null : (
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
              1. 외부 시스템 연결 → 2. 환경 검증(기본 검증·연결 테스트) → 3. (선택) 실행 정책 설정
            </div>
          )}
        </header>
      )}

      {isAdminSettings && effectivePurpose === "prototype" ? (
        <>
          {mvpGithubRepoFields ? (
            <PrototypeEnvSettingsStepCard step={1} title="GitHub 저장소 연결">
              {mvpGithubRepoFields}
            </PrototypeEnvSettingsStepCard>
          ) : null}
          {mvpGithubTokenFields ? (
            <PrototypeEnvSettingsStepCard step={2} title="GitHub Token 설정">
              {mvpGithubTokenFields}
            </PrototypeEnvSettingsStepCard>
          ) : null}
          <PrototypeEnvSettingsStepCard step={3}>
            <ExecutionSetupPanel
              ref={executionSetupPanelRef}
              projectId={projectId}
              canEdit={canEdit}
              executionSetup={executionSetup}
              setExecutionSetup={setExecutionSetup}
              setMessage={setExecutionMessage}
              formatTestedAt={formatTestedAt}
              flatLayout
              unifiedExecutionEnvironment
              executionEnvironmentFlow={false}
              prototypeStagedLayout
              prototypeMvpLayout={isPrototypeMvpUi}
              connectionTestSatisfied={connectionTestSatisfied}
              peerCredentialHintsFallback={peerHintsWhenNoSetup}
              canRevealCursorApiKey={canRevealCursorApiKey}
              onSetupPersisted={notifyExecutionSetupChanged}
            />
          </PrototypeEnvSettingsStepCard>
          {mvpAiExecutionSettingsFields ? (
            <PrototypeEnvSettingsStepCard step={4} title="AI 실행 설정">
              {mvpAiExecutionSettingsFields}
            </PrototypeEnvSettingsStepCard>
          ) : null}
          {prototypeMvpAiConnectionStatus}
          <div
            data-testid="prototype-env-save-and-test"
            style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}
          >
            {prototypeMvpToolbar}
          </div>
          {prototypeMvpEnvTestProgress}
        </>
      ) : (
        <>
          {mvpGithubRepoFields ? (
            <PrototypeEnvSettingsStepCard step={1} title="GitHub 저장소 연결">
              {mvpGithubRepoFields}
            </PrototypeEnvSettingsStepCard>
          ) : null}
          {mvpGithubTokenFields ? (
            <PrototypeEnvSettingsGithubTokenStepCard executionSetup={executionSetup}>
              {mvpGithubTokenFields}
            </PrototypeEnvSettingsGithubTokenStepCard>
          ) : null}
          {!isPrototypeMvpUi ? (
            <ProjectIntegrationOverridesPanel projectId={projectId} canEdit={canEdit} />
          ) : null}
          <ExecutionSetupPanel
            ref={executionSetupPanelRef}
            projectId={projectId}
            canEdit={canEdit}
            executionSetup={executionSetup}
            setExecutionSetup={setExecutionSetup}
            setMessage={setExecutionMessage}
            formatTestedAt={formatTestedAt}
            flatLayout
            unifiedExecutionEnvironment
            executionEnvironmentFlow={effectivePurpose !== "prototype"}
            prototypeStagedLayout={effectivePurpose === "prototype"}
            prototypeMvpLayout={isPrototypeMvpUi}
            connectionTestSatisfied={connectionTestSatisfied}
            peerCredentialHintsFallback={peerHintsWhenNoSetup}
            connectionSlotBeforeCursor={isPrototypeMvpUi ? undefined : gitRepositorySlot}
            connectionSlotGithubAuth={isPrototypeMvpUi ? undefined : githubAuthSlot}
            connectionSlotAfterCursor={isPrototypeMvpUi ? undefined : stage1ValidationSlot}
            canRevealCursorApiKey={canRevealCursorApiKey}
            onSetupPersisted={notifyExecutionSetupChanged}
          />
          {mvpAiExecutionSettingsFields ? (
            <PrototypeEnvSettingsStepCard step={4} title="AI 실행 설정">
              {mvpAiExecutionSettingsFields}
            </PrototypeEnvSettingsStepCard>
          ) : null}
          {prototypeMvpAiConnectionStatus}
        </>
      )}

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
