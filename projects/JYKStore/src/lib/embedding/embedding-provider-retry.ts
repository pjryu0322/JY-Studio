import { EmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";

export function computeBackoffMs(attempt: number, retryAfterMs?: number): number {
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(retryAfterMs, 30_000);
  }
  const base = Math.min(500 * 2 ** (attempt - 1), 8_000);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
}

export function defaultEmbeddingDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new EmbeddingProviderError("EMBEDDING_REQUEST_CANCELLED", "embedding: request was cancelled."),
      );
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(
        new EmbeddingProviderError("EMBEDDING_REQUEST_CANCELLED", "embedding: request was cancelled."),
      );
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
