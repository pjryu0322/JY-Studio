/**
 * GitHub Pull Request 생성·동기화.
 * 토큰: Execution setup(DB)에 저장된 프로젝트별 값만 사용. 저장소: 프로젝트 repoUrl(github.com)만 사용.
 */

import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import {
  GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS,
  resolveProjectGithubToken,
} from "@/lib/integration/githubProjectDbToken";
import { isAutoGitPushMode } from "@/lib/git-apply/retry";
import { prisma } from "@/lib/prisma";
import { isExecutionSafeMode } from "@/lib/production/safeMode";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

export const PR_STATE_OPEN = "OPEN";
export const PR_STATE_CLOSED = "CLOSED";
export const PR_STATE_MERGED = "MERGED";

export const REVIEW_PENDING = "PENDING";
export const REVIEW_APPROVED = "APPROVED";
export const REVIEW_CHANGES_REQUESTED = "CHANGES_REQUESTED";

export const GITHUB_PR_ERROR_CODES = {
  SAFE_MODE: "GITHUB_PR_SAFE_MODE",
  NOT_FOUND: "GITHUB_PR_GCR_NOT_FOUND",
  ALREADY_EXISTS: "GITHUB_PR_ALREADY_EXISTS",
  NO_PUSH: "GITHUB_PR_PUSH_NOT_CONFIRMED",
  NO_AUTO_PUSH_POLICY: "GITHUB_PR_NOT_AUTO_PUSH_PROJECT",
  NO_CONFIG: "GITHUB_PR_MISSING_GITHUB_CONFIG",
  /** Execution setup(DB)에 GitHub PAT 없음 — ENV PAT 미사용 */
  MISSING_PROJECT_GITHUB_TOKEN: GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS,
  API_ERROR: "GITHUB_PR_GITHUB_API_ERROR",
  NO_PR_NUMBER: "GITHUB_PR_NUMBER_MISSING",
} as const;

async function appendGithubPrFailureToApplyLog(
  gitChangeRequestId: string,
  code: string,
  message: string
): Promise<void> {
  try {
    const row = await prisma.gitChangeRequest.findUnique({
      where: { id: gitChangeRequestId },
      select: { applyLog: true },
    });
    if (!row) {
      return;
    }
    const line = `\n[GIT] PR create failed (${code}): ${message}`;
    await prisma.gitChangeRequest.update({
      where: { id: gitChangeRequestId },
      data: { applyLog: `${row.applyLog ?? ""}${line}` },
    });
  } catch (e) {
    console.error("[github-pr] appendGithubPrFailureToApplyLog:", e);
  }
}

async function appendGitPrCreatedHistory(input: {
  projectId: string;
  taskId: string;
  gitChangeRequestId: string;
  actorUserId?: string | null;
  pullRequestUrl: string;
  pullRequestNumber: number;
  pullRequestState: string;
  reviewStatus: string;
}): Promise<void> {
  try {
    await appendTaskHistory({
      projectId: input.projectId,
      taskId: input.taskId,
      actorType: input.actorUserId
        ? TaskHistoryActorType.USER
        : TaskHistoryActorType.SYSTEM,
      actorId: input.actorUserId ?? null,
      eventType: TaskHistoryEventType.GIT_PR_CREATED,
      summary: "GitHub Pull Request 생성",
      detailJson: {
        gitChangeRequestId: input.gitChangeRequestId,
        pullRequestNumber: input.pullRequestNumber,
        pullRequestUrl: input.pullRequestUrl,
        pullRequestState: input.pullRequestState,
        reviewStatus: input.reviewStatus,
      },
    });
  } catch (e) {
    console.error("[github-pr] appendGitPrCreatedHistory:", e);
  }
}

async function appendGitPrSyncHistory(input: {
  projectId: string;
  taskId: string;
  gitChangeRequestId: string;
  pullRequestNumber: number;
  actorUserId?: string | null;
  prev: {
    pullRequestState: string | null;
    reviewStatus: string | null;
    mergedAt: Date | null;
  };
  next: {
    pullRequestUrl: string | null;
    pullRequestState: string;
    reviewStatus: string;
    mergedAt: Date | null;
  };
}): Promise<void> {
  const actorType = input.actorUserId
    ? TaskHistoryActorType.USER
    : TaskHistoryActorType.SYSTEM;
  const actorId = input.actorUserId ?? null;
  const detailJson = {
    gitChangeRequestId: input.gitChangeRequestId,
    pullRequestNumber: input.pullRequestNumber,
    pullRequestUrl: input.next.pullRequestUrl,
    pullRequestState: input.next.pullRequestState,
    reviewStatus: input.next.reviewStatus,
  };
  try {
    await appendTaskHistory({
      projectId: input.projectId,
      taskId: input.taskId,
      actorType,
      actorId,
      eventType: TaskHistoryEventType.GIT_PR_SYNCED,
      summary: "GitHub PR 상태 동기화",
      detailJson,
    });

    const wasMerged =
      input.prev.pullRequestState === PR_STATE_MERGED || input.prev.mergedAt != null;
    if (!wasMerged && input.next.pullRequestState === PR_STATE_MERGED) {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType,
        actorId,
        eventType: TaskHistoryEventType.GIT_PR_MERGED,
        summary: "GitHub PR 병합 반영",
        detailJson,
      });
      return;
    }

    if (
      input.prev.reviewStatus !== REVIEW_APPROVED &&
      input.next.reviewStatus === REVIEW_APPROVED &&
      input.next.pullRequestState !== PR_STATE_MERGED
    ) {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType,
        actorId,
        eventType: TaskHistoryEventType.GIT_PR_APPROVED,
        summary: "GitHub PR 승인(리뷰)",
        detailJson,
      });
    }

    if (
      input.prev.reviewStatus !== REVIEW_CHANGES_REQUESTED &&
      input.next.reviewStatus === REVIEW_CHANGES_REQUESTED
    ) {
      await appendTaskHistory({
        projectId: input.projectId,
        taskId: input.taskId,
        actorType,
        actorId,
        eventType: TaskHistoryEventType.GIT_PR_CHANGES_REQUESTED,
        summary: "GitHub PR 변경 요청",
        detailJson,
      });
    }
  } catch (e) {
    console.error("[github-pr] appendGitPrSyncHistory:", e);
  }
}

function githubApiBase(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  if (b) {
    return b.replace(/\/$/, "");
  }
  return "https://api.github.com";
}

/** 프로젝트 repoUrl(github.com)에서 owner/repo만 파싱 */
export function resolveGithubRepoForPr(input: {
  projectRepoUrl?: string | null;
}): { owner: string; repo: string } | null {
  const url = String(input.projectRepoUrl ?? "").trim();
  if (!url) {
    return null;
  }
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") {
      return null;
    }
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (seg.length < 2) {
      return null;
    }
    const owner = seg[0];
    let repo = seg[1];
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

export function buildPullRequestTitle(taskId: string): string {
  return `feat: apply task ${taskId}`;
}

export function buildPullRequestBody(input: {
  taskId: string;
  gitChangeRequestId: string;
  branchName: string;
  commitMessage: string | null;
}): string {
  const lines = [
    `GitChangeRequest: \`${input.gitChangeRequestId}\``,
    `브랜치: \`${input.branchName}\``,
  ];
  if (input.commitMessage?.trim()) {
    lines.push(`커밋: ${input.commitMessage.trim()}`);
  }
  lines.push("", "_JYOrchestration에서 생성된 PR입니다._");
  return lines.join("\n");
}

export function applyLogIndicatesPushSuccess(applyLog: string | null | undefined): boolean {
  return Boolean(applyLog && applyLog.includes("[GIT] push OK"));
}

type GhPullJson = {
  html_url?: string;
  number?: number;
  state?: string;
  merged?: boolean;
  merged_at?: string | null;
};

type GhReviewJson = { state?: string };

function mapGithubPrState(pr: GhPullJson): string {
  if (pr.merged) {
    return PR_STATE_MERGED;
  }
  const s = String(pr.state ?? "").toLowerCase();
  if (s === "open") {
    return PR_STATE_OPEN;
  }
  return PR_STATE_CLOSED;
}

function deriveReviewStatusFromReviews(reviews: GhReviewJson[]): string {
  if (!reviews.length) {
    return REVIEW_PENDING;
  }
  for (let i = reviews.length - 1; i >= 0; i--) {
    const st = String(reviews[i]?.state ?? "").toUpperCase();
    if (st === "CHANGES_REQUESTED") {
      return REVIEW_CHANGES_REQUESTED;
    }
    if (st === "APPROVED") {
      return REVIEW_APPROVED;
    }
  }
  return REVIEW_PENDING;
}

async function githubFetchJson<T>(
  token: string,
  path: string,
  init: RequestInit & { method?: string }
): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  if (!String(token ?? "").trim()) {
    return { ok: false, status: 0, json: null, text: "no token" };
  }
  const base = githubApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration-github-pr/1",
      ...(init.headers as Record<string, string>),
    },
  });
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export type CreatePullRequestForGcrOk = {
  ok: true;
  data: {
    pullRequestUrl: string;
    pullRequestNumber: number;
    pullRequestState: string;
    reviewStatus: string;
  };
};

export type CreatePullRequestForGcrErr = {
  ok: false;
  code: string;
  message: string;
  httpStatus?: number;
};

export type CreatePullRequestForGcrResult = CreatePullRequestForGcrOk | CreatePullRequestForGcrErr;

/**
 * GitHub에 PR 생성 후 GitChangeRequest에 반영.
 * (push 성공 로그·토큰·저장소·브랜치 필요)
 */
export async function createPullRequestForGitChangeRequest(input: {
  gitChangeRequestId: string;
  /** true면 gitPushMode가 MANUAL_PUSH여도 PR 생성 허용 (수동 API·운영자) */
  relaxAutoPushPolicy?: boolean;
  /** 있으면 GIT_PR_CREATED를 USER로 기록 */
  actorUserId?: string | null;
}): Promise<CreatePullRequestForGcrResult> {
  if (isExecutionSafeMode()) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.SAFE_MODE,
      message: "안전 모드에서는 GitHub PR API를 호출할 수 없습니다.",
      httpStatus: 403,
    };
  }

  const id = String(input.gitChangeRequestId ?? "").trim();
  if (!id) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NOT_FOUND,
      message: "gitChangeRequestId가 필요합니다.",
      httpStatus: 400,
    };
  }

  const row = await prisma.gitChangeRequest.findUnique({
    where: { id },
    select: {
      id: true,
      taskId: true,
      projectId: true,
      commitMessage: true,
      applyLog: true,
      applyStatus: true,
      branchName: true,
      pullRequestNumber: true,
      project: {
        select: {
          gitPushMode: true,
          repoUrl: true,
          defaultBranch: true,
        },
      },
    },
  });

  if (!row) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NOT_FOUND,
      message: "GitChangeRequest를 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  if (row.pullRequestNumber != null) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.ALREADY_EXISTS,
      message: "이미 PR이 연결되어 있습니다.",
      httpStatus: 409,
    };
  }

  if (row.applyStatus !== "DONE") {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_PUSH,
      message: "반영이 완료된(DONE) 요청만 PR을 만들 수 있습니다.",
      httpStatus: 400,
    };
  }

  if (!applyLogIndicatesPushSuccess(row.applyLog)) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_PUSH,
      message: "applyLog에 push 성공([GIT] push OK)이 없습니다. 먼저 원격 push에 성공해야 합니다.",
      httpStatus: 400,
    };
  }

  if (!input.relaxAutoPushPolicy && !isAutoGitPushMode(row.project.gitPushMode)) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_AUTO_PUSH_POLICY,
      message:
        "프로젝트 gitPushMode가 AUTO_PUSH일 때만 자동 PR 생성이 됩니다. MANUAL_PUSH 프로젝트는 API에서 relaxAutoPushPolicy를 사용하세요.",
      httpStatus: 400,
    };
  }

  const branch = String(row.branchName ?? "").trim();
  if (!branch) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_PUSH,
      message: "branchName이 없어 PR을 만들 수 없습니다.",
      httpStatus: 400,
    };
  }

  const repo = resolveGithubRepoForPr({ projectRepoUrl: row.project.repoUrl });
  const auth = await resolveProjectGithubToken(row.projectId);
  const token = auth.token;
  if (!repo) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_CONFIG,
      message: "프로젝트 저장소 URL(repoUrl)이 github.com 형식이 아니거나 비어 있어 PR을 만들 수 없습니다.",
      httpStatus: 400,
    };
  }
  if (!token) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.MISSING_PROJECT_GITHUB_TOKEN,
      message: "프로젝트 설정에 GitHub 토큰이 저장되어 있지 않습니다. Execution setup에서 토큰을 저장·검증하세요.",
      httpStatus: 400,
    };
  }

  const base = String(row.project.defaultBranch ?? "main").trim() || "main";
  const title = buildPullRequestTitle(row.taskId);
  const body = buildPullRequestBody({
    taskId: row.taskId,
    gitChangeRequestId: row.id,
    branchName: branch,
    commitMessage: row.commitMessage,
  });

  const path = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls`;
  const r = await githubFetchJson<GhPullJson>(token, path, {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      head: branch,
      base,
    }),
  });

  if (!r.ok || !r.json?.html_url || r.json.number == null) {
    const hint = r.text?.slice(0, 400) ?? r.status.toString();
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.API_ERROR,
      message: `GitHub PR 생성 실패 (HTTP ${r.status}): ${hint}`,
      httpStatus: 502,
    };
  }

  const pr = r.json;
  const prUrl = String(pr.html_url);
  const prNum = Number(pr.number);

  await prisma.gitChangeRequest.update({
    where: { id: row.id },
    data: {
      pullRequestUrl: prUrl,
      pullRequestNumber: prNum,
      pullRequestState: mapGithubPrState(pr),
      reviewStatus: REVIEW_PENDING,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
    },
  });

  const prStateNorm = mapGithubPrState(pr);
  void appendGitPrCreatedHistory({
    projectId: row.projectId,
    taskId: row.taskId,
    gitChangeRequestId: row.id,
    actorUserId: input.actorUserId,
    pullRequestUrl: prUrl,
    pullRequestNumber: prNum,
    pullRequestState: prStateNorm,
    reviewStatus: REVIEW_PENDING,
  });

  return {
    ok: true,
    data: {
      pullRequestUrl: prUrl,
      pullRequestNumber: prNum,
      pullRequestState: prStateNorm,
      reviewStatus: REVIEW_PENDING,
    },
  };
}

export type SyncPrResult =
  | {
      ok: true;
      data: {
        pullRequestState: string | null;
        reviewStatus: string | null;
        mergedAt: Date | null;
        pullRequestUrl: string | null;
      };
    }
  | { ok: false; code: string; message: string; httpStatus?: number };

/** GitHub에서 PR·리뷰 상태를 읽어 DB 반영 (TaskHistory: GIT_PR_SYNCED 및 전이 이벤트) */
export async function syncPullRequestStatus(input: {
  gitChangeRequestId: string;
  actorUserId?: string | null;
}): Promise<SyncPrResult> {
  if (isExecutionSafeMode()) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.SAFE_MODE,
      message: "안전 모드에서는 GitHub PR API를 호출할 수 없습니다.",
      httpStatus: 403,
    };
  }

  const id = String(input.gitChangeRequestId ?? "").trim();
  const row = await prisma.gitChangeRequest.findUnique({
    where: { id },
    select: {
      id: true,
      taskId: true,
      projectId: true,
      pullRequestNumber: true,
      pullRequestState: true,
      reviewStatus: true,
      mergedAt: true,
      project: { select: { repoUrl: true } },
    },
  });

  if (!row) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NOT_FOUND,
      message: "GitChangeRequest를 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  if (row.pullRequestNumber == null) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_PR_NUMBER,
      message: "연결된 pullRequestNumber가 없습니다. 먼저 PR을 생성하세요.",
      httpStatus: 400,
    };
  }

  const repo = resolveGithubRepoForPr({ projectRepoUrl: row.project.repoUrl });
  const auth = await resolveProjectGithubToken(row.projectId);
  const token = auth.token;
  if (!repo) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.NO_CONFIG,
      message: "프로젝트 저장소 URL(repoUrl)이 github.com 형식이 아니거나 비어 있습니다.",
      httpStatus: 400,
    };
  }
  if (!token) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.MISSING_PROJECT_GITHUB_TOKEN,
      message: "프로젝트 설정에 GitHub 토큰이 저장되어 있지 않아 PR 상태를 동기화할 수 없습니다. Execution setup에서 토큰을 저장·검증하세요.",
      httpStatus: 400,
    };
  }

  const prev = {
    pullRequestState: row.pullRequestState ?? null,
    reviewStatus: row.reviewStatus ?? null,
    mergedAt: row.mergedAt,
  };

  const n = row.pullRequestNumber;
  const prPath = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/pulls/${n}`;
  const prRes = await githubFetchJson<GhPullJson>(token, prPath, { method: "GET" });
  if (!prRes.ok || !prRes.json) {
    return {
      ok: false,
      code: GITHUB_PR_ERROR_CODES.API_ERROR,
      message: `PR 조회 실패 HTTP ${prRes.status}: ${prRes.text.slice(0, 300)}`,
      httpStatus: 502,
    };
  }

  const pr = prRes.json;
  const reviewsPath = `${prPath}/reviews`;
  const revRes = await githubFetchJson<GhReviewJson[]>(token, reviewsPath, { method: "GET" });
  const reviews = Array.isArray(revRes.json) ? revRes.json : [];
  let reviewStatus = deriveReviewStatusFromReviews(reviews);
  const prState = mapGithubPrState(pr);
  if (prState === PR_STATE_MERGED) {
    reviewStatus = REVIEW_APPROVED;
  }

  const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
  const pullRequestUrl = pr.html_url ? String(pr.html_url) : null;

  await prisma.gitChangeRequest.update({
    where: { id: row.id },
    data: {
      pullRequestUrl: pullRequestUrl ?? undefined,
      pullRequestState: prState,
      reviewStatus,
      mergedAt,
    },
  });

  void appendGitPrSyncHistory({
    projectId: row.projectId,
    taskId: row.taskId,
    gitChangeRequestId: row.id,
    pullRequestNumber: n,
    actorUserId: input.actorUserId,
    prev,
    next: {
      pullRequestUrl,
      pullRequestState: prState,
      reviewStatus,
      mergedAt,
    },
  });

  return {
    ok: true,
    data: {
      pullRequestState: prState,
      reviewStatus,
      mergedAt,
      pullRequestUrl,
    },
  };
}

/** 별칭: GitHub PR 단건 상태 조회·DB 반영 */
export function getPullRequestStatus(input: {
  gitChangeRequestId: string;
  actorUserId?: string | null;
}): Promise<SyncPrResult> {
  return syncPullRequestStatus(input);
}

export type GithubPrAutoCreateOutcome =
  | { kind: "skipped" }
  | {
      kind: "created";
      pullRequestUrl: string;
      pullRequestNumber: number;
    }
  | { kind: "failed"; code: string; message: string };

/**
 * git apply 성공 직후: 정책·로그가 맞으면 PR 자동 생성.
 * 실패 시 apply는 DONE 유지, applyLog에 실패 한 줄 추가.
 */
export async function maybeAutoCreateGithubPullRequest(params: {
  mode: string;
  requestedPush: boolean;
  applyLog: string;
  gitPushMode: string;
  gitChangeRequestId: string;
}): Promise<GithubPrAutoCreateOutcome> {
  if (isExecutionSafeMode()) {
    return { kind: "skipped" };
  }
  if (params.mode !== "git") {
    return { kind: "skipped" };
  }
  if (!isAutoGitPushMode(params.gitPushMode)) {
    return { kind: "skipped" };
  }
  if (!params.requestedPush) {
    return { kind: "skipped" };
  }
  if (!applyLogIndicatesPushSuccess(params.applyLog)) {
    return { kind: "skipped" };
  }

  const res = await createPullRequestForGitChangeRequest({
    gitChangeRequestId: params.gitChangeRequestId,
    relaxAutoPushPolicy: false,
  });

  if (res.ok) {
    return {
      kind: "created",
      pullRequestUrl: res.data.pullRequestUrl,
      pullRequestNumber: res.data.pullRequestNumber,
    };
  }
  if (res.code === GITHUB_PR_ERROR_CODES.ALREADY_EXISTS) {
    return { kind: "skipped" };
  }
  console.error("[github-pr] auto-create:", res.code, res.message);
  await appendGithubPrFailureToApplyLog(params.gitChangeRequestId, res.code, res.message);
  return { kind: "failed", code: res.code, message: res.message };
}
