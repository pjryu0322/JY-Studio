import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

export type PreviewCaptureSecurityVerdict =
  | Readonly<{ readonly ok: true; readonly absolutePreviewUrl: string }>
  | Readonly<{ readonly ok: false; readonly code: "security" | "validation"; readonly message: string }>;

function readEnvDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function normalizeUrlForCompare(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith("/")) return trimmed.replace(/\/+$/, "") || "/";
    const parsed = new URL(trimmed);
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

export function resolveAbsolutePreviewUrl(input: {
  readonly previewUrl: string;
  readonly platformOrigin: string;
}): string | null {
  const raw = input.previewUrl.trim();
  const origin = input.platformOrigin.trim().replace(/\/+$/, "");
  if (!raw || !origin) return null;
  if (raw.startsWith("/")) {
    try {
      return new URL(raw, `${origin}/`).href;
    } catch {
      return null;
    }
  }
  try {
    return new URL(raw).href;
  } catch {
    return null;
  }
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums;
}

function isBlockedHostname(hostname: string, isDevelopment: boolean): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (h === "0.0.0.0" || h === "metadata.google.internal") return true;
  if (h === "localhost" || h.endsWith(".localhost")) {
    return !isDevelopment;
  }
  const v4 = parseIpv4(h);
  if (v4) {
    const [a, b] = v4;
    if (a === 127) return !isDevelopment;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  return false;
}

function isGithubIoHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "github.io" || h.endsWith(".github.io");
}

export function collectProjectPreviewUrlCandidates(input: {
  readonly projectId: string;
  readonly previewRuntime: ImplementationPreviewRuntimeV1 | null | undefined;
  readonly platformOrigin: string;
}): string[] {
  const pid = input.projectId.trim();
  const origin = input.platformOrigin.trim().replace(/\/+$/, "");
  const rt = input.previewRuntime;
  const rawCandidates = [
    rt?.previewUrl,
    rt?.appPreviewUrl,
    rt?.externalPreviewUrl,
    rt?.internalAppPreviewUrl,
    rt?.githubPagesUrl,
    rt?.localPreviewServerUrl,
    pid && origin ? `${origin}/projects/${encodeURIComponent(pid)}/preview?scope=latest` : null,
    pid ? `/projects/${pid}/preview?scope=latest` : null,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of rawCandidates) {
    const s = String(c ?? "").trim();
    if (!s) continue;
    const abs = s.startsWith("/") && origin ? resolveAbsolutePreviewUrl({ previewUrl: s, platformOrigin: origin }) : s;
    const norm = normalizeUrlForCompare(abs ?? s);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(abs ?? s);
  }
  return out;
}

export function previewUrlMatchesProjectAllowlist(input: {
  readonly absolutePreviewUrl: string;
  readonly allowedPreviewUrls: readonly string[];
}): boolean {
  const target = normalizeUrlForCompare(input.absolutePreviewUrl);
  if (!target) return false;
  for (const allowed of input.allowedPreviewUrls) {
    const norm = normalizeUrlForCompare(allowed);
    if (norm && norm === target) return true;
  }
  return false;
}

export function validatePreviewCaptureTargetUrl(input: {
  readonly previewUrl: string;
  readonly projectId: string;
  readonly platformOrigin: string;
  readonly allowedPreviewUrls?: readonly string[];
  readonly isDevelopment?: boolean;
}): PreviewCaptureSecurityVerdict {
  const isDevelopment = input.isDevelopment ?? readEnvDevelopment();
  const platformOrigin = input.platformOrigin.trim();
  if (!platformOrigin) {
    return { ok: false, code: "validation", message: "platformOrigin이 필요합니다." };
  }
  const absolutePreviewUrl = resolveAbsolutePreviewUrl({
    previewUrl: input.previewUrl,
    platformOrigin,
  });
  if (!absolutePreviewUrl) {
    return { ok: false, code: "validation", message: "Preview URL 형식이 올바르지 않습니다." };
  }

  let parsed: URL;
  try {
    parsed = new URL(absolutePreviewUrl);
  } catch {
    return { ok: false, code: "validation", message: "Preview URL을 해석할 수 없습니다." };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return {
      ok: false,
      code: "security",
      message: "보안 정책상 이 Preview URL은 서버 캡처 대상이 아닙니다.",
    };
  }

  if (protocol === "http:" && !isDevelopment && !isGithubIoHost(parsed.hostname)) {
    return {
      ok: false,
      code: "security",
      message: "보안 정책상 이 Preview URL은 서버 캡처 대상이 아닙니다.",
    };
  }

  if (isBlockedHostname(parsed.hostname, isDevelopment)) {
    return {
      ok: false,
      code: "security",
      message: "보안 정책상 이 Preview URL은 서버 캡처 대상이 아닙니다.",
    };
  }

  const allowlisted =
    previewUrlMatchesProjectAllowlist({
      absolutePreviewUrl,
      allowedPreviewUrls: input.allowedPreviewUrls ?? [],
    }) ||
    (isDevelopment && isGithubIoHost(parsed.hostname));

  if (!allowlisted) {
    return {
      ok: false,
      code: "security",
      message: "보안 정책상 이 Preview URL은 서버 캡처 대상이 아닙니다. 허용된 Preview URL인지 확인해 주세요.",
    };
  }

  return { ok: true, absolutePreviewUrl };
}
