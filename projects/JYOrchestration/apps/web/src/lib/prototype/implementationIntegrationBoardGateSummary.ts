import {
  resolveCodeTaskBoardState,
  summarizeCodeTaskBoardRowsFromTreeNodes,
  type ImplementationCodeTaskSelectionSummaryV1,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskRunIntegrationReady } from "@/lib/prototype/codeTaskIntegrationReadiness";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  formatExecutionUnitVerificationCardLabels,
  resolveExecutionUnitVerificationDisplayStatus,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";

export function resolveRunIntegrationReadyForBoardGate(input: {
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly githubOutcomeSaved: boolean;
  readonly commitSha: string | null;
  readonly noCodeChangeEvidence: boolean;
}): boolean | null {
  const runReady = input.run ? isCodeTaskRunIntegrationReady(input.run) : null;
  const hasPersistedCompletionEvidence =
    input.githubOutcomeSaved ||
    Boolean(String(input.commitSha ?? "").trim()) ||
    input.noCodeChangeEvidence;
  if (runReady === true) return true;
  if (runReady === false && !hasPersistedCompletionEvidence) return false;
  return null;
}

export type IntegrationGateBlockedDetailV1 = Readonly<{
  readonly codeTaskId: string;
  readonly status: string;
  readonly progress: string;
  readonly githubOutcomeSaved: boolean;
  readonly commitSha: string | null;
}>;

/** Board summary와 동일한 BoardState 기준으로 plan 전체 CodeTask를 집계한다. */
export function summarizeCodeTaskBoardGateFromPlanAndUnits(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): ImplementationCodeTaskSelectionSummaryV1 &
  Readonly<{
    readonly runnableCodeTaskIds: readonly string[];
    readonly blockedDetails: readonly IntegrationGateBlockedDetailV1[];
  }> {
  const tasks = input.codeTaskPlan?.tasks ?? [];
  const unitByCodeTaskId = new Map(
    input.units.map((unit) => [unit.codeTaskId.trim(), unit] as const),
  );
  const nodes = tasks.map((task) => {
    const codeTaskId = task.codeTaskId.trim();
    const unit = unitByCodeTaskId.get(codeTaskId) ?? null;
    const run = findLatestRunForCodeTask(input.runs, codeTaskId);
    let statusLabel = "대기";
    let progressLabel = "";
    let githubOutcomeSaved = false;
    let commitSha: string | null = null;
    let noCodeChangeEvidence = false;

    if (unit) {
      const outcome = resolveAuthoritativeCodeTaskOutcome({ unit, runs: input.runs });
      const unitCommitSha = String(unit.commitSha ?? "").trim() || null;
      githubOutcomeSaved =
        outcome.hasPersistedGithubOutcome === true ||
        outcome.status === "skipped" ||
        outcome.status === "verified" ||
        (unit.status === "verified" && Boolean(unitCommitSha));
      commitSha = outcome.commitSha ?? unitCommitSha;
      noCodeChangeEvidence = outcome.latestOutcomeStatus === "no_code_change";

      if (
        unit.status === "verified" &&
        (githubOutcomeSaved || unitCommitSha) &&
        (outcome.status === "verified" || outcome.status === "inconsistent")
      ) {
        statusLabel = "완료";
        progressLabel = "GitHub outcome 저장됨";
      } else {
        const display = resolveExecutionUnitVerificationDisplayStatus({ unit, run });
        const card = formatExecutionUnitVerificationCardLabels(display);
        statusLabel = card.statusLabel;
        progressLabel = card.progressLabel;
      }
    }

    const boardState = resolveCodeTaskBoardState({
      codeTaskId,
      title: task.title,
      statusLabel,
      progressLabel,
      githubOutcomeSaved,
      commitSha,
      branchName: unit?.workBranch ?? task.branchPlan?.workBranch ?? null,
      noCodeChangeEvidence,
      runIntegrationReady: resolveRunIntegrationReadyForBoardGate({
        run,
        githubOutcomeSaved,
        commitSha,
        noCodeChangeEvidence,
      }),
    });

    return { codeTaskId, boardState };
  });

  const summary = summarizeCodeTaskBoardRowsFromTreeNodes({
    nodes,
    checkedCodeTaskIds: [],
  });

  const runnableCodeTaskIds = nodes
    .filter((n) => n.boardState.isRunnableForUser)
    .map((n) => n.codeTaskId.trim())
    .filter(Boolean);

  const blockedDetails: IntegrationGateBlockedDetailV1[] = nodes
    .filter((n) => !n.boardState.isIntegrationReady)
    .map((n) => {
      const run = findLatestRunForCodeTask(input.runs, n.codeTaskId);
      const unit = unitByCodeTaskId.get(n.codeTaskId.trim()) ?? null;
      const outcome = unit
        ? resolveAuthoritativeCodeTaskOutcome({ unit, runs: input.runs })
        : null;
      return {
        codeTaskId: n.codeTaskId,
        status: n.boardState.statusLabel,
        progress: n.boardState.progressLabel,
        githubOutcomeSaved: outcome?.hasPersistedGithubOutcome === true,
        commitSha: outcome?.commitSha ?? run?.commitSha?.trim() ?? null,
      };
    });

  return { ...summary, runnableCodeTaskIds, blockedDetails };
}
