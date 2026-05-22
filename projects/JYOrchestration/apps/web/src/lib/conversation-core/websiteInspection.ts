/**
 * Pre-project messenger feasibility: safe outbound GET/HEAD for URL inspection (SSRF-hardened).
 */

export type WebsiteInspectionResult = {
  readonly url: string;
  readonly ok: boolean;
  readonly status?: number;
  readonly finalUrl?: string;
  readonly contentType?: string;
  readonly title?: string | null;
  readonly robotsTxtUrl?: string;
  readonly robotsTxtStatus?: number | null;
  readonly robotsTxtPreview?: string | null;
  readonly htmlPreview?: string | null;
  readonly paginationHints: readonly string[];
  readonly listStructureHints: readonly string[];
  readonly dynamicLoadingHints: readonly string[];
  readonly risks: readonly string[];
  readonly recommendation: readonly string[];
  readonly error?: string;
};

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const MAX_BODY_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;
const PREVIEW_CHARS = 4000;

export function extractUrlsFromTranscript(
  transcript: readonly { readonly role: "user" | "assistant"; readonly content: string }[],
  max = 3
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const userLines = transcript.filter((m) => m.role === "user").map((m) => String(m.content ?? ""));
  for (let i = userLines.length - 1; i >= 0 && out.length < max; i--) {
    const text = userLines[i]!;
    const matches = text.match(URL_IN_TEXT_RE) ?? [];
    for (let j = matches.length - 1; j >= 0 && out.length < max; j--) {
      const raw = matches[j]!.replace(/[.,;:!?)]+$/, "");
      const normalized = normalizeHttpUrl(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

function normalizeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** @internal 테스트·검증용 */
export function assertSafePublicHttpUrl(url: string): { ok: true; parsed: URL } | { ok: false; code: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: "SAFE_URL_BLOCKED" };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, code: "INVALID_URL" };
  if (host === "localhost" || host.endsWith(".localhost")) return { ok: false, code: "SAFE_URL_BLOCKED" };
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "[::1]") {
    return { ok: false, code: "SAFE_URL_BLOCKED" };
  }
  if (isPrivateOrReservedHost(host)) return { ok: false, code: "SAFE_URL_BLOCKED" };
  return { ok: true, parsed };
}

function isPrivateOrReservedHost(host: string): boolean {
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function truncatePreview(text: string, max = PREVIEW_CHARS): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function extractTitleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1]!.replace(/\s+/g, " ").trim().slice(0, 200) || null;
}

function analyzeHtmlHints(html: string): {
  paginationHints: string[];
  listStructureHints: string[];
  dynamicLoadingHints: string[];
  risks: string[];
} {
  const paginationHints: string[] = [];
  const listStructureHints: string[] = [];
  const dynamicLoadingHints: string[] = [];
  const risks: string[] = [];
  const lower = html.slice(0, 120_000).toLowerCase();

  if (/page(?:no|index|num)?=|pageno=|page_index|pagination|next\s*page|이전\s*페이지|다음\s*페이지/i.test(html)) {
    paginationHints.push("페이지네이션 링크/파라미터 힌트");
  }
  if (/<table[\s>]/i.test(html)) listStructureHints.push("HTML table 구조");
  if (/<ul[\s>]|<ol[\s>]/i.test(html)) listStructureHints.push("목록(ul/ol) 구조");
  if (/card-list|list-item|repeat|grid-item/i.test(lower)) listStructureHints.push("반복 카드/리스트 클래스 힌트");
  if (/<script[\s>]/i.test(html)) dynamicLoadingHints.push("script 태그 존재");
  if (/__next_data__|reactroot|ng-app|data-reactroot/i.test(lower)) {
    dynamicLoadingHints.push("SPA/프레임워크 렌더링 힌트");
  }
  if (/fetch\(|axios\.|xmlhttprequest|\.ajax\(/i.test(html)) {
    dynamicLoadingHints.push("클라이언트 fetch/ajax 호출 힌트");
  }
  if (/captcha|cloudflare|access denied|403 forbidden/i.test(lower)) {
    risks.push("접근 제한·봇 차단 페이지 가능성");
  }
  return { paginationHints, listStructureHints, dynamicLoadingHints, risks };
}

async function fetchWithLimits(
  url: string,
  method: "GET" | "HEAD"
): Promise<{ res: Response; finalUrl: string } | { error: string }> {
  const safe = assertSafePublicHttpUrl(url);
  if (!safe.ok) return { error: safe.code };

  let current = safe.parsed.toString();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const hopSafe = assertSafePublicHttpUrl(current);
    if (!hopSafe.ok) return { error: hopSafe.code };
    try {
      const res = await fetch(current, {
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "JYOrchestration-WebsiteInspection/1.0",
          Accept: method === "HEAD" ? "*/*" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { error: "REDIRECT_NO_LOCATION" };
        current = new URL(loc, current).toString();
        continue;
      }
      return { res, finalUrl: current };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/abort|timeout/i.test(msg)) return { error: "TIMEOUT" };
      return { error: "FETCH_FAILED" };
    }
  }
  return { error: "TOO_MANY_REDIRECTS" };
}

async function readBodyLimited(res: Response): Promise<string> {
  const len = res.headers.get("content-length");
  if (len && Number(len) > MAX_BODY_BYTES) return "";
  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > MAX_BODY_BYTES ? buf.slice(0, MAX_BODY_BYTES) : buf;
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}

export async function inspectWebsite(url: string): Promise<WebsiteInspectionResult> {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) {
    return emptyResult(url, false, "INVALID_URL");
  }

  const headAttempt = await fetchWithLimits(normalized, "HEAD");
  let status: number | undefined;
  let finalUrl = normalized;
  let contentType: string | undefined;
  let html = "";

  if ("error" in headAttempt) {
    const getAttempt = await fetchWithLimits(normalized, "GET");
    if ("error" in getAttempt) {
      return emptyResult(normalized, false, getAttempt.error);
    }
    status = getAttempt.res.status;
    finalUrl = getAttempt.finalUrl;
    contentType = getAttempt.res.headers.get("content-type") ?? undefined;
    if ((contentType ?? "").includes("text/html")) {
      html = await readBodyLimited(getAttempt.res);
    }
  } else {
    status = headAttempt.res.status;
    finalUrl = headAttempt.finalUrl;
    contentType = headAttempt.res.headers.get("content-type") ?? undefined;
    if ((contentType ?? "").includes("text/html") && status >= 200 && status < 400) {
      const getAttempt = await fetchWithLimits(finalUrl, "GET");
      if (!("error" in getAttempt)) {
        html = await readBodyLimited(getAttempt.res);
        status = getAttempt.res.status;
        contentType = getAttempt.res.headers.get("content-type") ?? contentType;
      }
    }
  }

  const title = html ? extractTitleFromHtml(html) : null;
  const hints = html ? analyzeHtmlHints(html) : { paginationHints: [], listStructureHints: [], dynamicLoadingHints: [], risks: [] };
  const recommendation: string[] = [];
  if (status && status >= 200 && status < 400) {
    recommendation.push("HTTP 응답은 정상 범위 — HTML/API 구조 추가 확인");
  } else if (status) {
    recommendation.push(`HTTP ${status} — 수동 브라우저 확인 또는 인증 필요 여부 점검`);
    hints.risks.push(`HTTP status ${status}`);
  }
  if (hints.dynamicLoadingHints.length) {
    recommendation.push("Network 탭에서 목록 API(XHR/fetch) 존재 여부 확인");
  } else if (hints.listStructureHints.length) {
    recommendation.push("서버 HTML 내 반복 구조 기반 1차 수집 검토");
  }

  let robotsTxtUrl: string | undefined;
  let robotsTxtStatus: number | null = null;
  let robotsTxtPreview: string | null = null;
  try {
    const origin = new URL(finalUrl).origin;
    robotsTxtUrl = `${origin}/robots.txt`;
    const robotsFetch = await fetchWithLimits(robotsTxtUrl, "GET");
    if (!("error" in robotsFetch)) {
      robotsTxtStatus = robotsFetch.res.status;
      if (robotsFetch.res.ok) {
        const body = await readBodyLimited(robotsFetch.res);
        robotsTxtPreview = truncatePreview(body, 800);
      }
    }
  } catch {
    robotsTxtStatus = null;
  }

  const ok = Boolean(status && status >= 200 && status < 400);
  return {
    url: normalized,
    ok,
    status,
    finalUrl,
    contentType,
    title,
    robotsTxtUrl,
    robotsTxtStatus,
    robotsTxtPreview,
    htmlPreview: html ? truncatePreview(html) : null,
    paginationHints: hints.paginationHints,
    listStructureHints: hints.listStructureHints,
    dynamicLoadingHints: hints.dynamicLoadingHints,
    risks: hints.risks,
    recommendation,
    error: ok ? undefined : hints.risks[0] ?? "HTTP_NOT_OK",
  };
}

function emptyResult(url: string, ok: boolean, error: string): WebsiteInspectionResult {
  return {
    url,
    ok,
    paginationHints: [],
    listStructureHints: [],
    dynamicLoadingHints: [],
    risks: [],
    recommendation: ["자동 점검 실패 — 브라우저 개발자도구·수동 확인 필요"],
    error,
  };
}

export function formatWebsiteInspectionForPrompt(result: WebsiteInspectionResult): string {
  const lines = [
    "[inspectionResult]",
    `url=${result.url}`,
    `ok=${result.ok}`,
    result.status != null ? `status=${result.status}` : "",
    result.finalUrl ? `finalUrl=${result.finalUrl}` : "",
    result.contentType ? `contentType=${result.contentType}` : "",
    result.title ? `title=${result.title}` : "",
    result.robotsTxtUrl ? `robotsTxtUrl=${result.robotsTxtUrl}` : "",
    result.robotsTxtStatus != null ? `robotsTxtStatus=${result.robotsTxtStatus}` : "",
    result.robotsTxtPreview ? `robotsTxtPreview=${truncatePreview(result.robotsTxtPreview, 500)}` : "",
    result.error ? `error=${result.error}` : "",
    result.paginationHints.length ? `paginationHints=[${result.paginationHints.join("; ")}]` : "",
    result.listStructureHints.length ? `listStructureHints=[${result.listStructureHints.join("; ")}]` : "",
    result.dynamicLoadingHints.length ? `dynamicLoadingHints=[${result.dynamicLoadingHints.join("; ")}]` : "",
    result.risks.length ? `risks=[${result.risks.join("; ")}]` : "",
    result.recommendation.length ? `recommendation=[${result.recommendation.join("; ")}]` : "",
    result.htmlPreview ? `htmlPreview=${truncatePreview(result.htmlPreview, 1200)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
