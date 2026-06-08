export function buildUserSafeCodeTaskFailureMessage(input: {
  readonly reason: string | null;
  readonly codeTaskTitle: string;
}): Readonly<{
  readonly title: string;
  readonly reasonLine: string;
  readonly nextActionLine: string;
  readonly message: string;
  readonly actionLabel: string;
}> {
  const title = `${input.codeTaskTitle.trim() || "CodeTask"} 작업이 완료되지 않았습니다.`;
  const reason = String(input.reason ?? "").trim();

  if (reason === "github_branch_missing") {
    return pack(
      title,
      "작업 branch를 확인하지 못했습니다.",
      "실패 작업을 다시 실행해 주세요.",
    );
  }
  if (reason === "commit_not_created" || reason === "github_no_new_commit") {
    return pack(
      title,
      "작업 결과 commit을 확인하지 못했습니다.",
      "실패 작업을 다시 실행해 주세요.",
    );
  }
  if (
    reason === "cursor_api_launch_failed" ||
    reason === "cursor_request_failed" ||
    reason === "cursor_dispatch_failed"
  ) {
    return pack(
      title,
      "Cursor 실행 요청을 시작하지 못했습니다.",
      "잠시 후 실패 작업을 다시 실행해 주세요.",
    );
  }
  if (
    reason === "github_verify_failed" ||
    reason === "github_api_error" ||
    reason === "github_verify_timeout" ||
    reason === "github_verify_state_sync_failed"
  ) {
    return pack(
      title,
      "GitHub 작업 결과 확인에 실패했습니다.",
      "다시 확인하거나 실패 작업을 재실행해 주세요.",
    );
  }
  return pack(title, "작업 완료 여부를 확인하지 못했습니다.", "실패 작업을 다시 실행해 주세요.");
}

function pack(title: string, reasonLine: string, nextActionLine: string) {
  return {
    title,
    reasonLine,
    nextActionLine,
    message: `${reasonLine}\n${nextActionLine}`,
    actionLabel: "실패 작업 다시 실행",
  };
}

export function operatorDiagnosticMessageForGithubFailureReason(reason: string | null): string {
  const r = String(reason ?? "").trim();
  if (r === "github_branch_missing") {
    return "GitHub branch lookup returned 404 after retries.";
  }
  return r || "unknown_failure";
}
