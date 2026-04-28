/**
 * Fine-grained GitHub PAT: 단계별 REST 프로브로 PR 생성·머지 권한까지 구분한다.
 * 저장소 메타 → PR 목록 → PR 생성 시도(존재하지 않는 head로 422 유도) → 머지 API(이미 머지된 PR에 대해 422) 또는 협업자 권한.
 */

import {
  githubAcceptedPermissionsLogValue,
  GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME,
  readGithubAcceptedPermissionsHeader,
} from "@/lib/integration/githubAcceptedPermissionsHeader";
import {
  githubTokenFingerprint,
  githubTokenPrefixForLog,
  logGithubTokenBeforeFetch,
  logGithubTokenResolution,
  type GithubTokenSource,
} from "@/lib/integration/githubTokenTrace";

const GH_PAT_PROBE_LOG = "[github-pat-probe]";

function logPatProbe(phase: string, detail: Record<string, unknown>): void {
  try {
    console.info(`${GH_PAT_PROBE_LOG} ${phase} ${JSON.stringify(detail)}`);
  } catch {
    console.info(`${GH_PAT_PROBE_LOG} ${phase}`, detail);
  }
}

export type GithubCapabilityProbeStepName =
  | "repo_metadata"
  | "repo_compare_self"
  | "pr_list"
  | "pr_create_probe"
  | "pr_merge_probe"
  | "collaborator_permission";

export type GithubCapabilityProbeStep = {
  step: GithubCapabilityProbeStepName;
  ok: boolean;
  httpStatus: number;
  errorMessage?: string;
  acceptedPermissions?: string | null;
};

/** 단계별 프로브가 채운 플래그 — `computeGithubOperableOk` 로만 최종 operable 을 낸다. */
export type GithubPatRestCapabilityFlags = {
  repoAccessOk: boolean;
  prReadOk: boolean;
  prCreateOk: boolean;
  prMergeOk: boolean;
};

export function computeGithubOperableOk(flags: GithubPatRestCapabilityFlags): boolean {
  return flags.repoAccessOk && flags.prReadOk && flags.prCreateOk && flags.prMergeOk;
}

export type GithubCapabilityValidationSnapshot = {
  validatedAt: string;
  repoAccessOk: boolean;
  prReadOk: boolean;
  prCreateOk: boolean;
  prMergeOk: boolean;
  githubOperableOk: boolean;
  acceptedPermissionsHeader: string | null;
  /** 권한 검증 기준: GET /repos/{owner}/{repo} 응답의 canonical 헤더 전체 */
  canonicalRepoGetAcceptedPermissions?: string | null;
  tokenSourceUsed?: GithubTokenSource;
  validationEpoch?: number;
  /** metadata=read만 보이는데 운영 불가일 때 토큰 불일치 안내 */
  tokenMismatchHintKr?: string | null;
  lastHttpStatus: number | null;
  lastErrorMessage: string | null;
  steps: GithubCapabilityProbeStep[];
  summaryKr: string;
};

/** validate API probeMessages 한 줄 — 헤더 이름은 GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME 과 동기 */
export function formatGithubCapabilityProbeStepFailureLine(step: GithubCapabilityProbeStep): string {
  const hint = step.acceptedPermissions
    ? ` · ${GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME}: ${step.acceptedPermissions}`
    : "";
  const err = step.errorMessage ? ` · ${step.errorMessage}` : "";
  return `GitHub ${step.step}: HTTP ${step.httpStatus}${hint}${err}`;
}

export function formatGithubCanonicalGetReposPermissionsLine(canonical: string): string {
  return `GitHub GET /repos (canonical) ${GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME}: ${canonical}`;
}

export function formatGithubRecentAcceptedPermissionsLine(merged: string): string {
  return `GitHub (최근) ${GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME}: ${merged}`;
}

async function readBodySnippet(res: Response, max = 800): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { message?: string; errors?: unknown };
    const msg = typeof j.message === "string" ? j.message : "";
    if (msg) return msg.slice(0, max);
  } catch {
    /* ignore */
  }
  return t.slice(0, max);
}

function mergeAccepted(prev: string | null, next: string | null): string | null {
  if (next && next.trim()) return next.trim();
  return prev;
}

function buildTokenMismatchHintKr(
  githubOperableOk: boolean,
  canonicalRepoGetAccepted: string | null,
  mergedAccepted: string | null
): string | null {
  if (githubOperableOk) return null;
  const raw = (canonicalRepoGetAccepted ?? mergedAccepted ?? "").trim().toLowerCase();
  if (!raw) return null;
  const weakMetaOnly =
    raw.includes("metadata=read") &&
    !raw.includes("contents=") &&
    !raw.includes("pull_requests=");
  if (!weakMetaOnly) return null;
  return (
    "GitHub가 허용 권한으로 metadata=read만 보고합니다. DB에 저장된 토큰이 GitHub UI에서 복사한 PAT와 일치하지 않을 가능성이 큽니다(이전 토큰이 남았거나 저장이 덮어쓰이지 않은 경우). " +
    "Execution setup에서 「새 토큰 교체」로 다시 저장한 뒤 서버 로그의 TOKEN_PREFIX·TOKEN_LENGTH·TOKEN_HASH가 기대와 같은지 확인하고 「다시 검증」하세요."
  );
}

export async function runGithubPatCapabilityProbes(input: {
  apiBase: string;
  owner: string;
  repo: string;
  baseBranch: string;
  token: string;
  tokenSource: GithubTokenSource;
  validationEpoch: number;
  /** 검증·로그에 projectId 표시 */
  projectId?: string | null;
}): Promise<GithubCapabilityValidationSnapshot> {
  const api = input.apiBase.replace(/\/$/, "");
  const { owner, repo, baseBranch } = input;
  const token = input.token.trim();
  const tokenSource = input.tokenSource;
  const validationEpoch = input.validationEpoch;
  const projectId = input.projectId?.trim() || null;

  logGithubTokenResolution({
    operation: "github_pat_capability_probes",
    token,
    source: tokenSource,
    validationEpoch,
    projectId,
  });

  let canonicalRepoGetAcceptedPermissions: string | null = null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "JYOrchestration/github-pat-capability-probes",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const steps: GithubCapabilityProbeStep[] = [];
  let acceptedPermissionsHeader: string | null = null;
  let lastHttpStatus: number | null = null;
  let lastErrorMessage: string | null = null;

  const pushFail = (
    step: GithubCapabilityProbeStepName,
    res: Response,
    err: string,
    accepted: string | null
  ) => {
    acceptedPermissionsHeader = mergeAccepted(acceptedPermissionsHeader, accepted);
    lastHttpStatus = res.status;
    lastErrorMessage = err;
    steps.push({
      step,
      ok: false,
      httpStatus: res.status,
      errorMessage: err,
      acceptedPermissions: accepted,
    });
  };

  const pushOk = (step: GithubCapabilityProbeStepName, res: Response, accepted: string | null) => {
    acceptedPermissionsHeader = mergeAccepted(acceptedPermissionsHeader, accepted);
    steps.push({ step, ok: true, httpStatus: res.status, acceptedPermissions: accepted });
  };

  // 1) Repo metadata — 권한 검증 기준 단일 엔드포인트 (canonical X-Accepted-GitHub-Permissions)
  const repoUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  logGithubTokenBeforeFetch("repo_metadata_GET", token, tokenSource, projectId);
  const repoRes = await fetch(repoUrl, { headers });
  const repoAccepted = readGithubAcceptedPermissionsHeader(repoRes);
  canonicalRepoGetAcceptedPermissions = repoAccepted;
  console.info(
    `[GitHub REST] canonical GET /repos/${owner}/${repo} HTTP ${repoRes.status} ${githubAcceptedPermissionsLogValue(repoAccepted)}`
  );
  if (!repoRes.ok) {
    const body = await readBodySnippet(repoRes);
    let detail = `저장소 메타데이터 접근 실패 HTTP ${repoRes.status}: ${body}`;
    if (repoRes.status === 401) {
      detail +=
        " — GitHub가 PAT를 거부했습니다(Bad credentials). 토큰 만료·폐기·복사 오타, 다른 GitHub 계정용 토큰인지 확인하고 Settings → Developer settings에서 새 PAT를 발급한 뒤「새 토큰 교체」로 다시 저장하세요. 조직 저장소는 조직 SSO가 켜져 있으면 해당 조직에 토큰을 승인해야 합니다.";
      const apiHost = (() => {
        try {
          return new URL(api).hostname;
        } catch {
          return "";
        }
      })();
      if (apiHost && apiHost !== "api.github.com") {
        detail += ` (현재 서버 GitHub API 호스트: ${apiHost} — github.com용 PAT와 호스트가 맞는지 확인하세요.)`;
      }
    }
    pushFail("repo_metadata", repoRes, detail, repoAccepted);
    return finalizeSnapshot(
      steps,
      false,
      false,
      false,
      false,
      acceptedPermissionsHeader,
      lastHttpStatus,
      lastErrorMessage,
      canonicalRepoGetAcceptedPermissions,
      tokenSource,
      validationEpoch
    );
  }
  pushOk("repo_metadata", repoRes, repoAccepted);

  // 2) Compare self (ref 읽기 — 베이스 브랜치 존재)
  const baseEnc = encodeURIComponent(baseBranch.trim() || "main");
  const cmpUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${baseEnc}...${baseEnc}`;
  logGithubTokenBeforeFetch("repo_compare_self", token, tokenSource, projectId);
  const cmpRes = await fetch(cmpUrl, { headers });
  const cmpAccepted = readGithubAcceptedPermissionsHeader(cmpRes);
  if (!cmpRes.ok) {
    const body = await readBodySnippet(cmpRes);
    pushFail(
      "repo_compare_self",
      cmpRes,
      `베이스 브랜치 compare 실패 HTTP ${cmpRes.status}: ${body}`,
      cmpAccepted
    );
    return finalizeSnapshot(
      steps,
      true,
      false,
      false,
      false,
      acceptedPermissionsHeader,
      lastHttpStatus,
      lastErrorMessage,
      canonicalRepoGetAcceptedPermissions,
      tokenSource,
      validationEpoch
    );
  }
  pushOk("repo_compare_self", cmpRes, cmpAccepted);

  const repoAccessOk = true;

  // 3) PR 목록 읽기
  const pullsUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&per_page=30&sort=updated`;
  logGithubTokenBeforeFetch("pr_list", token, tokenSource, projectId);
  const pullsRes = await fetch(pullsUrl, { headers });
  const pullsAccepted = readGithubAcceptedPermissionsHeader(pullsRes);
  if (!pullsRes.ok) {
    const body = await readBodySnippet(pullsRes);
    pushFail("pr_list", pullsRes, `PR 목록 조회 실패 HTTP ${pullsRes.status}: ${body}`, pullsAccepted);
    return finalizeSnapshot(
      steps,
      repoAccessOk,
      false,
      false,
      false,
      acceptedPermissionsHeader,
      lastHttpStatus,
      lastErrorMessage,
      canonicalRepoGetAcceptedPermissions,
      tokenSource,
      validationEpoch
    );
  }
  pushOk("pr_list", pullsRes, pullsAccepted);

  let pullsJson: Array<{ number?: number; merged_at?: string | null; state?: string }> = [];
  try {
    pullsJson = (await pullsRes.json()) as typeof pullsJson;
  } catch {
    pullsJson = [];
  }
  const prReadOk = true;

  // 4) PR 생성 권한: 존재하지 않는 head → 422 등으로 “거절”이면 쓰기 경로는 통과한 것으로 본다
  const fakeHead = `jy-orch-pat-probe-${Date.now()}`;
  const createUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
  logGithubTokenBeforeFetch("pr_create_probe_POST", token, tokenSource, projectId);
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "[JYO] PAT capability probe — invalid head (safe)",
      head: fakeHead,
      base: baseBranch.trim() || "main",
    }),
  });
  const createAccepted = readGithubAcceptedPermissionsHeader(createRes);
  const createTxt = await readBodySnippet(createRes);
  let prCreateOk = false;
  if (createRes.status === 403) {
    pushFail(
      "pr_create_probe",
      createRes,
      `PR 생성 권한 없음 HTTP 403: ${createTxt}`,
      createAccepted
    );
    lastHttpStatus = createRes.status;
    lastErrorMessage = `PR 생성(Pull requests: write)이 거부되었습니다. HTTP 403 · ${createTxt.slice(0, 400)}`;
  } else if (createRes.status === 401) {
    pushFail("pr_create_probe", createRes, `인증 실패 HTTP 401: ${createTxt}`, createAccepted);
    lastHttpStatus = createRes.status;
    lastErrorMessage = `GitHub 인증 실패 HTTP 401`;
  } else if (createRes.status === 422) {
    // 422: head 없음/검증 실패 — PR 생성 API는 인증·권한을 통과한 뒤의 검증 단계
    prCreateOk = true;
    pushOk("pr_create_probe", createRes, createAccepted);
  } else if (createRes.status >= 200 && createRes.status < 300) {
    // PR이 실제로 생성되면 안 됨(가짜 head면 거의 불가)
    prCreateOk = true;
    pushOk("pr_create_probe", createRes, createAccepted);
  } else {
    pushFail(
      "pr_create_probe",
      createRes,
      `PR 생성 프로브 비정상 응답 HTTP ${createRes.status}: ${createTxt}`,
      createAccepted
    );
    lastHttpStatus = createRes.status;
    lastErrorMessage = `PR 생성 권한 확인 중 오류 HTTP ${createRes.status}`;
  }

  logPatProbe("pr_create_probe_done", {
    projectId,
    validationEpoch,
    owner,
    repo,
    httpStatus: createRes.status,
    prCreateOk,
    xAcceptedGitHubPermissions: createAccepted ?? null,
    responseBodyHead: createTxt.slice(0, 400),
    tokenFingerprint: githubTokenFingerprint(token),
    tokenPrefix: githubTokenPrefixForLog(token),
  });

  if (!prCreateOk) {
    return finalizeSnapshot(
      steps,
      repoAccessOk,
      prReadOk,
      false,
      false,
      acceptedPermissionsHeader,
      lastHttpStatus,
      lastErrorMessage,
      canonicalRepoGetAcceptedPermissions,
      tokenSource,
      validationEpoch
    );
  }

  // 5) PR 머지 권한: 이미 머지된 PR에 PUT merge → 422/405면 머지 API 접근 가능(403이면 Contents: write 등 부족)
  const mergedPr = pullsJson.find((p) => p.merged_at && typeof p.number === "number");
  let prMergeOk = false;
  /** 403 on merge PUT = definitive failure; do not override with collaborator API */
  let mergeProbeDefinitiveFailure = false;

  const mergedPrCandidates = pullsJson.filter((p) => p.merged_at && typeof p.number === "number");
  logPatProbe("pr_merge_phase_start", {
    projectId,
    validationEpoch,
    owner,
    repo,
    baseBranch: baseBranch.trim() || "main",
    pullsPageCount: pullsJson.length,
    mergedPrCandidateCount: mergedPrCandidates.length,
    mergedPrNumbersSample: mergedPrCandidates.slice(0, 8).map((p) => p.number),
    selectedMergedPrNumber: mergedPr?.number ?? null,
    tokenFingerprint: githubTokenFingerprint(token),
    tokenPrefix: githubTokenPrefixForLog(token),
  });

  if (mergedPr?.number != null) {
    const mergePath = `/repos/${owner}/${repo}/pulls/${mergedPr.number}/merge`;
    logPatProbe("pr_merge_probe_request", {
      projectId,
      validationEpoch,
      method: "PUT",
      mergePath,
      mergeMethod: "merge",
      prNumber: mergedPr.number,
      prState: mergedPr.state ?? null,
      mergedAt: mergedPr.merged_at ?? null,
    });
    const mergeUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${mergedPr.number}/merge`;
    logGithubTokenBeforeFetch("pr_merge_probe_PUT", token, tokenSource, projectId);
    const mergeRes = await fetch(mergeUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ merge_method: "merge" }),
    });
    const mergeAccepted = readGithubAcceptedPermissionsHeader(mergeRes);
    const mergeTxt = await readBodySnippet(mergeRes);
    if (mergeRes.status === 403) {
      mergeProbeDefinitiveFailure = true;
      logPatProbe("pr_merge_probe_result", {
        projectId,
        validationEpoch,
        outcome: "forbidden_no_merge_permission",
        httpStatus: 403,
        xAcceptedGitHubPermissions: mergeAccepted ?? null,
        responseBodyHead: mergeTxt.slice(0, 600),
        prMergeOk: false,
        mergeProbeDefinitiveFailure: true,
      });
      pushFail(
        "pr_merge_probe",
        mergeRes,
        `PR 머지 권한 없음 HTTP 403: ${mergeTxt}`,
        mergeAccepted
      );
      lastHttpStatus = mergeRes.status;
      lastErrorMessage =
        "PR 생성 권한은 확인되었지만 PR 머지 권한이 없습니다. GitHub 토큰에 Contents: write 권한이 필요합니다.";
      if (mergeAccepted) {
        lastErrorMessage += ` (허용 권한 힌트: ${mergeAccepted})`;
      }
    } else if (mergeRes.status === 200) {
      prMergeOk = true;
      logPatProbe("pr_merge_probe_result", {
        projectId,
        validationEpoch,
        outcome: "http200_treated_as_merge_api_ok",
        httpStatus: 200,
        xAcceptedGitHubPermissions: mergeAccepted ?? null,
        responseBodyHead: mergeTxt.slice(0, 400),
        prMergeOk: true,
      });
      pushOk("pr_merge_probe", mergeRes, mergeAccepted);
    } else if (mergeRes.status === 405 || mergeRes.status === 422 || mergeRes.status === 404) {
      prMergeOk = true;
      logPatProbe("pr_merge_probe_result", {
        projectId,
        validationEpoch,
        outcome:
          mergeRes.status === 422
            ? "http422_expected_already_merged_or_invalid"
            : mergeRes.status === 405
              ? "http405_method_not_allowed_treated_ok"
              : "http404_treated_ok",
        httpStatus: mergeRes.status,
        xAcceptedGitHubPermissions: mergeAccepted ?? null,
        responseBodyHead: mergeTxt.slice(0, 600),
        prMergeOk: true,
      });
      pushOk("pr_merge_probe", mergeRes, mergeAccepted);
    } else {
      logPatProbe("pr_merge_probe_result", {
        projectId,
        validationEpoch,
        outcome: "unexpected_status_failure",
        httpStatus: mergeRes.status,
        xAcceptedGitHubPermissions: mergeAccepted ?? null,
        responseBodyHead: mergeTxt.slice(0, 600),
        prMergeOk: false,
      });
      pushFail(
        "pr_merge_probe",
        mergeRes,
        `머지 프로브 HTTP ${mergeRes.status}: ${mergeTxt}`,
        mergeAccepted
      );
      lastHttpStatus = mergeRes.status;
      lastErrorMessage = `PR 머지 권한 확인 중 HTTP ${mergeRes.status}: ${mergeTxt.slice(0, 400)}`;
    }
  } else {
    logPatProbe("pr_merge_probe_skipped", {
      projectId,
      validationEpoch,
      reason: "no_merged_pull_in_first_page",
      pullsPageCount: pullsJson.length,
      openOrOtherSample: pullsJson.slice(0, 6).map((p) => ({
        number: p.number ?? null,
        state: p.state ?? null,
        hasMergedAt: Boolean(p.merged_at),
      })),
    });
  }

  // 6) 머지 결과가 불명확하거나(머지된 PR 없음·비-403 오류) 보조 확인 → 협업자 권한 API
  if (!prMergeOk && !mergeProbeDefinitiveFailure) {
    logPatProbe("collaborator_fallback_enter", {
      projectId,
      validationEpoch,
      prMergeOk,
      mergeProbeDefinitiveFailure,
      reason: "merge_api_unavailable_or_inconclusive",
    });
    logGithubTokenBeforeFetch("collaborator_GET_user", token, tokenSource, projectId);
    const userRes = await fetch(`${api}/user`, { headers });
    const userAccepted = readGithubAcceptedPermissionsHeader(userRes);
    if (!userRes.ok) {
      const body = await readBodySnippet(userRes);
      logPatProbe("collaborator_GET_user_result", {
        projectId,
        validationEpoch,
        httpStatus: userRes.status,
        xAcceptedGitHubPermissions: userAccepted ?? null,
        responseBodyHead: body.slice(0, 400),
        ok: false,
      });
      pushFail("collaborator_permission", userRes, `GET /user 실패 HTTP ${userRes.status}: ${body}`, userAccepted);
      lastHttpStatus = userRes.status;
      lastErrorMessage =
        "저장소에 머지 완료된 PR이 없어 머지 API로 검증하지 못했고, 사용자 정보 조회도 실패했습니다. Contents: write 권한을 확인하세요.";
    } else {
      let login = "";
      try {
        const uj = (await userRes.json()) as { login?: string };
        login = String(uj.login ?? "").trim();
      } catch {
        login = "";
      }
      logPatProbe("collaborator_GET_user_result", {
        projectId,
        validationEpoch,
        httpStatus: userRes.status,
        xAcceptedGitHubPermissions: userAccepted ?? null,
        login: login || null,
        ok: true,
      });
      if (!login) {
        steps.push({
          step: "collaborator_permission",
          ok: false,
          httpStatus: userRes.status,
          errorMessage: "사용자 login을 알 수 없습니다.",
        });
        logPatProbe("collaborator_permission_skipped", {
          projectId,
          validationEpoch,
          reason: "empty_login_after_user_json",
        });
        lastErrorMessage =
          "머지된 PR이 없어 머지 API 검증을 건너뛰었습니다. 저장소에 Contents: write 및 PR 머지 권한을 부여했는지 확인하세요.";
      } else {
        const collabPath = `/repos/${owner}/${repo}/collaborators/${login}/permission`;
        const collabUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(login)}/permission`;
        logPatProbe("collaborator_permission_request", {
          projectId,
          validationEpoch,
          method: "GET",
          collabPath,
          login,
        });
        logGithubTokenBeforeFetch("collaborator_permission_GET", token, tokenSource, projectId);
        const collabRes = await fetch(collabUrl, { headers });
        const collabAccepted = readGithubAcceptedPermissionsHeader(collabRes);
        const collabBodyText = await collabRes.text();
        const collabTxtSnippet = collabBodyText.slice(0, 800);
        if (!collabRes.ok) {
          logPatProbe("collaborator_permission_result", {
            projectId,
            validationEpoch,
            httpStatus: collabRes.status,
            xAcceptedGitHubPermissions: collabAccepted ?? null,
            responseBodyHead: collabTxtSnippet.slice(0, 600),
            ok: false,
          });
          pushFail(
            "collaborator_permission",
            collabRes,
            `협업자 권한 조회 실패 HTTP ${collabRes.status}: ${collabTxtSnippet}`,
            collabAccepted
          );
          lastHttpStatus = collabRes.status;
          lastErrorMessage =
            "머지된 PR이 없어 머지 API를 시험하지 못했고, 협업자 권한 API도 실패했습니다. Fine-grained 토큰에 Contents: write 및 Pull requests: write를 부여했는지 확인하세요.";
          if (collabAccepted) lastErrorMessage += ` (힌트: ${collabAccepted})`;
        } else {
          try {
            const cj = JSON.parse(collabBodyText || "{}") as { permission?: string };
            const perm = String(cj.permission ?? "").toLowerCase();
            const rawJsonHead = JSON.stringify(cj).slice(0, 500);
            if (perm === "admin" || perm === "maintain" || perm === "write") {
              prMergeOk = true;
              logPatProbe("collaborator_permission_result", {
                projectId,
                validationEpoch,
                httpStatus: collabRes.status,
                xAcceptedGitHubPermissions: collabAccepted ?? null,
                parsedPermission: perm,
                rawJsonHead,
                outcome: "merge_ok_via_collaborator_role",
                ok: true,
              });
              pushOk("collaborator_permission", collabRes, collabAccepted);
            } else {
              logPatProbe("collaborator_permission_result", {
                projectId,
                validationEpoch,
                httpStatus: collabRes.status,
                xAcceptedGitHubPermissions: collabAccepted ?? null,
                parsedPermission: perm || "(empty)",
                rawJsonHead,
                outcome: "insufficient_repo_role_for_merge",
                ok: false,
              });
              pushFail(
                "collaborator_permission",
                collabRes,
                `저장소 권한이 '${perm}' 입니다. PR 머지에는 보통 write(Contents: write) 이상이 필요합니다.`,
                collabAccepted
              );
              lastHttpStatus = collabRes.status;
              lastErrorMessage = `GitHub 토큰에 Contents: write(저장소 write) 수준 권한이 필요합니다. 현재 권한: ${perm}`;
            }
          } catch {
            logPatProbe("collaborator_permission_result", {
              projectId,
              validationEpoch,
              httpStatus: collabRes.status,
              xAcceptedGitHubPermissions: collabAccepted ?? null,
              outcome: "json_parse_failed",
              responseBodyHead: collabTxtSnippet.slice(0, 600),
              ok: false,
            });
            pushFail(
              "collaborator_permission",
              collabRes,
              `권한 JSON 파싱 실패: ${collabTxtSnippet}`,
              collabAccepted
            );
            lastErrorMessage = "협업자 권한 응답을 해석하지 못했습니다. Contents: write 권한을 확인하세요.";
          }
        }
      }
    }
  }

  logPatProbe("pr_merge_phase_end", {
    projectId,
    validationEpoch,
    prMergeOk,
    mergeProbeDefinitiveFailure,
    githubOperableWillBe: computeGithubOperableOk({ repoAccessOk, prReadOk, prCreateOk, prMergeOk }),
  });

  return finalizeSnapshot(
    steps,
    repoAccessOk,
    prReadOk,
    prCreateOk,
    prMergeOk,
    acceptedPermissionsHeader,
    lastHttpStatus,
    lastErrorMessage,
    canonicalRepoGetAcceptedPermissions,
    tokenSource,
    validationEpoch
  );
}

function finalizeSnapshot(
  steps: GithubCapabilityProbeStep[],
  repoAccessOk: boolean,
  prReadOk: boolean,
  prCreateOk: boolean,
  prMergeOk: boolean,
  acceptedPermissionsHeader: string | null,
  lastHttpStatus: number | null,
  lastErrorMessage: string | null,
  canonicalRepoGetAcceptedPermissions: string | null,
  tokenSourceUsed: GithubTokenSource,
  validationEpoch: number
): GithubCapabilityValidationSnapshot {
  const githubOperableOk = computeGithubOperableOk({ repoAccessOk, prReadOk, prCreateOk, prMergeOk });
  const tokenMismatchHintKr = buildTokenMismatchHintKr(
    githubOperableOk,
    canonicalRepoGetAcceptedPermissions,
    acceptedPermissionsHeader
  );
  let errOut = lastErrorMessage;
  if (tokenMismatchHintKr && errOut && !errOut.includes("metadata=read")) {
    errOut = `${errOut} · ${tokenMismatchHintKr}`;
  } else if (tokenMismatchHintKr && !errOut) {
    errOut = tokenMismatchHintKr;
  }
  const summaryKr = buildSummaryKr(repoAccessOk, prReadOk, prCreateOk, prMergeOk, errOut);
  return {
    validatedAt: new Date().toISOString(),
    repoAccessOk,
    prReadOk,
    prCreateOk,
    prMergeOk,
    githubOperableOk,
    acceptedPermissionsHeader,
    canonicalRepoGetAcceptedPermissions,
    tokenSourceUsed,
    validationEpoch,
    tokenMismatchHintKr,
    lastHttpStatus,
    lastErrorMessage: errOut,
    steps,
    summaryKr,
  };
}

function buildSummaryKr(
  repo: boolean,
  prRead: boolean,
  prCreate: boolean,
  prMerge: boolean,
  err: string | null
): string {
  const parts: string[] = [];
  parts.push(repo ? "저장소 접근: 정상" : "저장소 접근: 실패");
  parts.push(prRead ? "PR 조회: 정상" : "PR 조회: 실패");
  parts.push(prCreate ? "PR 생성 권한: 정상" : "PR 생성 권한: 실패 (Pull requests: write 필요)");
  parts.push(prMerge ? "PR 머지 권한: 정상" : "PR 머지 권한: 실패 (Contents: write 필요)");
  parts.push(repo && prRead && prCreate && prMerge ? "최종 GitHub 운영: 정상" : "최종 GitHub 운영: 불가");
  if (err && !repo && prRead) parts.push(err);
  else if (err && (!prCreate || !prMerge)) parts.push(err);
  return parts.join(" · ");
}
