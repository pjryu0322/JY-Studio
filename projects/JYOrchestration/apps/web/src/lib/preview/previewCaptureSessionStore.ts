const TTL_MS = 30 * 60 * 1000;

type StoredCapture = Readonly<{
  readonly projectId: string;
  readonly previewUrl: string;
  readonly imageDataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly createdAt: number;
}>;

const store = new Map<string, StoredCapture>();

function pruneExpired(now = Date.now()): void {
  for (const [id, row] of store.entries()) {
    if (now - row.createdAt > TTL_MS) store.delete(id);
  }
}

export function putPreviewCaptureSession(input: {
  readonly captureId: string;
  readonly projectId: string;
  readonly previewUrl: string;
  readonly imageDataUrl: string;
  readonly width: number;
  readonly height: number;
}): void {
  pruneExpired();
  store.set(input.captureId, {
    projectId: input.projectId,
    previewUrl: input.previewUrl,
    imageDataUrl: input.imageDataUrl,
    width: input.width,
    height: input.height,
    createdAt: Date.now(),
  });
}

export function getPreviewCaptureSession(captureId: string): StoredCapture | null {
  pruneExpired();
  const row = store.get(captureId.trim());
  if (!row) return null;
  if (Date.now() - row.createdAt > TTL_MS) {
    store.delete(captureId.trim());
    return null;
  }
  return row;
}

export function clearPreviewCaptureStoreForTests(): void {
  store.clear();
}
