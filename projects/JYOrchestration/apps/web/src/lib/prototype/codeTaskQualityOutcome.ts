import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { findLatestRunForCodeTask, updateCodeTaskExecutionRun } from "@/lib/prototype/codeTaskExecutionRun";

export type CodeTaskQualityOutcomeV1 =
  | Readonly<{ readonly status: "not_run" }>
  | Readonly<{
      readonly status: "passed";
      readonly checkedAt: string;
      readonly summary?: string | null;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly checkedAt: string;
      readonly reason: string;
      readonly retryable: boolean;
      readonly summary?: string | null;
    }>;

export function parseCodeTaskQualityOutcomeV1(raw: unknown): CodeTaskQualityOutcomeV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = String(o.status ?? "").trim();
  if (status === "not_run") return { status: "not_run" };
  if (status === "passed") {
    const checkedAt = String(o.checkedAt ?? "").trim();
    if (!checkedAt) return null;
    return {
      status: "passed",
      checkedAt,
      ...(o.summary ? { summary: String(o.summary).trim() } : {}),
    };
  }
  if (status === "failed") {
    const checkedAt = String(o.checkedAt ?? "").trim();
    const reason = String(o.reason ?? "").trim();
    if (!checkedAt || !reason) return null;
    return {
      status: "failed",
      checkedAt,
      reason,
      retryable: o.retryable === true,
      ...(o.summary ? { summary: String(o.summary).trim() } : {}),
    };
  }
  return null;
}

export function normalizeCodeTaskQualityOutcomeFromRun(
  run: Pick<CodeTaskExecutionRunV1, "qualityOutcome">,
): CodeTaskQualityOutcomeV1 | undefined {
  const parsed = run.qualityOutcome ? parseCodeTaskQualityOutcomeV1(run.qualityOutcome) : null;
  return parsed ?? undefined;
}

export function buildQualityOutcomeFromAutoGate(
  autoGate: ImplementationAutoQualityGateV1,
): CodeTaskQualityOutcomeV1 | null {
  if (autoGate.status === "passed") {
    return {
      status: "passed",
      checkedAt: autoGate.completedAt ?? autoGate.updatedAt,
      summary: autoGate.failureReason ?? null,
    };
  }
  if (autoGate.status === "failed") {
    return {
      status: "failed",
      checkedAt: autoGate.completedAt ?? autoGate.updatedAt,
      reason: autoGate.failureReason ?? "quality_gate_failed",
      retryable: true,
      summary: autoGate.failureReason ?? null,
    };
  }
  return null;
}

export function patchRunWithQualityOutcome(input: {
  readonly run: CodeTaskExecutionRunV1;
  readonly qualityOutcome: CodeTaskQualityOutcomeV1;
  readonly nowIso: string;
}): Partial<CodeTaskExecutionRunV1> {
  const patch: Partial<CodeTaskExecutionRunV1> = {
    qualityOutcome: input.qualityOutcome,
    updatedAt: input.nowIso,
  };
  if (input.qualityOutcome.status === "passed") {
    if (
      input.run.status !== "completed" &&
      input.run.status !== "no_code_change_completed"
    ) {
      patch.status = "completed";
      patch.completedAt = input.nowIso;
    }
  }
  return patch;
}

export function applyAutoGateOutcomeToRunsList(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly codeTaskId: string;
  readonly autoGate: ImplementationAutoQualityGateV1;
  readonly nowIso?: string;
}): CodeTaskExecutionRunV1[] {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const latest = findLatestRunForCodeTask(input.runs, input.codeTaskId);
  if (!latest) return [...input.runs];
  const outcome = buildQualityOutcomeFromAutoGate(input.autoGate);
  if (!outcome) return [...input.runs];
  const patch = patchRunWithQualityOutcome({ run: latest, qualityOutcome: outcome, nowIso });
  return updateCodeTaskExecutionRun(input.runs as CodeTaskExecutionRunV1[], latest.runId, patch);
}
