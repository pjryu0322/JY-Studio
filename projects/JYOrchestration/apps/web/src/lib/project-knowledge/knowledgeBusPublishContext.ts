import { AsyncLocalStorage } from "node:async_hooks";

const suppressStore = new AsyncLocalStorage<boolean>();

export function isKnowledgeBusPublishSuppressed(): boolean {
  return suppressStore.getStore() === true;
}

export async function runWithKnowledgeBusPublishSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  return suppressStore.run(true, fn);
}
