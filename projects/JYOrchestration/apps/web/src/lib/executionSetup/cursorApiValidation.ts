/**
 * Cursor API 직접 연결 검증 (릴레이 없음).
 * 공식 문서: Basic 인증, GET {base}/v0/me
 * 저장소 접근: POST {base}/v0/agents 최소 요청(검증 전용)으로 Cursor↔GitHub 경로 확인
 */

import { randomUUID } from "node:crypto";
import {
  enhanceCursorErrorIfBaseBranchRelated,
  isCursorBaseBranchVerifyFailureError,
  isCursorInvalidCreationRequestError,
  repoDisplayForGitError,
} from "@/lib/execution/gitBranchCursorError";
import { validateCursorAgentLaunchPayload } from "@/lib/execution/cursorAgentLaunchValidation";

export const DEFAULT_CURSOR_API_BASE = "https://api.cursor.com";

export type CursorApiValidationStageId = "config" | "connectivity" | "auth" | "readiness" | "repo_access";

export type CursorApiValidationStep = {
  stage: CursorApiValidationStageId;
  status: "pass" | "fail" | "skip";
  reason?: string;
  latencyMs?: number;
  detail?: string;
  /** repo_access 단계 실패 시 UI·저장용(저장소 표시명·브랜치) */
  context?: { displayRepo: string; baseBranch: string };
};

const ME_TIMEOUT_MS = 15_000;
const CURSOR_AGENT_VALIDATE_TIMEOUT_MS = 120_000;

function isLikelyHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeCursorApiBaseUrl(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return DEFAULT_CURSOR_API_BASE;
  return t.replace(/\/+$/, "");
}

export function cursorApiBasicAuthHeader(apiKey: string): string {
  const k = apiKey.trim();
  return `Basic ${Buffer.from(`${k}:`).toString("base64")}`;
}

function isLikelyGitHubHttpsRepo(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    return h === "github.com" || h.endsWith(".github.com");
  } catch {
    return false;
  }
}

async function fetchCursorApiMe(
  baseUrl: string,
  apiKey: string,
  timeoutMs = ME_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; latencyMs: number; bodyPreview?: string; error?: string }> {
  const root = normalizeCursorApiBaseUrl(baseUrl);
  const url = `${root}/v0/me`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        Authorization: cursorApiBasicAuthHeader(apiKey),
        "User-Agent": "JYOrchestration-cursor-validate/1",
      },
    });
    const latencyMs = Date.now() - t0;
    const text = await res.text();
    const bodyPreview = text.length > 400 ? `${text.slice(0, 400)}…` : text;
    return { ok: res.ok, status: res.status, latencyMs, bodyPreview };
  } catch (e: unknown) {
    const latencyMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      latencyMs,
      error: msg.includes("abort") ? "timeout" : msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function tryCancelCursorAgent(baseUrl: string, apiKey: string, agentId: string): Promise<void> {
  const root = normalizeCursorApiBaseUrl(baseUrl);
  const url = `${root}/v0/agents/${encodeURIComponent(agentId)}`;
  try {
    await fetch(url, {
      method: "DELETE",
      redirect: "follow",
      headers: {
        Accept: "application/json",
        Authorization: cursorApiBasicAuthHeader(apiKey),
        "User-Agent": "JYOrchestration-cursor-validate/1",
      },
    });
  } catch {
    /* 삭제 미지원·일시 오류는 무시 */
  }
}

/**
 * Cloud Agent 생성 요청으로 Cursor가 저장소·베이스 ref를 받아들이는지 동기 검증.
 * 성공 시 검증용 에이전트는 best-effort 로 DELETE 시도.
 */
async function launchCursorRepositoryAccessProbe(
  baseUrl: string,
  apiKey: string,
  gitRepoUrl: string,
  baseBranch: string
): Promise<{
  ok: boolean;
  status: number;
  latencyMs: number;
  error?: string;
  agentId?: string;
}> {
  const root = normalizeCursorApiBaseUrl(baseUrl);
  const launchUrl = `${root}/v0/agents`;
  const branchName = `jy-orch-val-${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const probePromptText =
    "[JYOrchestration 검증 전용] 이 작업은 연결 테스트입니다. 저장소와 베이스 브랜치에 접근 가능한지 확인만 하세요. 파일 변경·커밋·푸시·PR 생성은 하지 마세요. 불가능하면 한 줄로 이유만 적으세요.";
  const payloadPre = validateCursorAgentLaunchPayload({
    gitRepoUrl,
    baseBranch,
    targetBranchName: branchName,
    promptText: probePromptText,
  });
  if (!payloadPre.ok) {
    return { ok: false, status: 0, latencyMs: 0, error: payloadPre.message };
  }
  const body = {
    prompt: {
      text: probePromptText,
    },
    model: "default" as const,
    source: {
      repository: gitRepoUrl.trim(),
      ref: baseBranch.trim(),
    },
    target: {
      branchName,
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: true,
    },
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CURSOR_AGENT_VALIDATE_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(launchUrl, {
      method: "POST",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: cursorApiBasicAuthHeader(apiKey),
        "User-Agent": "JYOrchestration-cursor-validate/1",
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - t0;
    const text = await res.text();
    let parsed: { id?: string; error?: string } | null = null;
    try {
      parsed = JSON.parse(text) as { id?: string; error?: string };
    } catch {
      /* non-json */
    }
    if (!res.ok) {
      const rawErr = parsed?.error ? String(parsed.error) : text.slice(0, 1200);
      return { ok: false, status: res.status, latencyMs, error: rawErr };
    }
    const agentId = parsed?.id?.trim();
    return { ok: true, status: res.status, latencyMs, agentId };
  } catch (e: unknown) {
    const latencyMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      latencyMs,
      error: msg.includes("abort") ? "요청 시간 초과(저장소 접근 검증)" : msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type RunCursorApiValidationMode = "full" | "api_only";

export function cursorValidationApiPhasesOk(steps: CursorApiValidationStep[]): boolean {
  const ids: CursorApiValidationStageId[] = ["config", "connectivity", "auth", "readiness"];
  return ids.every((id) => steps.some((s) => s.stage === id && s.status === "pass"));
}

export function cursorValidationRepoAccessOk(steps: CursorApiValidationStep[]): boolean {
  const s = steps.find((x) => x.stage === "repo_access");
  return s?.status === "pass";
}

export async function runCursorApiValidation(
  args: {
    cursorApiUrl: string;
    cursorApiToken: string | null;
    gitRepoUrl: string;
    baseBranch: string;
    branchStrategy: string;
  },
  options?: { mode?: RunCursorApiValidationMode }
): Promise<{ overallOk: boolean; steps: CursorApiValidationStep[] }> {
  const mode: RunCursorApiValidationMode = options?.mode ?? "full";
  const steps: CursorApiValidationStep[] = [];

  const base = normalizeCursorApiBaseUrl(args.cursorApiUrl);
  const key = (args.cursorApiToken ?? "").trim();
  const repo = args.gitRepoUrl.trim();
  const branch = args.baseBranch.trim();
  const strategy = args.branchStrategy.trim();

  if (!isLikelyHttpUrl(base)) {
    steps.push({
      stage: "config",
      status: "fail",
      reason: "INVALID_API_URL",
      detail: base || "(비어 있음)",
    });
    steps.push({ stage: "connectivity", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "auth", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    return { overallOk: false, steps };
  }

  if (!key) {
    steps.push({
      stage: "config",
      status: "fail",
      reason: "API_KEY_MISSING",
      detail: "Cursor API 키가 저장되어 있지 않습니다.",
    });
    steps.push({ stage: "connectivity", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "auth", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    return { overallOk: false, steps };
  }

  if (!repo || !branch || !strategy) {
    steps.push({
      stage: "config",
      status: "fail",
      reason: "EXECUTION_CONFIG_INCOMPLETE",
      detail: "저장소 URL·베이스 브랜치·브랜치 전략이 필요합니다.",
    });
    steps.push({ stage: "connectivity", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "auth", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_CONFIG" });
    return { overallOk: false, steps };
  }

  steps.push({ stage: "config", status: "pass", reason: "OK" });

  const me = await fetchCursorApiMe(base, key);
  if (me.error === "timeout" || (me.status === 0 && me.error)) {
    steps.push({
      stage: "connectivity",
      status: "fail",
      reason: "ENDPOINT_UNREACHABLE",
      latencyMs: me.latencyMs,
      detail: me.error ?? "timeout",
    });
    steps.push({ stage: "auth", status: "skip", reason: "BLOCKED_BY_CONNECTIVITY" });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_CONNECTIVITY" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_CONNECTIVITY" });
    return { overallOk: false, steps };
  }

  steps.push({
    stage: "connectivity",
    status: "pass",
    reason: "OK",
    latencyMs: me.latencyMs,
    detail: `${me.latencyMs}ms`,
  });

  if (me.status === 401) {
    steps.push({
      stage: "auth",
      status: "fail",
      reason: "AUTH_FAILED",
      detail: me.bodyPreview,
    });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_AUTH" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_AUTH" });
    return { overallOk: false, steps };
  }

  if (me.status === 403) {
    steps.push({
      stage: "auth",
      status: "fail",
      reason: "AUTH_FORBIDDEN",
      detail: me.bodyPreview,
    });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_AUTH" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_AUTH" });
    return { overallOk: false, steps };
  }

  if (!me.ok) {
    steps.push({
      stage: "auth",
      status: "fail",
      reason: "API_ERROR",
      detail: me.bodyPreview || `HTTP ${me.status}`,
    });
    steps.push({ stage: "readiness", status: "skip", reason: "BLOCKED_BY_AUTH" });
    steps.push({ stage: "repo_access", status: "skip", reason: "BLOCKED_BY_AUTH" });
    return { overallOk: false, steps };
  }

  steps.push({ stage: "auth", status: "pass", reason: "OK", detail: me.bodyPreview });

  if (!isLikelyGitHubHttpsRepo(repo)) {
    steps.push({
      stage: "readiness",
      status: "fail",
      reason: "REPO_NOT_GITHUB_HTTPS",
      detail: "Cursor Cloud Agent는 GitHub HTTPS 저장소 URL을 권장합니다.",
    });
    steps.push({ stage: "repo_access", status: "skip", reason: "NOT_GITHUB_HTTPS" });
    return { overallOk: false, steps };
  }

  steps.push({
    stage: "readiness",
    status: "pass",
    reason: "OK",
    detail: "GitHub HTTPS 저장소 URL 형식",
  });

  if (mode === "api_only") {
    steps.push({
      stage: "repo_access",
      status: "skip",
      reason: "API_VALIDATION_ONLY",
      detail: "실행(저장소) 검증은 별도 단계에서 진행합니다.",
    });
    return { overallOk: true, steps };
  }

  const displayRepo = repoDisplayForGitError(repo);
  const probe = await launchCursorRepositoryAccessProbe(base, key, repo, branch);
  if (!probe.ok) {
    const raw = probe.error ?? `HTTP ${probe.status}`;
    const enhanced = enhanceCursorErrorIfBaseBranchRelated(raw, { gitRepoUrl: repo, baseBranch: branch });
    const branchRelated =
      isCursorBaseBranchVerifyFailureError(raw) && !isCursorInvalidCreationRequestError(raw);
    const reason = branchRelated
      ? "CURSOR_BRANCH_REF_INVALID"
      : isCursorInvalidCreationRequestError(raw)
        ? "CURSOR_AGENT_CREATION_INVALID"
        : "CURSOR_REPO_ACCESS_FAILED";
    steps.push({
      stage: "repo_access",
      status: "fail",
      reason,
      latencyMs: probe.latencyMs,
      detail: enhanced.slice(0, 4000),
      context: { displayRepo, baseBranch: branch },
    });
    return { overallOk: false, steps };
  }

  if (probe.agentId) {
    await tryCancelCursorAgent(base, key, probe.agentId);
  }

  steps.push({
    stage: "repo_access",
    status: "pass",
    reason: "OK",
    latencyMs: probe.latencyMs,
    detail: "Cloud Agent 생성 요청 수락(검증 전용 브랜치, 종료 시도)",
    context: { displayRepo, baseBranch: branch },
  });
  return { overallOk: true, steps };
}

export function formatCursorApiFailureForStorage(steps: CursorApiValidationStep[]): string {
  const failed = steps.find((s) => s.status === "fail");
  if (!failed) {
    return "검증 실패(단계 정보 없음)";
  }
  if (failed.stage === "repo_access") {
    if (failed.reason === "CURSOR_AGENT_CREATION_INVALID" && failed.detail?.trim()) {
      return failed.detail.trim();
    }
    if (failed.reason === "CURSOR_BRANCH_REF_INVALID" && failed.detail?.trim()) {
      return `Cursor가 저장소에 접근할 수 없습니다.\n\n${failed.detail.trim()}`;
    }
    const repo = failed.context?.displayRepo ?? "(저장소)";
    const br = failed.context?.baseBranch ?? "(브랜치)";
    const tail = (failed.detail ?? "").trim().slice(0, 2500);
    return [
      "Cursor가 저장소에 접근할 수 없습니다.",
      "",
      "Cursor 저장소 접근 검증 실패",
      "",
      `저장소: ${repo}`,
      `브랜치: ${br}`,
      "",
      "가능한 원인:",
      "- Cursor API 키가 유효하지 않습니다",
      "- Cursor 계정의 GitHub 연동이 없습니다",
      "- Cursor가 이 저장소에 접근할 권한이 없습니다",
      "- 베이스 브랜치 이름이 저장소와 다릅니다",
      "",
      "Cursor/Cloud Agent 응답 요약:",
      tail || "(내용 없음)",
    ].join("\n");
  }

  const lines: string[] = ["Cursor API 검증 실패", ""];
  lines.push(`단계: ${stageLabelKr(failed.stage)}`, "");
  lines.push("원인:");
  lines.push(...reasonLinesKr(failed));
  lines.push("");
  lines.push("조치 방법:");
  lines.push(...actionLinesKr(failed.reason));
  return lines.join("\n");
}

function formatCursorApiApiOnlySuccessForStorage(steps: CursorApiValidationStep[]): string {
  const lines = [
    "Cursor API 검증 완료",
    "",
    "- API URL·연결·키 인증에 성공했습니다",
    "- GitHub HTTPS 저장소 형식이 확인되었습니다",
  ];
  const c = steps.find((s) => s.stage === "connectivity" && s.status === "pass");
  if (c?.latencyMs != null) lines.push(`- API 응답 시간: ${c.latencyMs}ms`);
  return lines.join("\n");
}

export function formatCursorApiSuccessForStorage(steps: CursorApiValidationStep[]): string {
  const ra = steps.find((s) => s.stage === "repo_access");
  if (ra?.status === "skip") {
    return formatCursorApiApiOnlySuccessForStorage(steps);
  }
  const lines = [
    "실행 검증 완료",
    "",
    "- Cursor API·저장소 형식 확인됨",
    "- Cloud Agent가 이 저장소·베이스 브랜치에서 작업을 시작할 수 있음",
  ];
  const c = steps.find((s) => s.stage === "connectivity" && s.status === "pass");
  if (c?.latencyMs != null) lines.push(`- API 응답 시간: ${c.latencyMs}ms`);
  const rap = steps.find((s) => s.stage === "repo_access" && s.status === "pass");
  if (rap?.latencyMs != null) lines.push(`- Agent 요청 응답 시간: ${rap.latencyMs}ms`);
  return lines.join("\n");
}

function stageLabelKr(s: CursorApiValidationStageId): string {
  if (s === "config") return "설정 확인";
  if (s === "connectivity") return "API 연결";
  if (s === "auth") return "API 인증";
  if (s === "readiness") return "저장소 URL 형식";
  return "Cursor 저장소 접근(Cloud Agent)";
}

function reasonLinesKr(step: CursorApiValidationStep): string[] {
  const r = step.reason ?? "";
  const map: Record<string, string> = {
    INVALID_API_URL: "- Cursor API URL 형식이 올바르지 않습니다.",
    API_KEY_MISSING: "- Cursor API 키가 비어 있거나 저장되지 않았습니다.",
    EXECUTION_CONFIG_INCOMPLETE: "- 저장소·브랜치·브랜치 전략 등 실행 설정이 부족합니다.",
    ENDPOINT_UNREACHABLE: "- Cursor API 서버에 연결할 수 없습니다(네트워크·타임아웃).",
    AUTH_FAILED: "- API 키가 올바르지 않습니다(인증 실패).",
    AUTH_FORBIDDEN: "- API 키 권한이 부족합니다(403). 플랜·팀 설정을 확인하세요.",
    API_ERROR: "- Cursor API가 오류를 반환했습니다.",
    REPO_NOT_GITHUB_HTTPS: "- Cloud Agent는 GitHub HTTPS 저장소를 사용하는 것이 안전합니다.",
    CURSOR_BRANCH_REF_INVALID: "- 베이스 브랜치가 원격에 없거나 Cursor가 ref를 검증하지 못했습니다.",
    CURSOR_AGENT_CREATION_INVALID:
      "- Cloud Agent 생성 요청이 거절되었습니다(파라미터·형식·권한 등). Git 브랜치 존재 여부만의 문제는 아닐 수 있습니다.",
    CURSOR_REPO_ACCESS_FAILED: "- Cursor가 이 저장소에 Cloud Agent로 접근하지 못했습니다.",
  };
  const line = map[r] ?? `- 오류: ${r}`;
  const out = [line];
  if (step.detail && step.detail.length < 500) out.push(`  (${step.detail})`);
  return out;
}

function actionLinesKr(reason: string | undefined): string[] {
  switch (reason) {
    case "INVALID_API_URL":
      return ["- 기본값 https://api.cursor.com 을 쓰거나, 올바른 https:// 주소를 입력하세요."];
    case "API_KEY_MISSING":
      return [
        "- Cursor 대시보드 → Integrations(또는 Cloud Agents)에서 API 키를 발급한 뒤 저장하고 다시 검증하세요.",
      ];
    case "EXECUTION_CONFIG_INCOMPLETE":
      return ["- Git 연동에서 저장소 URL·베이스 브랜치를 저장하고, 실행 옵션에서 브랜치 전략을 선택하세요."];
    case "ENDPOINT_UNREACHABLE":
      return ["- 방화벽·프록시·URL 오타를 확인하고, 잠시 후 다시 시도하세요."];
    case "AUTH_FAILED":
      return ["- API 키를 다시 복사해 붙여넣고 저장한 뒤 검증하세요."];
    case "AUTH_FORBIDDEN":
      return ["- 팀·요금제에서 Cloud Agents API 사용 가능 여부를 확인하세요."];
    case "API_ERROR":
      return ["- Cursor 상태 페이지·문서를 참고하고, 응답 본문의 안내를 확인하세요."];
    case "REPO_NOT_GITHUB_HTTPS":
      return ["- GitHub 저장소의 https://github.com/… 형태 URL을 사용하세요."];
    case "CURSOR_BRANCH_REF_INVALID":
      return [
        "- Git 연동에서 베이스 브랜치를 실제 GitHub 기본 브랜치와 맞추세요.",
        "- 저장소 연결 검증으로 플랫폼 측 refs 도달성을 먼저 확인하세요.",
      ];
    case "CURSOR_AGENT_CREATION_INVALID":
      return [
        "- Cursor 대시보드에서 Cloud Agents·GitHub 연동·API 키 권한을 확인하세요.",
        "- 저장소 URL·베이스 브랜치·요청 본문이 Cursor 문서의 형식과 맞는지 확인하세요.",
      ];
    case "CURSOR_REPO_ACCESS_FAILED":
      return [
        "- Cursor 대시보드에서 GitHub 연동·앱 권한을 확인하세요.",
        "- Cloud Agents API 키가 팀·플랜에서 허용되는지 확인하세요.",
        "- 비공개 저장소는 Cursor가 접근할 수 있는 계정으로 연결되어야 합니다.",
      ];
    default:
      return ["- 위 원인에 맞게 수정한 뒤「실행 검증」단계를 다시 실행하세요."];
  }
}

export function formatCursorApiStepSummaryLines(steps: CursorApiValidationStep[]): string[] {
  const label: Record<CursorApiValidationStageId, string> = {
    config: "설정 확인",
    connectivity: "Cursor API 연결",
    auth: "API 키 인증",
    readiness: "저장소 URL 형식(GitHub HTTPS)",
    repo_access: "Cursor 저장소 접근(Agent)",
  };
  return steps.map((s) => {
    const icon = s.status === "pass" ? "✔" : s.status === "skip" ? "—" : "❌";
    const suffix = s.reason && s.status !== "pass" ? `\n  · ${reasonShortKr(s.reason)}` : "";
    return `${icon} ${label[s.stage]}${suffix}`;
  });
}

function reasonShortKr(r: string): string {
  const m: Record<string, string> = {
    INVALID_API_URL: "URL 형식 오류",
    API_KEY_MISSING: "API 키 누락",
    EXECUTION_CONFIG_INCOMPLETE: "실행 설정 부족",
    ENDPOINT_UNREACHABLE: "서버 응답 없음",
    AUTH_FAILED: "인증 실패",
    AUTH_FORBIDDEN: "권한 부족(403)",
    API_ERROR: "API 오류",
    REPO_NOT_GITHUB_HTTPS: "GitHub HTTPS 저장소 필요",
    CURSOR_BRANCH_REF_INVALID: "브랜치/ref 검증 실패",
    CURSOR_AGENT_CREATION_INVALID: "Agent 생성 요청 거절",
    CURSOR_REPO_ACCESS_FAILED: "저장소 Agent 접근 실패",
    NOT_GITHUB_HTTPS: "GitHub HTTPS 아님",
    BLOCKED_BY_CONFIG: "이전 단계 필요",
    BLOCKED_BY_CONNECTIVITY: "연결 실패로 생략",
    BLOCKED_BY_AUTH: "인증 실패로 생략",
    API_VALIDATION_ONLY: "API 단계만 검증",
    OK: "",
  };
  return m[r] ?? r;
}
