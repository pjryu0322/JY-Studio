import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { extractCursorExternalScmReference } from "@/lib/prototype/platformScmExecution";

export type CursorApiDirectExecuteRequest = Readonly<{
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly selectedWorkItemIds: readonly string[];
  readonly workItems: readonly CursorWorkItem[];
  readonly cursorApiUrl: string;
  readonly cursorApiToken: string;
  readonly targetRepository: ProjectTargetRepository;
  readonly workspacePath: string;
  readonly baseBranch: string;
  readonly branchName: string;
  readonly commitMessage: string;
  readonly prompt: string;
  readonly autoCommit: boolean;
  readonly autoPush: boolean;
  readonly autoPr: boolean;
  readonly allowedPathGlobs: readonly string[];
}>;

export type CursorApiDirectExecuteResultStatus = "completed" | "failed" | "unsupported" | "blocked";

export type CursorApiDirectExecuteResult = Readonly<{
  readonly ok: boolean;
  readonly status: CursorApiDirectExecuteResultStatus;
  readonly provider: "cursor_api";
  readonly selectedTaskId: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly changedFiles?: readonly string[];
  readonly diffSummary?: readonly string[];
  readonly testResults?: readonly string[];
  readonly pushed?: boolean;
  readonly prNumber?: number;
  readonly errorMessage?: string;
  readonly rawLog?: string;
  readonly workspacePath?: string;
  readonly targetRepository?: string;
  readonly cursorExternalPushStatus?: string;
  readonly cursorExternalPrNumber?: number;
  readonly cursorExternalPrStatus?: string;
}>;

const FETCH_TIMEOUT_MS = 600_000;

function isStubSha(sha: string | undefined): boolean {
  const v = String(sha ?? "").trim();
  return !v || v.startsWith("wip-stub");
}

function normalizeDirectApiUrl(cursorApiUrl: string): string {
  return cursorApiUrl.trim().replace(/\/+$/, "");
}

function parseDirectApiResponseBody(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapParsedToDirectResult(
  request: CursorApiDirectExecuteRequest,
  parsed: Record<string, unknown>,
): CursorApiDirectExecuteResult {
  const statusRaw = String(parsed.status ?? (parsed.ok === true ? "completed" : "failed")).trim();
  const commitSha = String(parsed.commitSha ?? parsed.sha ?? "").trim() || undefined;
  const changedFiles = Array.isArray(parsed.changedFiles)
    ? parsed.changedFiles.map((f) => String(f)).filter(Boolean)
    : [];
  const branchName = String(parsed.branchName ?? request.branchName).trim() || request.branchName;
  const targetRepository =
    String(parsed.targetRepository ?? request.targetRepository.repoFullName).trim() ||
    request.targetRepository.repoFullName;

  if (statusRaw === "unsupported") {
    return {
      ok: false,
      status: "unsupported",
      provider: "cursor_api",
      selectedTaskId: request.selectedTaskId,
      errorMessage: CURSOR_API_UNSUPPORTED_MESSAGE,
      rawLog: JSON.stringify(parsed).slice(0, 2000),
    };
  }

  if (statusRaw !== "completed" && parsed.ok !== true) {
    return {
      ok: false,
      status: statusRaw === "blocked" ? "blocked" : "failed",
      provider: "cursor_api",
      selectedTaskId: request.selectedTaskId,
      errorMessage: String(parsed.errorMessage ?? parsed.message ?? "Cursor API 호출에 실패했습니다."),
      rawLog: JSON.stringify(parsed).slice(0, 2000),
      branchName,
      ...(changedFiles.length ? { changedFiles } : {}),
      ...(commitSha ? { commitSha } : {}),
    };
  }

  if (isStubSha(commitSha) || !changedFiles.length) {
    return {
      ok: false,
      status: "failed",
      provider: "cursor_api",
      selectedTaskId: request.selectedTaskId,
      errorMessage: [
        "Cursor API 응답을 실제 소스 생성으로 인정하지 않았습니다.",
        "사유:",
        ...(isStubSha(commitSha) ? ["- commitSha 없음 또는 wip-stub"] : []),
        ...(!changedFiles.length ? ["- changedFiles 없음"] : []),
      ].join("\n"),
      rawLog: JSON.stringify(parsed).slice(0, 2000),
      branchName,
      ...(commitSha ? { commitSha } : {}),
    };
  }

  return {
    ok: true,
    status: "completed",
    provider: "cursor_api",
    selectedTaskId: request.selectedTaskId,
    branchName,
    commitSha,
    changedFiles,
    targetRepository,
    workspacePath: String(parsed.workspacePath ?? request.workspacePath).trim() || request.workspacePath,
    diffSummary: Array.isArray(parsed.diffSummary)
      ? parsed.diffSummary.map((d) => String(d))
      : [`changed ${changedFiles.length} file(s)`],
    testResults: Array.isArray(parsed.testResults)
      ? parsed.testResults.map((t) => String(t))
      : ["실제 pnpm test/build: Cursor API 후 대상 저장소에서 실행 필요"],
    rawLog: JSON.stringify(parsed).slice(0, 2000),
    ...extractCursorExternalScmReference({
      pushed: parsed.pushed === true,
      pushStatus: parsed.pushStatus ? String(parsed.pushStatus) : undefined,
      pushErrorMessage: parsed.pushErrorMessage ? String(parsed.pushErrorMessage) : undefined,
      prNumber: parsed.prNumber !== undefined ? Number(parsed.prNumber) : undefined,
      prStatus: parsed.prStatus ? String(parsed.prStatus) : undefined,
    }),
  };
}

export const CURSOR_API_UNSUPPORTED_MESSAGE =
  "Cursor API 직접 실행 endpoint가 지원되지 않습니다.\n현재 Cursor API가 외부 소스 생성 요청을 받을 수 있는지 확인이 필요합니다." as const;

export async function executeCursorApiDirect(
  request: CursorApiDirectExecuteRequest,
): Promise<CursorApiDirectExecuteResult> {
  const url = `${normalizeDirectApiUrl(request.cursorApiUrl)}/execute`;
  const body = {
    projectId: request.projectId,
    selectedTaskId: request.selectedTaskId,
    selectedWorkItemIds: request.selectedWorkItemIds,
    targetRepository: {
      owner: request.targetRepository.owner,
      repo: request.targetRepository.repo,
      repoFullName: request.targetRepository.repoFullName,
      gitRepoUrl: request.targetRepository.gitRepoUrl,
      defaultBranch: request.targetRepository.defaultBranch,
    },
    workspacePath: request.workspacePath,
    baseBranch: request.baseBranch,
    branchName: request.branchName,
    prompt: request.prompt,
    workItems: request.workItems,
    commitMessage: request.commitMessage,
    autoCommit: request.autoCommit !== false,
    autoPush: false,
    autoPr: false,
    allowedPathGlobs: request.allowedPathGlobs,
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${request.cursorApiToken.trim()}`,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text();
    if (res.status === 404 || res.status === 501 || res.status === 405) {
      return {
        ok: false,
        status: "unsupported",
        provider: "cursor_api",
        selectedTaskId: request.selectedTaskId,
        errorMessage: CURSOR_API_UNSUPPORTED_MESSAGE,
        rawLog: text.slice(0, 2000),
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "cursor_api",
        selectedTaskId: request.selectedTaskId,
        errorMessage: `Cursor API 호출에 실패했습니다.\n사유: HTTP ${res.status}`,
        rawLog: text.slice(0, 2000),
      };
    }
    const parsed = parseDirectApiResponseBody(text);
    if (!parsed) {
      return {
        ok: false,
        status: "failed",
        provider: "cursor_api",
        selectedTaskId: request.selectedTaskId,
        errorMessage: "Cursor API 응답 JSON 파싱에 실패했습니다.",
        rawLog: text.slice(0, 2000),
      };
    }
    return mapParsedToDirectResult(request, parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: "failed",
      provider: "cursor_api",
      selectedTaskId: request.selectedTaskId,
      errorMessage: `Cursor API 호출에 실패했습니다.\n사유: ${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
