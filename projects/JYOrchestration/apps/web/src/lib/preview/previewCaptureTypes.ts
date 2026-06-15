export type PreviewCaptureViewport = Readonly<{
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor?: number;
}>;

export type PreviewCaptureRequest = Readonly<{
  readonly projectId: string;
  readonly previewUrl: string;
  readonly viewport?: PreviewCaptureViewport;
  readonly fullPage?: boolean;
  readonly platformOrigin?: string;
}>;

export type PreviewCaptureResponse = Readonly<{
  readonly ok: boolean;
  readonly captureId?: string;
  readonly imageDataUrl?: string;
  readonly width?: number;
  readonly height?: number;
  readonly previewUrl?: string;
  readonly errorMessage?: string;
  readonly errorCode?: "security" | "validation" | "capture_failed" | "timeout";
}>;

export type PreviewCaptureRegionRect = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>;

export type PreviewCaptureRegionAnnotationMeta = Readonly<{
  readonly hasAnnotations?: boolean;
  readonly annotationToolSummary?: readonly string[];
}>;

export type PreviewCaptureRegionRequest = Readonly<{
  readonly projectId: string;
  readonly captureId: string;
  readonly previewUrl: string;
  readonly imageDataUrl: string;
  readonly rect: PreviewCaptureRegionRect;
  readonly viewport: PreviewCaptureViewport;
  readonly memo?: string;
  readonly meta?: PreviewCaptureRegionAnnotationMeta;
  readonly stage: "implementation";
}>;

export type PreviewCaptureRegionResponse = Readonly<{
  readonly ok: boolean;
  readonly regionCaptureId?: string;
  readonly imageUrl?: string;
  readonly messageId?: string;
  readonly errorMessage?: string;
}>;

export type ImplementationPreviewRegionCaptureV1 = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly stage: "implementation";
  readonly previewUrl: string;
  readonly source: "server_preview_capture";
  readonly captureId: string;
  readonly imageUrl?: string;
  readonly imageDataUrl?: string;
  readonly memo?: string;
  readonly meta?: PreviewCaptureRegionAnnotationMeta;
  readonly viewport: PreviewCaptureViewport;
  readonly rect: PreviewCaptureRegionRect;
  readonly createdAt: string;
}>;

export const IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY = "implementationPreviewRegionCapturesV1" as const;

export const DEFAULT_PREVIEW_CAPTURE_VIEWPORT: PreviewCaptureViewport = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
};

export const PREVIEW_CAPTURE_GOTO_TIMEOUT_MS = 15_000;

export const PREVIEW_REGION_CAPTURE_MAX_DATA_URL_CHARS = 6_000_000;

export function parsePreviewCaptureRequest(raw: unknown): PreviewCaptureRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const projectId = String(o.projectId ?? "").trim();
  const previewUrl = String(o.previewUrl ?? "").trim();
  if (!projectId || !previewUrl) return null;
  const viewportRaw = o.viewport;
  let viewport: PreviewCaptureViewport | undefined;
  if (viewportRaw && typeof viewportRaw === "object") {
    const v = viewportRaw as Record<string, unknown>;
    const width = Number(v.width);
    const height = Number(v.height);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      const dsf = Number(v.deviceScaleFactor);
      viewport = {
        width: Math.round(width),
        height: Math.round(height),
        ...(Number.isFinite(dsf) && dsf > 0 ? { deviceScaleFactor: dsf } : {}),
      };
    }
  }
  const platformOrigin = typeof o.platformOrigin === "string" ? o.platformOrigin.trim() : undefined;
  return {
    projectId,
    previewUrl,
    ...(viewport ? { viewport } : {}),
    ...(o.fullPage === true ? { fullPage: true } : {}),
    ...(platformOrigin ? { platformOrigin } : {}),
  };
}

export function parsePreviewCaptureRegionRequest(raw: unknown): PreviewCaptureRegionRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const projectId = String(o.projectId ?? "").trim();
  const captureId = String(o.captureId ?? "").trim();
  const previewUrl = String(o.previewUrl ?? "").trim();
  const imageDataUrl = String(o.imageDataUrl ?? "").trim();
  const stage = String(o.stage ?? "").trim();
  if (!projectId || !captureId || !previewUrl || !imageDataUrl || stage !== "implementation") return null;
  if (imageDataUrl.length > PREVIEW_REGION_CAPTURE_MAX_DATA_URL_CHARS) return null;
  if (!imageDataUrl.startsWith("data:image/png;base64,")) return null;
  const rectRaw = o.rect;
  if (!rectRaw || typeof rectRaw !== "object") return null;
  const r = rectRaw as Record<string, unknown>;
  const rect = normalizeRect(r);
  if (!rect) return null;
  const viewportRaw = o.viewport;
  if (!viewportRaw || typeof viewportRaw !== "object") return null;
  const v = viewportRaw as Record<string, unknown>;
  const width = Number(v.width);
  const height = Number(v.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const dsf = Number(v.deviceScaleFactor);
  const memo = typeof o.memo === "string" ? o.memo.trim().slice(0, 4000) : undefined;
  const meta = parsePreviewCaptureRegionAnnotationMeta(o.meta);
  return {
    projectId,
    captureId,
    previewUrl,
    imageDataUrl,
    rect,
    viewport: {
      width: Math.round(width),
      height: Math.round(height),
      ...(Number.isFinite(dsf) && dsf > 0 ? { deviceScaleFactor: dsf } : {}),
    },
    ...(memo ? { memo } : {}),
    ...(meta ? { meta } : {}),
    stage: "implementation",
  };
}

function parsePreviewCaptureRegionAnnotationMeta(raw: unknown): PreviewCaptureRegionAnnotationMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const hasAnnotations = o.hasAnnotations === true ? true : o.hasAnnotations === false ? false : undefined;
  const summaryRaw = o.annotationToolSummary;
  const annotationToolSummary = Array.isArray(summaryRaw)
    ? summaryRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, 8)
    : undefined;
  if (hasAnnotations === undefined && !annotationToolSummary?.length) return undefined;
  return {
    ...(hasAnnotations !== undefined ? { hasAnnotations } : {}),
    ...(annotationToolSummary?.length ? { annotationToolSummary } : {}),
  };
}

function normalizeRect(r: Record<string, unknown>): PreviewCaptureRegionRect | null {
  const x = Number(r.x);
  const y = Number(r.y);
  const width = Number(r.width);
  const height = Number(r.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (width < 1 || height < 1) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}
