/**
 * Derived lifecycle / validity for BusinessExecutionRequest (NOT Stage1/Stage2).
 * Does not mutate stored requests; recompute on read.
 */

import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export type ExecutionRequestLifecycleStatus = "requested" | "stale" | "invalid";

export type ExecutionRequestValidityResult = {
  status: ExecutionRequestLifecycleStatus;
  staleReason?: string;
  invalidReason?: string;
};

function sortIds(ids: string[]): string[] {
  return [...ids].filter(Boolean).sort();
}

function sameIdSet(a: string[], b: string[]): boolean {
  const aa = sortIds(a);
  const bb = sortIds(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

export function evaluateExecutionRequestValidity(input: {
  request: BusinessExecutionRequest | undefined;
  snapshot: ExecutionLaunchSnapshot | undefined;
  currentCandidateTaskIds: string[];
  currentConfirmedTaskIds: string[];
}): ExecutionRequestValidityResult | null {
  if (!input.request) return null;

  if (!input.snapshot) {
    return { status: "invalid", invalidReason: "No prepared snapshot." };
  }

  if (input.request.snapshotId !== input.snapshot.snapshotId) {
    return { status: "stale", staleReason: "Prepared snapshot changed since this request." };
  }

  const candidatesOk = sameIdSet(input.request.candidateTaskIds, input.currentCandidateTaskIds);
  const storedConfirmed = "confirmedTaskIds" in input.request ? (input.request.confirmedTaskIds ?? []) : [];
  const confirmedOk = sameIdSet(storedConfirmed, input.currentConfirmedTaskIds);

  if (!candidatesOk) {
    return { status: "stale", staleReason: "Execution candidates changed since this request." };
  }
  if (!confirmedOk) {
    return { status: "stale", staleReason: "Confirmed task set changed since this request." };
  }

  return { status: "requested" };
}

/** Alias: validity is always derived; name matches store-style resolvers. */
export function resolveExecutionRequestValidity(input: Parameters<typeof evaluateExecutionRequestValidity>[0]): ExecutionRequestValidityResult | null {
  return evaluateExecutionRequestValidity(input);
}
