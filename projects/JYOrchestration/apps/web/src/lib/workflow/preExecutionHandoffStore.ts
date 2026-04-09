/**
 * Business-side pre-execution handoff artifacts (NOT Stage1/Stage2):
 * - handoff prepared marker
 * - execution request draft
 * - final approval checkpoint
 *
 * In-memory only. No execution launch behavior.
 */

import type { ExecutionRequestApproval } from "@/lib/workflow/executionRequestApproval";
import type { ExecutionRequestDraft } from "@/lib/workflow/executionRequestDraft";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";
import type { ActiveExecutionInputSelection } from "@/lib/workflow/preExecutionActiveInputStore";

export type HandoffPreparedState = {
  sessionId: string;
  snapshotId: string;
  preparedAtIso: string;
  status: "prepared";
};

type PreExecutionHandoffEntry = {
  handoffPrepared?: HandoffPreparedState;
  executionRequestDraft?: ExecutionRequestDraft;
  executionRequestApproval?: ExecutionRequestApproval;
  updatedAtIso?: string;
};

export function recordSessionHandoffPrepared(sessionId: string, state: HandoffPreparedState): void {
  const at = new Date().toISOString();
  updateSessionEntry<PreExecutionHandoffEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    handoffPrepared: state,
    updatedAtIso: at,
  }));
}

export function resolveSessionHandoffPrepared(sessionId: string | null | undefined): HandoffPreparedState | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<PreExecutionHandoffEntry>(sessionId)?.handoffPrepared;
}

export function isHandoffPreparedForActive(active: ActiveExecutionInputSelection | null, prepared: HandoffPreparedState | undefined): boolean {
  if (!active || !prepared) return false;
  return active.sessionId === prepared.sessionId && active.snapshotId === prepared.snapshotId && prepared.status === "prepared";
}

export function recordSessionExecutionRequestDraft(sessionId: string, draft: ExecutionRequestDraft): void {
  const at = new Date().toISOString();
  updateSessionEntry<PreExecutionHandoffEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    executionRequestDraft: draft,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionRequestDraft(sessionId: string | null | undefined): ExecutionRequestDraft | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<PreExecutionHandoffEntry>(sessionId)?.executionRequestDraft;
}

export function sessionHasExecutionRequestDraft(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<PreExecutionHandoffEntry>(sessionId)?.executionRequestDraft !== undefined;
}

export function recordSessionExecutionRequestApproval(sessionId: string, approval: ExecutionRequestApproval): void {
  const at = new Date().toISOString();
  updateSessionEntry<PreExecutionHandoffEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    executionRequestApproval: approval,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionRequestApproval(sessionId: string | null | undefined): ExecutionRequestApproval | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<PreExecutionHandoffEntry>(sessionId)?.executionRequestApproval;
}

export function isExecutionDraftApproved(draft: ExecutionRequestDraft | undefined, approval: ExecutionRequestApproval | undefined): boolean {
  if (!draft || !approval) return false;
  return approval.status === "approved" && approval.requestId === draft.requestId && approval.sessionId === draft.sessionId;
}

