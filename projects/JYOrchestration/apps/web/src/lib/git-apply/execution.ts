import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type ExecutionMode = "mock" | "cursor" | "git";

export type CursorExecutionPayload = {
  taskId: string;
  projectId: string;
  files: unknown;
  diffText: string | null;
  commitMessage: string | null;
  branchName: string;
};

/** Cursor 연동용 JSON 페이로드 (GitChangeRequest 기반) */
export function buildCursorPayload(ctx: CursorExecutionPayload): string {
  const body = {
    taskId: ctx.taskId,
    projectId: ctx.projectId,
    files: ctx.files,
    diffText: ctx.diffText,
    commitMessage: ctx.commitMessage,
    branchName: ctx.branchName,
  };
  return JSON.stringify(body, null, 2);
}

function buildPlannedGitFlow(branchName: string, commitMessage: string): string {
  return [
    "[PLANNED GIT FLOW]",
    `git checkout -b ${branchName}`,
    "apply diff...",
    "git add -A",
    `git commit -m '${commitMessage}'`,
    "git push origin <branch>  (push: options.push + GIT_APPLY_PUSH_ENABLED=true 일 때만)",
  ].join("\n");
}

function buildCursorStubSection(payloadJson: string): string {
  const max = 4000;
  const shown =
    payloadJson.length > max ? `${payloadJson.slice(0, max)}\n... [truncated]` : payloadJson;
  return [
    "[CURSOR][STUB]",
    "실제 Cursor CLI/API는 환경변수로만 자격 증명 주입 (하드코딩 금지).",
    "[PAYLOAD]",
    shown,
    "[END CURSOR STUB]",
  ].join("\n");
}

async function runGitInWorkdir(
  workdir: string,
  branchName: string,
  commitMessage: string,
  requestedPush: boolean
): Promise<string[]> {
  const lines: string[] = [];
  const git = async (args: string[]) => {
    const r = await execFileAsync("git", args, {
      cwd: workdir,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      out: (r.stdout ?? "").toString().trim(),
      err: (r.stderr ?? "").toString().trim(),
    };
  };
  try {
    await git(["rev-parse", "--is-inside-work-tree"]);
    lines.push("[GIT] rev-parse OK");
    await git(["checkout", "-B", branchName]);
    lines.push(`[GIT] checkout -B ${branchName} OK`);
    const st = await git(["status", "--short"]);
    lines.push("[GIT] git status --short:");
    lines.push(st.out || "(clean)");
    if (st.out) {
      await git(["add", "-A"]);
      try {
        await git(["commit", "-m", commitMessage]);
        lines.push("[GIT] commit OK");
      } catch (e) {
        lines.push(
          `[GIT] commit skipped or failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    } else {
      lines.push("[GIT] skip commit (no local changes)");
    }
    const pushAllowed =
      process.env.GIT_APPLY_PUSH_ENABLED === "true" && requestedPush;
    if (pushAllowed) {
      try {
        await git(["push", "-u", "origin", branchName]);
        lines.push("[GIT] push OK");
      } catch (e) {
        lines.push(`[GIT] push failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      lines.push(
        "[GIT] push skipped (GIT_APPLY_PUSH_ENABLED!==true 또는 options.push=false)"
      );
    }
  } catch (e) {
    lines.push(`[GIT][ERROR] ${e instanceof Error ? e.message : String(e)}`);
  }
  return lines;
}

function simulatedGitSection(
  branchName: string,
  commitMessage: string,
  requestedPush: boolean
): string[] {
  return [
    "[GIT][SIMULATED]",
    "GIT_APPLY_WORKDIR 가 비어 있어 실제 git 명령은 실행하지 않았습니다.",
    `브랜치(예정): ${branchName}`,
    `커밋 메시지: ${commitMessage}`,
    requestedPush
      ? "push 요청: 예 (실행하려면 GIT_APPLY_WORKDIR 설정 + GIT_APPLY_PUSH_ENABLED=true)"
      : "push 요청: 아니오",
  ];
}

export type ApplyLogContext = {
  mode: ExecutionMode;
  branchName: string;
  commitMessage: string;
  taskId: string;
  projectId: string;
  files: unknown;
  diffText: string | null;
  /** Git 모드에서만 의미; env 와 함께 사용 */
  requestedPush: boolean;
};

export async function buildApplyLogForMode(ctx: ApplyLogContext): Promise<string> {
  const planned = buildPlannedGitFlow(ctx.branchName, ctx.commitMessage);
  const header = `[mode: ${ctx.mode}]`;

  if (ctx.mode === "mock") {
    return [header, planned, "[RESULT] mock — 실제 git/cursor 명령 미실행", "[END]"].join("\n");
  }

  if (ctx.mode === "cursor") {
    const payloadJson = buildCursorPayload({
      taskId: ctx.taskId,
      projectId: ctx.projectId,
      files: ctx.files,
      diffText: ctx.diffText,
      commitMessage: ctx.commitMessage,
      branchName: ctx.branchName,
    });
    return [
      header,
      planned,
      buildCursorStubSection(payloadJson),
      "[RESULT] cursor 스텁 완료",
      "[END]",
    ].join("\n\n");
  }

  const workdir = process.env.GIT_APPLY_WORKDIR?.trim();
  const parts = [header, planned, "---"];
  if (workdir) {
    parts.push(
      ...(await runGitInWorkdir(
        workdir,
        ctx.branchName,
        ctx.commitMessage,
        ctx.requestedPush
      ))
    );
  } else {
    parts.push(...simulatedGitSection(ctx.branchName, ctx.commitMessage, ctx.requestedPush));
  }
  parts.push("[END]");
  return parts.join("\n");
}

export function parseExecutionMode(raw: unknown): ExecutionMode | null {
  if (raw === undefined || raw === null) return "mock";
  const s = String(raw).toLowerCase().trim();
  if (s === "" || s === "mock") return "mock";
  if (s === "cursor" || s === "git") return s;
  return null;
}
