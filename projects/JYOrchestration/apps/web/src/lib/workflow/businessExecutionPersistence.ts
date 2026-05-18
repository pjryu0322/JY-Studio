/**
 * Lightweight persistence adapter for core Business Execution entities.
 *
 * Storage: browser localStorage (client-only). This is intentionally minimal and reversible.
 * We persist ONLY a narrow subset of core entities (latest-only per session):
 * - BusinessExecutionRequest
 * - BusinessExecutionApproval
 * - BusinessExecutionPackage
 * - ExecutionAssignment
 * - BusinessExecutionRun
 *
 * We do NOT persist:
 * - derived state (readiness/current/stale/next-action)
 * - executor-facing artifacts (handoff/intake/work order/bridge/launch contract/etc)
 * - Stage1/Stage2 test flow state
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import { updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";

const STORAGE_PREFIX = "jy_orch.bizexec.core.v1.session.";

type PersistedBusinessExecutionCore = {
  schemaVersion: 1;
  sessionId: string;
  savedAtIso: string;
  latestBusinessExecutionRequest?: BusinessExecutionRequest;
  latestBusinessExecutionApproval?: BusinessExecutionApproval;
  latestBusinessExecutionPackage?: BusinessExecutionPackage;
  latestExecutionAssignment?: ExecutionAssignment;
  latestBusinessExecutionRun?: BusinessExecutionRun;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function keyForSession(sessionId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(sessionId)}`;
}

export function saveBusinessExecutionCoreEntities(input: {
  sessionId: string;
  core: Omit<PersistedBusinessExecutionCore, "schemaVersion" | "sessionId" | "savedAtIso">;
}): void {
  if (!isBrowser()) return;
  const record: PersistedBusinessExecutionCore = {
    schemaVersion: 1,
    sessionId: input.sessionId,
    savedAtIso: new Date().toISOString(),
    ...input.core,
  };
  try {
    window.localStorage.setItem(keyForSession(input.sessionId), JSON.stringify(record));
    // Minimal debugging log (no heavy logging).
    console.info("[bizexec] persisted core entities", {
      sessionId: input.sessionId,
      savedAtIso: record.savedAtIso,
      hasRequest: Boolean(record.latestBusinessExecutionRequest),
      hasApproval: Boolean(record.latestBusinessExecutionApproval),
      hasPackage: Boolean(record.latestBusinessExecutionPackage),
      hasAssignment: Boolean(record.latestExecutionAssignment),
      hasRun: Boolean(record.latestBusinessExecutionRun),
    });
  } catch (e) {
    console.info("[bizexec] persistence save skipped (storage error)", e);
  }
}

export function loadBusinessExecutionCoreEntities(sessionId: string): PersistedBusinessExecutionCore | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(keyForSession(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedBusinessExecutionCore;
    if (!parsed || parsed.schemaVersion !== 1 || parsed.sessionId !== sessionId) return null;
    console.info("[bizexec] loaded persisted core entities", {
      sessionId,
      savedAtIso: parsed.savedAtIso,
    });
    return parsed;
  } catch (e) {
    console.info("[bizexec] persistence load skipped (parse/storage error)", e);
    return null;
  }
}

export function listPersistedBusinessExecutionSessions(): string[] {
  if (!isBrowser()) return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(STORAGE_PREFIX)) continue;
      const encoded = k.slice(STORAGE_PREFIX.length);
      try {
        out.push(decodeURIComponent(encoded));
      } catch {
        // ignore decoding errors
      }
    }
  } catch {
    return [];
  }
  return out;
}

/**
 * Load-on-init behavior (client-only).
 * Hydrates the in-memory session store for any persisted sessions.
 */
export function hydrateBusinessExecutionCoreFromPersistence(): void {
  if (!isBrowser()) return;
  const sessions = listPersistedBusinessExecutionSessions();
  if (sessions.length === 0) return;
  for (const sessionId of sessions) {
    const persisted = loadBusinessExecutionCoreEntities(sessionId);
    if (!persisted) continue;
    updateSessionEntry<Record<string, unknown>>(sessionId, (prev) => ({
      ...(prev ?? {}),
      latestBusinessExecutionRequest: persisted.latestBusinessExecutionRequest,
      latestBusinessExecutionApproval: persisted.latestBusinessExecutionApproval,
      latestBusinessExecutionPackage: persisted.latestBusinessExecutionPackage,
      latestExecutionAssignment: persisted.latestExecutionAssignment,
      latestBusinessExecutionRun: persisted.latestBusinessExecutionRun,
      // Keep a best-effort updatedAtIso; do not introduce derived state.
      updatedAtIso: persisted.savedAtIso,
    }));
  }
}

