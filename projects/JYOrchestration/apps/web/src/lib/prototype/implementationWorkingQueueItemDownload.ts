import { workingQueueStatusLabelKo } from "@/lib/prototype/implementationWorkingQueueClassifier";
import { workingQueueItemRequestText } from "@/lib/prototype/implementationWorkingQueuePanelDisplay";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

export type WorkingQueueItemDownloadPayload = Readonly<{
  readonly itemId: string;
  readonly status: string;
  readonly requestText: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly previewImageUrl?: string;
}>;

export function buildWorkingQueueItemDownloadPayload(
  item: ImplementationWorkingQueueItem,
  previewImageUrl?: string | null,
): WorkingQueueItemDownloadPayload {
  return {
    itemId: item.id,
    status: workingQueueStatusLabelKo(item.status),
    requestText: workingQueueItemRequestText(item),
    title: item.title,
    updatedAt: item.updatedAt,
    ...(previewImageUrl?.trim() ? { previewImageUrl: previewImageUrl.trim() } : {}),
  };
}

function safeFileSlug(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48) || "item";
}

function triggerDownload(filename: string, blob: Blob): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function blobFromImageUrl(imageUrl: string): Promise<Blob | null> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) {
    try {
      const res = await fetch(trimmed);
      return await res.blob();
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(trimmed);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export async function downloadWorkingQueueItemAssets(
  item: ImplementationWorkingQueueItem,
  previewImageUrl?: string | null,
): Promise<void> {
  const payload = buildWorkingQueueItemDownloadPayload(item, previewImageUrl);
  const slug = safeFileSlug(item.id);

  const summaryLines = [
    `상태: ${payload.status}`,
    `항목 ID: ${payload.itemId}`,
    `갱신: ${payload.updatedAt}`,
    "",
    "보완요청 내용:",
    payload.requestText,
  ];
  triggerDownload(
    `working-queue-${slug}.txt`,
    new Blob([summaryLines.join("\n")], { type: "text/plain;charset=utf-8" }),
  );

  triggerDownload(
    `working-queue-${slug}.json`,
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
  );

  if (payload.previewImageUrl) {
    const blob = await blobFromImageUrl(payload.previewImageUrl);
    if (blob) {
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "png";
      triggerDownload(`working-queue-${slug}-capture.${ext}`, blob);
    }
  }
}

export async function downloadWorkingQueueItemsBulk(
  rows: readonly Readonly<{
    readonly item: ImplementationWorkingQueueItem;
    readonly previewImageUrl?: string | null;
  }>[],
): Promise<void> {
  for (const row of rows) {
    await downloadWorkingQueueItemAssets(row.item, row.previewImageUrl);
    await new Promise((r) => window.setTimeout(r, 120));
  }
}
