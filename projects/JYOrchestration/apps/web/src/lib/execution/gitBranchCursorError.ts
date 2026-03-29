import { parseGitHubRepoFullName } from "@/lib/executionSetup/hardening";

/** UI·API에서 Git 브랜치 설정 오류를 구분할 때 사용 */
export const GIT_BRANCH_CONFIG_MARKER = "[GIT_BRANCH_CONFIG]";

/**
 * Cursor Cloud Agent가 base ref 검증에 실패할 때 흔히 포함하는 문구.
 * @see Cursor API source.ref / branch existence checks
 */
export function isCursorBaseBranchVerifyFailureError(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").toLowerCase();
  return s.includes("failed to verify existence of branch") || s.includes("verify existence of branch");
}

/**
 * 생성 요청 자체가 거절될 때 Cursor가 반환하는 문구(브랜치 미존재와 무관할 수 있음).
 * 복합 메시지에 branch 검증 문구가 섞여 있어도 Git 오류로 단정하지 않기 위해 우선 판별합니다.
 */
export function isCursorInvalidCreationRequestError(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").toLowerCase();
  return s.includes("invalid creation request");
}

export function formatCursorCloudAgentCreationFailureMessage(raw?: string | null): string {
  const lines = [
    "Cursor 실행 요청 실패 (Cloud Agent 생성 오류)",
    "",
    "가능한 원인:",
    "- 필수 파라미터 누락 또는 형식 오류",
    "- Cursor API 요청 본문 형식이 스펙과 맞지 않음",
    "- 권한·플랜·연동 설정 불일치",
  ];
  const r = String(raw ?? "").trim();
  if (r) {
    lines.push("");
    lines.push("Cursor 응답 요약:");
    lines.push(r.length > 600 ? `${r.slice(0, 600)}…` : r);
  }
  return lines.join("\n");
}

export function formatGitBaseBranchConfigError(args: { repoDisplay: string; baseBranch: string }): string {
  return [
    GIT_BRANCH_CONFIG_MARKER,
    "Git 설정 오류",
    `저장소: ${args.repoDisplay}`,
    `브랜치: ${args.baseBranch}`,
    "",
    "해당 브랜치가 존재하지 않습니다.",
    "GitHub에서 실제 브랜치를 확인 후 Execution setup의 base branch를 수정하세요.",
  ].join("\n");
}

export function repoDisplayForGitError(gitRepoUrl: string): string {
  const full = parseGitHubRepoFullName(gitRepoUrl);
  if (full) return full;
  return String(gitRepoUrl ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

/**
 * Cursor API 오류를 사용자 메시지로 정리합니다.
 * - 생성 요청 거절 → Cloud Agent 생성 오류(브랜치 미존재로 단정하지 않음)
 * - 순수 base ref 검증 실패 → Git 브랜치 설정 안내
 */
export function enhanceCursorErrorIfBaseBranchRelated(
  raw: string | null | undefined,
  ctx: { gitRepoUrl: string; baseBranch: string }
): string {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  if (isCursorInvalidCreationRequestError(t)) {
    return formatCursorCloudAgentCreationFailureMessage(t);
  }
  if (!isCursorBaseBranchVerifyFailureError(t)) return t;
  return formatGitBaseBranchConfigError({
    repoDisplay: repoDisplayForGitError(ctx.gitRepoUrl),
    baseBranch: String(ctx.baseBranch ?? "").trim() || "(미지정)",
  });
}

export function isGitBranchConfigErrorMessage(msg: string | null | undefined): boolean {
  const s = String(msg ?? "");
  return s.includes(GIT_BRANCH_CONFIG_MARKER) || s.includes("Git 설정 오류");
}

/** 마커 제거 후 사용자에게 보여줄 본문 */
export function stripGitBranchConfigMarkerForDisplay(msg: string): string {
  return msg.replace(/^\[GIT_BRANCH_CONFIG\]\r?\n?/, "").trim();
}
