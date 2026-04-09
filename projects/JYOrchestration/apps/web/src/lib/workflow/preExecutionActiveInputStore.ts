/**
 * Business-side pre-execution active input selection (NOT Stage1/Stage2):
 * - which prepared snapshot the Execution area treats as its active input
 *
 * In-memory only. No execution launch behavior.
 */

import { updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";

export type ActiveExecutionInputSelection = {
  sessionId: string;
  snapshotId: string;
  selectedAtIso: string;
};

let activeExecutionInput: ActiveExecutionInputSelection | null = null;

export function getActiveExecutionInput(): ActiveExecutionInputSelection | null {
  return activeExecutionInput;
}

export function setActiveExecutionInput(selection: { sessionId: string; snapshotId: string }): void {
  activeExecutionInput = {
    sessionId: selection.sessionId,
    snapshotId: selection.snapshotId,
    selectedAtIso: new Date().toISOString(),
  };
  // Global selection is outside per-session entry; bump a session entry to trigger subscribers.
  updateSessionEntry(selection.sessionId, (prev) => ({ ...(prev ?? {}) }));
}

export function isActiveExecutionSnapshot(sessionId: string | null | undefined, snapshotId: string | null | undefined): boolean {
  if (!sessionId || !snapshotId) return false;
  return Boolean(activeExecutionInput && activeExecutionInput.sessionId === sessionId && activeExecutionInput.snapshotId === snapshotId);
}

