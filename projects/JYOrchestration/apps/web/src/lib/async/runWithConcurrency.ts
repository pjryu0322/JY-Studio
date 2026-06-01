/**
 * Run async work over items with a fixed concurrency limit.
 * Result order matches input order.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  let nextIndex = 0;

  async function runSlot(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runSlot()));
  return results;
}
