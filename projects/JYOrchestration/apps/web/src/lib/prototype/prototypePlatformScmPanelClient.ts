import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { PlatformScmExecutionV1 } from "@/lib/prototype/platformScmExecution";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  buildPlatformScmExecutionPersistPatch,
  buildPlatformScmMergePersistPatch,
} from "@/lib/prototype/prototypeExecutionPlatformScmActions";
import type { PlatformScmMergeExecutorResult } from "@/lib/prototype/platformScmMergeExecutor";
import type { PlatformScmPushExecutorResult } from "@/lib/prototype/platformScmPushExecutor";

export {
  shouldAttemptAutoPlatformScmMerge,
  validatePlatformScmMergeStepReadiness,
} from "@/lib/prototype/platformScmReadiness";

export type PlatformScmExecutePersistPatch = ReturnType<typeof buildPlatformScmExecutionPersistPatch>;
export type PlatformScmMergePersistPatch = ReturnType<typeof buildPlatformScmMergePersistPatch>;

export type PlatformScmOrchestrationApplyInput = Readonly<{
  readonly persistPatch: PlatformScmExecutePersistPatch | PlatformScmMergePersistPatch;
  readonly fallbackMessages: readonly unknown[];
}>;

export async function fetchPlatformScmExecutePersistPatch(input: {
  readonly projectId: string;
  readonly wip: CodeAgentWipExecutionV1;
  readonly requirementsStateJson: unknown;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1 | null;
  readonly taskRowsCompleted?: boolean;
  readonly finalizeIntegratedFinalScm?: boolean;
}): Promise<PlatformScmExecutePersistPatch> {
  const res = await fetch("/api/prototype/platform-scm/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      codeAgentWipExecutionV1: input.wip,
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    status?: PlatformScmPushExecutorResult["status"];
    message?: string;
    platformScmExecutionV1?: PlatformScmExecutionV1;
    prNumber?: number;
    prUrl?: string;
  };

  return buildPlatformScmExecutionPersistPatch({
    requirementsStateJson: input.requirementsStateJson,
    wip: input.wip,
    executorResult: {
      ok: json.success === true,
      status: json.status ?? (json.success ? "completed" : "failed"),
      message: json.message ?? "플랫폼 SCM 실행 결과",
      platformScmExecutionV1: json.platformScmExecutionV1,
      prNumber: json.prNumber,
      prUrl: json.prUrl,
    },
    promptTimeline: input.promptTimeline ?? [],
    executionState: input.executionState,
    integratedExecutionState: input.integratedExecutionState,
    projectId: input.projectId,
    taskRowsCompleted: input.taskRowsCompleted,
    finalizeIntegratedFinalScm: input.finalizeIntegratedFinalScm,
  });
}

export async function fetchPlatformScmMergePersistPatch(input: {
  readonly projectId: string;
  readonly wip: CodeAgentWipExecutionV1;
  readonly requirementsStateJson: unknown;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly qualityGateResults?: unknown;
  readonly autoMergeOnly?: boolean;
}): Promise<PlatformScmMergePersistPatch> {
  const res = await fetch("/api/prototype/platform-scm/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      autoMergeOnly: input.autoMergeOnly === true,
      codeAgentWipExecutionV1: input.wip,
      implementationQualityGateResultsV1: input.qualityGateResults,
      implementationTaskExecutionStateV1: input.executionState,
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    status?: PlatformScmMergeExecutorResult["status"];
    message?: string;
    platformScmExecutionV1?: PlatformScmExecutionV1;
    merged?: boolean;
  };

  return buildPlatformScmMergePersistPatch({
    requirementsStateJson: input.requirementsStateJson,
    wip: input.wip,
    executorResult: {
      ok: json.success === true,
      status: json.status ?? (json.success ? "completed" : "failed"),
      message: json.message ?? "플랫폼 SCM merge 결과",
      platformScmExecutionV1: json.platformScmExecutionV1,
      merged: json.merged,
    },
    promptTimeline: input.promptTimeline ?? [],
    executionState: input.executionState,
  });
}

export function buildPlatformScmOrchestrationPatchFromPersist(
  persistPatch: PlatformScmExecutePersistPatch | PlatformScmMergePersistPatch,
): Readonly<{
  readonly orchestrationPatch: NonNullable<
    PlatformScmExecutePersistPatch["orchestration"]["orchestrationPatch"]
  >;
  readonly executionState?: ImplementationTaskExecutionStateV1;
  readonly integratedExecutionState?: ImplementationIntegratedExecutionStateV1;
}> | null {
  const orchestrationPatch = persistPatch.orchestration.orchestrationPatch;
  if (!orchestrationPatch) return null;
  return {
    orchestrationPatch,
    ...("executionState" in persistPatch && persistPatch.executionState
      ? { executionState: persistPatch.executionState }
      : {}),
    ...("integratedExecutionState" in persistPatch && persistPatch.integratedExecutionState
      ? { integratedExecutionState: persistPatch.integratedExecutionState }
      : {}),
  };
}
