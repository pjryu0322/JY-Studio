/**
 * Orchestration transaction boundary — commit/rollback traces on dispatch patch.
 */

import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";

export type OrchestrationTransactionStatus = "committed" | "rolled_back";

export type OrchestrationTransactionTrace = Readonly<{
  readonly transactionId: string;
  readonly status: OrchestrationTransactionStatus;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly steps: readonly string[];
  readonly rollbackReason?: string;
}>;

function newTransactionId(nowMs: number): string {
  return `tx-${nowMs.toString(36)}`;
}

export function startOrchestrationTransaction(nowIso?: string): OrchestrationTransactionTrace {
  const at = nowIso ?? new Date().toISOString();
  return {
    transactionId: newTransactionId(Date.parse(at)),
    status: "committed",
    startedAt: at,
    endedAt: at,
    steps: ["intent", "guard", "transaction:start"],
  };
}

export function appendTransactionStep(
  trace: OrchestrationTransactionTrace,
  step: string,
): OrchestrationTransactionTrace {
  return { ...trace, steps: [...trace.steps, step] };
}

export function commitOrchestrationTransaction(
  trace: OrchestrationTransactionTrace,
  nowIso?: string,
): OrchestrationTransactionTrace {
  const endedAt = nowIso ?? new Date().toISOString();
  return {
    ...trace,
    status: "committed",
    endedAt,
    steps: [...trace.steps, "runtime:patch", "projection", "persist", "transaction:commit"],
  };
}

export function rollbackOrchestrationTransaction(input: {
  readonly trace: OrchestrationTransactionTrace;
  readonly reason: string;
  readonly before: RequirementsIntentOrchestrationV1 | null | undefined;
  readonly nowIso?: string;
}): Readonly<{
  readonly trace: OrchestrationTransactionTrace;
  readonly orch: RequirementsIntentOrchestrationV1 | null | undefined;
}> {
  const endedAt = input.nowIso ?? new Date().toISOString();
  return {
    trace: {
      ...input.trace,
      status: "rolled_back",
      endedAt,
      rollbackReason: input.reason.slice(0, 240),
      steps: [...input.trace.steps, "transaction:rollback"],
    },
    orch: input.before ?? undefined,
  };
}

export function runOrchestrationTransactionPatch(input: {
  readonly before: RequirementsIntentOrchestrationV1 | null | undefined;
  readonly apply: () => RequirementsIntentOrchestrationV1;
  readonly nowIso?: string;
}): Readonly<{
  readonly orch: RequirementsIntentOrchestrationV1;
  readonly trace: OrchestrationTransactionTrace;
  readonly rolledBack: boolean;
}> {
  let trace = startOrchestrationTransaction(input.nowIso);
  trace = appendTransactionStep(trace, "runtime:patch");
  try {
    const orch = input.apply();
    trace = commitOrchestrationTransaction(trace, input.nowIso);
    return { orch, trace, rolledBack: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const rolled = rollbackOrchestrationTransaction({
      trace,
      reason,
      before: input.before,
      nowIso: input.nowIso,
    });
    return {
      orch: rolled.orch ?? input.before ?? { version: 1, updatedAt: input.nowIso ?? new Date().toISOString() },
      trace: rolled.trace,
      rolledBack: true,
    };
  }
}
