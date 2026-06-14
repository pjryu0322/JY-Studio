export function sanitizePreviewViewerTargetParam(input: {
  readonly projectId: string;
  readonly target: string | null | undefined;
}): string | null {
  const pid = input.projectId.trim();
  const raw = String(input.target ?? "").trim();
  if (!pid || !raw) return null;

  if (raw.startsWith("/")) {
    const prefix = `/projects/${pid}/`;
    if (!raw.startsWith(prefix)) {
      return null;
    }
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname.includes(`/projects/${pid}/`)) return raw;
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return raw;
    return null;
  } catch {
    return null;
  }
}

export function buildImplementationPreviewViewerPageUrl(input: {
  readonly projectId: string;
  readonly previewUrl: string;
}): string | null {
  const pid = input.projectId.trim();
  const previewUrl = input.previewUrl.trim();
  if (!pid || !previewUrl) return null;
  const path = `/projects/${encodeURIComponent(pid)}/preview/viewer?target=${encodeURIComponent(previewUrl)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function openImplementationPreviewViewerWindow(input: {
  readonly projectId: string;
  readonly previewUrl: string;
}): boolean {
  if (typeof window === "undefined") return false;
  const pageUrl = buildImplementationPreviewViewerPageUrl(input);
  if (!pageUrl) return false;

  const width = Math.min(1680, Math.max(960, window.screen.availWidth - 48));
  const height = Math.min(1050, Math.max(640, window.screen.availHeight - 48));
  const left = Math.round((window.screen.availWidth - width) / 2);
  const top = Math.round((window.screen.availHeight - height) / 2);
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "noopener",
    "noreferrer",
  ].join(",");

  const win = window.open(pageUrl, `jyo-implementation-preview-${input.projectId.trim()}`, features);
  if (win) {
    win.opener = null;
    win.focus();
  }
  return Boolean(win);
}

export function resolvePreviewViewerIframeSrc(previewUrl: string): string {
  const trimmed = previewUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed;
}
