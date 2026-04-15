import type { ExecutionSetupDto } from "@/components/project-spec/api";

export type ProjectExecutionReadiness = Readonly<{
  gitOk: boolean;
  githubOk: boolean;
  cursorOk: boolean;
  policyOk: boolean;
  /** Git 연결: 완료 / 미완료 */
  gitLabel: "완료" | "미완료";
  /** GitHub 인증: 완료 / 필요 */
  githubLabel: "완료" | "필요";
  /** Cursor 연결: 완료 / 미완료 */
  cursorLabel: "완료" | "미완료";
  /** 실행 정책(검증·재검증 없음): 완료 / 미완료 */
  policyLabel: "완료" | "미완료";
  /** 모든 필수 항목 충족 */
  runnable: boolean;
  /** runnable이 false일 때 첫 번째 미충족 사유 */
  blockedReasonKr: string | null;
}>;

function gitOk(s: ExecutionSetupDto): boolean {
  return Boolean(String(s.gitRepoUrl ?? "").trim()) && s.repoConnectionOk === true;
}

function githubOk(s: ExecutionSetupDto): boolean {
  return s.hasGithubAccessToken === true && s.githubAuthConnectionOk === true;
}

function cursorOk(s: ExecutionSetupDto): boolean {
  return (
    s.hasCursorToken === true && s.cursorApiConnectionOk === true && s.executorConnectionOk === true
  );
}

function policyOk(s: ExecutionSetupDto): boolean {
  return s.status === "validated" && !(s.needsRevalidation ?? false);
}

function firstBlockedReason(
  s: ExecutionSetupDto,
  r: Pick<ProjectExecutionReadiness, "gitOk" | "githubOk" | "cursorOk" | "policyOk">
): string | null {
  if (!r.gitOk) {
    if (!String(s.gitRepoUrl ?? "").trim()) return "Git 저장소 URL이 없습니다.";
    if (s.repoConnectionOk === false) return "Git 저장소 연결 검증에 실패했습니다.";
    return "Git 저장소 연결 검증이 필요합니다.";
  }
  if (!r.githubOk) {
    if (s.hasGithubAccessToken !== true) return "GitHub 액세스 토큰이 필요합니다.";
    if (s.githubAuthConnectionOk === false) return "GitHub 인증 검증에 실패했습니다.";
    return "GitHub 인증 검증이 필요합니다.";
  }
  if (!r.cursorOk) {
    if (s.hasCursorToken !== true) return "Cursor API 키가 필요합니다.";
    if (s.cursorApiConnectionOk === false) return "Cursor API 검증에 실패했습니다.";
    if (s.executorConnectionOk === false) return "Cursor 저장소 접근 검증에 실패했습니다.";
    return "Cursor 연결 검증이 필요합니다.";
  }
  if (!r.policyOk) {
    if (s.status !== "validated") return "실행 환경을 저장하고 검증을 완료해야 합니다.";
    if (s.needsRevalidation) return "설정이 바뀌어 실행 환경 재검증이 필요합니다.";
    return "실행 정책·검증 상태를 확인하세요.";
  }
  return null;
}

/**
 * PRIMARY 실행에 필요한 Git·GitHub·Cursor·검증 상태를 한 번에 평가합니다.
 */
export function computeProjectExecutionReadiness(setup: ExecutionSetupDto | null): ProjectExecutionReadiness {
  if (!setup) {
    return {
      gitOk: false,
      githubOk: false,
      cursorOk: false,
      policyOk: false,
      gitLabel: "미완료",
      githubLabel: "필요",
      cursorLabel: "미완료",
      policyLabel: "미완료",
      runnable: false,
      blockedReasonKr: "실행 환경 설정이 없습니다.",
    };
  }
  const g = gitOk(setup);
  const gh = githubOk(setup);
  const c = cursorOk(setup);
  const p = policyOk(setup);
  const runnable = g && gh && c && p;
  const base = { gitOk: g, githubOk: gh, cursorOk: c, policyOk: p };
  return {
    ...base,
    gitLabel: g ? "완료" : "미완료",
    githubLabel: gh ? "완료" : "필요",
    cursorLabel: c ? "완료" : "미완료",
    policyLabel: p ? "완료" : "미완료",
    runnable,
    blockedReasonKr: runnable ? null : firstBlockedReason(setup, base),
  };
}

const LOOP_ENV_FAILURE_SUBSTRINGS = [
  "execution setup",
  "실행 환경",
  "git 저장소 url",
  "cursor executor is required",
  "cursor api 키",
  "저장소 연결 검증과 cursor",
  "기본 브랜치 설정이 없어",
] as const;

/** 실행 루프 API 등에서 환경·연결 문제로 보이는 메시지인지 휴리스틱으로 판별합니다. */
export function isExecutionEnvironmentFailureMessage(message: string | null | undefined): boolean {
  const m = String(message ?? "").trim().toLowerCase();
  if (!m) return false;
  return LOOP_ENV_FAILURE_SUBSTRINGS.some((s) => m.includes(s));
}
