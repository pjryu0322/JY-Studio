/**
 * Shared in-memory store core for session-scoped outputs.
 * Split from higher-level domain concerns (content overrides vs pre-execution state).
 */

type AnyEntry = Record<string, unknown>;

const bySessionId = new Map<string, AnyEntry>();

let version = 0;
const listeners = new Set<() => void>();

function bumpVersion() {
  version += 1;
  for (const l of listeners) l();
}

export function subscribeSessionResults(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSessionResultsVersion(): number {
  return version;
}

export function getSessionEntry<T extends AnyEntry = AnyEntry>(sessionId: string): T | undefined {
  return bySessionId.get(sessionId) as T | undefined;
}

export function setSessionEntry<T extends AnyEntry>(
  sessionId: string,
  next: T
): void {
  bySessionId.set(sessionId, next);
  bumpVersion();
}

export function updateSessionEntry<T extends AnyEntry>(
  sessionId: string,
  updater: (prev: T | undefined) => T
): void {
  const prev = bySessionId.get(sessionId) as T | undefined;
  bySessionId.set(sessionId, updater(prev));
  bumpVersion();
}

