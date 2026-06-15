import type { ImplementationPreviewRegionCaptureV1 } from "@/lib/preview/previewCaptureTypes";
import { IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY } from "@/lib/preview/previewCaptureTypes";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

function readPreviewImageFromMessageMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const o = meta as Record<string, unknown>;
  const dataUrl =
    typeof o.previewRegionCaptureImageDataUrl === "string" ? o.previewRegionCaptureImageDataUrl.trim() : "";
  if (dataUrl.startsWith("data:image/")) return dataUrl;
  const imageUrl = typeof o.previewRegionCaptureImageUrl === "string" ? o.previewRegionCaptureImageUrl.trim() : "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }
  return null;
}

export function parseImplementationPreviewRegionCapturesFromState(
  state: unknown,
): readonly ImplementationPreviewRegionCaptureV1[] {
  if (!state || typeof state !== "object") return [];
  const raw = (state as Record<string, unknown>)[IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY];
  if (!Array.isArray(raw)) return [];
  const out: ImplementationPreviewRegionCaptureV1[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const projectId = String(o.projectId ?? "").trim();
    const previewUrl = String(o.previewUrl ?? "").trim();
    const captureId = String(o.captureId ?? "").trim();
    const stage = String(o.stage ?? "").trim();
    const source = String(o.source ?? "").trim();
    const createdAt = String(o.createdAt ?? "").trim();
    if (!id || !projectId || !previewUrl || !captureId || stage !== "implementation" || !createdAt) continue;
    const viewportRaw = o.viewport;
    if (!viewportRaw || typeof viewportRaw !== "object") continue;
    const v = viewportRaw as Record<string, unknown>;
    const width = Number(v.width);
    const height = Number(v.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) continue;
    const rectRaw = o.rect;
    if (!rectRaw || typeof rectRaw !== "object") continue;
    const r = rectRaw as Record<string, unknown>;
    const rx = Number(r.x);
    const ry = Number(r.y);
    const rw = Number(r.width);
    const rh = Number(r.height);
    if (![rx, ry, rw, rh].every((n) => Number.isFinite(n)) || rw < 1 || rh < 1) continue;
    const imageDataUrl = typeof o.imageDataUrl === "string" ? o.imageDataUrl.trim() : undefined;
    const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.trim() : undefined;
    out.push({
      id,
      projectId,
      stage: "implementation",
      previewUrl,
      source: source === "server_preview_capture" ? "server_preview_capture" : "server_preview_capture",
      captureId,
      ...(imageUrl ? { imageUrl } : {}),
      ...(imageDataUrl ? { imageDataUrl } : {}),
      viewport: {
        width: Math.round(width),
        height: Math.round(height),
        ...(Number.isFinite(Number(v.deviceScaleFactor)) && Number(v.deviceScaleFactor) > 0
          ? { deviceScaleFactor: Number(v.deviceScaleFactor) }
          : {}),
      },
      rect: { x: Math.round(rx), y: Math.round(ry), width: Math.round(rw), height: Math.round(rh) },
      createdAt,
    });
  }
  return out;
}

export function resolveWorkingQueueItemPreviewImageUrl(
  item: ImplementationWorkingQueueItem,
  input: Readonly<{
    readonly regionCaptures: readonly ImplementationPreviewRegionCaptureV1[];
    readonly messages: readonly RequirementsMessage[];
  }>,
): string | null {
  if (!item.regionCaptureId && !item.sourceCaptureId && !item.sourceMessageId) return null;

  if (item.sourceMessageId) {
    const msg = input.messages.find((m) => m.id === item.sourceMessageId);
    const fromMsg = msg ? readPreviewImageFromMessageMeta(msg.meta) : null;
    if (fromMsg) return fromMsg;
  }

  const regionId = item.regionCaptureId?.trim();
  if (regionId) {
    const capture = input.regionCaptures.find((c) => c.id === regionId);
    if (capture) {
      const fromCapture = String(capture.imageDataUrl ?? capture.imageUrl ?? "").trim();
      if (fromCapture) return fromCapture;
    }
    for (const m of input.messages) {
      const meta = m.meta as Record<string, unknown> | undefined;
      if (!meta || String(meta.regionCaptureId ?? "").trim() !== regionId) continue;
      const fromMsg = readPreviewImageFromMessageMeta(meta);
      if (fromMsg) return fromMsg;
    }
  }

  return null;
}
