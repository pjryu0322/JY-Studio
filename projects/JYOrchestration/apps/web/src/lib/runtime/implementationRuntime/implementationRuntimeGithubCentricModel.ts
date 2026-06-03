import type { RuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { RuntimeGithubState } from "@/lib/prototype/implementationRuntimeState";

/** GitHub-centric user-facing phase (DB enum migration 전 논리 모델). */
export type ImplementationRuntimeUserPhase =
  | "idle"
  | "queued"
  | "requested"
  | "waiting_github"
  | "completed"
  | "failed"
  | "stale";

export type ImplementationRuntimeUserPhaseDetail = Readonly<{
  readonly commitSha?: string | null;
  readonly pullRequestUrl?: string | null;
  readonly githubState?: RuntimeGithubState | null;
}>;

export function mapRuntimeStateToUserPhase(state: RuntimeState): ImplementationRuntimeUserPhase {
  switch (state) {
    case "idle":
      return "idle";
    case "queued":
      return "queued";
    case "dispatching":
    case "cursor_running":
      return "requested";
    case "github_verifying":
      return "waiting_github";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "stale":
      return "stale";
    default:
      return "requested";
  }
}

export function formatImplementationRuntimeUserPhaseKo(
  phase: ImplementationRuntimeUserPhase,
  detail?: ImplementationRuntimeUserPhaseDetail,
): string {
  switch (phase) {
    case "idle":
      return "대기";
    case "queued":
      return "다음 CodeTask 대기";
    case "requested":
      return "CodeTask 실행 중";
    case "waiting_github": {
      if (detail?.pullRequestUrl) return "PR 생성 확인 중";
      if (detail?.commitSha) return "GitHub 커밋 확인 중";
      if (detail?.githubState === "pending") return "GitHub 결과 확인 중";
      return "GitHub 결과 확인 중";
    }
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "stale":
      return "중단(재시도 가능)";
    default:
      return phase;
  }
}

/** DB/legacy `runtimeState` → 사용자 라벨 (Cursor 내부명 미노출). */
export function formatRuntimeStateKoForUser(
  state: RuntimeState,
  detail?: ImplementationRuntimeUserPhaseDetail,
): string {
  return formatImplementationRuntimeUserPhaseKo(mapRuntimeStateToUserPhase(state), detail);
}
