/**
 * Cursor API 직접 연결 검증 (릴레이 없음).
 * 공식 문서: Basic 인증, GET {base}/v0/me
 */

export const DEFAULT_CURSOR_API_BASE = "https://api.cursor.com";

export type CursorApiValidationStageId = "config" | "connectivity" | "auth" | "readiness";

export type CursorApiValidationStep = {
  stage: CursorApiValidationStageId;
  status: "pass" | "fail" | "skip";
  reason?: string;
  latencyMs?: number;
  detail?: string;
};

const ME_TIMEOUT_MS = 15_000;

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

export async function runCursorApiValidation(args: {
  cursorApiUrl: string;
  cursorApiToken: string | null;
  gitRepoUrl: string;
  baseBranch: string;
  branchStrategy: string;
}): Promise<{ overallOk: boolean; steps: CursorApiValidationStep[] }> {
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
    return { overallOk: false, steps };
  }

  steps.push({ stage: "readiness", status: "pass", reason: "OK" });
  return { overallOk: true, steps };
}

export function formatCursorApiFailureForStorage(steps: CursorApiValidationStep[]): string {
  const lines: string[] = ["Cursor API 연결 검증 실패", ""];
  const failed = steps.find((s) => s.status === "fail");
  if (failed) {
    lines.push(`단계: ${stageLabelKr(failed.stage)}`, "");
    lines.push("원인:");
    lines.push(...reasonLinesKr(failed));
    lines.push("");
    lines.push("조치 방법:");
    lines.push(...actionLinesKr(failed.reason));
  } else {
    lines.push("원인을 확인할 수 없습니다. 설정을 다시 확인하세요.");
  }
  return lines.join("\n");
}

export function formatCursorApiSuccessForStorage(steps: CursorApiValidationStep[]): string {
  const lines = [
    "Cursor API 연결 검증 완료",
    "",
    "- API 엔드포인트에 연결되었습니다",
    "- API 키 인증에 성공했습니다",
    "- Cloud Agent 실행에 필요한 저장소 형식이 갖춰졌습니다",
  ];
  const c = steps.find((s) => s.stage === "connectivity" && s.status === "pass");
  if (c?.latencyMs != null) lines.push(`- 응답 시간: ${c.latencyMs}ms`);
  return lines.join("\n");
}

function stageLabelKr(s: CursorApiValidationStageId): string {
  if (s === "config") return "설정 확인";
  if (s === "connectivity") return "API 연결";
  if (s === "auth") return "API 인증";
  return "실행 준비(저장소)";
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
    default:
      return ["- 위 원인에 맞게 수정한 뒤「Cursor API 연결 검증」을 다시 실행하세요."];
  }
}

export function formatCursorApiStepSummaryLines(steps: CursorApiValidationStep[]): string[] {
  const label: Record<CursorApiValidationStageId, string> = {
    config: "설정 확인",
    connectivity: "Cursor API 연결",
    auth: "API 키 인증",
    readiness: "실행 준비(저장소 형식)",
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
    BLOCKED_BY_CONFIG: "이전 단계 필요",
    BLOCKED_BY_CONNECTIVITY: "연결 실패로 생략",
    BLOCKED_BY_AUTH: "인증 실패로 생략",
    OK: "",
  };
  return m[r] ?? r;
}
