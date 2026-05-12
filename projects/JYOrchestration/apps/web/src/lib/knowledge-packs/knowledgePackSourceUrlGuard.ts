const MAX_REDIRECTS = 5;
export const KP_FETCH_TIMEOUT_MS = 15_000;
export const KP_FETCH_MAX_BYTES = 2 * 1024 * 1024;

const BLOCKED_PROTOCOLS = new Set(["file:", "ftp:", "data:", "javascript:"]);

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    const c = Number(ipv4[3]);
    const d = Number(ipv4[4]);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
  }
  return false;
}

export function validateUrlForKnowledgePackFetch(raw: string): { ok: true; href: string } | { ok: false; message: string } {
  const s = raw.trim();
  if (!s) return { ok: false, message: "URL이 비어 있습니다." };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, message: "유효한 URL 형식이 아닙니다." };
  }
  const protocol = u.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { ok: false, message: "http(s) URL만 허용됩니다." };
  }
  if (BLOCKED_PROTOCOLS.has(protocol)) {
    return { ok: false, message: "허용되지 않는 URL 스킴입니다." };
  }
  if (isBlockedHostname(u.hostname)) {
    return { ok: false, message: "localhost 또는 사설망 URL은 수집할 수 없습니다." };
  }
  return { ok: true, href: u.href };
}

function allowedContentType(ct: string): boolean {
  const c = ct.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!c) return true;
  if (c.includes("pdf")) return false;
  if (c.startsWith("text/")) return true;
  if (c === "application/json" || c === "application/problem+json") return true;
  if (c === "application/yaml" || c === "text/yaml" || c === "application/x-yaml") return true;
  if (c === "application/octet-stream") return true;
  if (c.includes("html")) return true;
  if (c.includes("xml")) return true;
  return false;
}

export type KnowledgePackFetchResult =
  | { ok: true; body: string; contentType: string; finalUrl: string }
  | { ok: false; message: string };

/** 등록된 단일 URL만 가져온다. 리다이렉트는 최대 MAX_REDIRECTS. */
export async function fetchKnowledgePackUrlSafe(startHref: string): Promise<KnowledgePackFetchResult> {
  const first = validateUrlForKnowledgePackFetch(startHref);
  if (!first.ok) return first;

  let current = first.href;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const v = validateUrlForKnowledgePackFetch(current);
    if (!v.ok) return { ok: false, message: v.message };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), KP_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { Accept: "text/html,application/xhtml+xml,text/plain,text/markdown,application/json,*/*;q=0.8" },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || redirect >= MAX_REDIRECTS) {
          return { ok: false, message: `리다이렉트가 너무 많거나 Location이 없습니다. (${res.status})` };
        }
        try {
          current = new URL(loc, current).href;
        } catch {
          return { ok: false, message: "잘못된 리다이렉트 Location입니다." };
        }
        continue;
      }

      if (!res.ok) {
        return { ok: false, message: `HTTP ${res.status}` };
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!allowedContentType(ct)) {
        return { ok: false, message: `지원하지 않는 Content-Type입니다: ${ct.slice(0, 120)}` };
      }

      const clen = res.headers.get("content-length");
      if (clen) {
        const n = Number(clen);
        if (Number.isFinite(n) && n > KP_FETCH_MAX_BYTES) {
          return { ok: false, message: "응답 본문이 허용 크기를 초과합니다." };
        }
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > KP_FETCH_MAX_BYTES) {
        return { ok: false, message: "응답 본문이 허용 크기를 초과합니다." };
      }

      const body = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      return { ok: true, body, contentType: ct, finalUrl: current };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("abort")) return { ok: false, message: "요청 시간이 초과되었습니다." };
      return { ok: false, message: `네트워크 오류: ${msg.slice(0, 200)}` };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, message: "리다이렉트 한도를 초과했습니다." };
}
