import type { QuickRunGithubAdvanceResult } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import type { ExecutionSetupSourceGenerationContext } from "@/lib/prototype/executionSetupSourceGeneration";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildQuickRunContinuationNoopTimelineEntry,
  buildQuickRunContinuationPatchPersistedTimelineEntry,
} from "@/lib/prototype/quickRunVerifiedContinuationTimeline";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import {
  mergeRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
  type ServerQuickRunContinuationResult,
} from "@/lib/prototype/serverQuickRunContinuationService";
import { shouldMarkQuickRunHasNextDispatch } from "@/lib/prototype/implementationQuickRunQueue";
import { scheduleNextExecutionUnitAfterVerified } from "@/lib/prototype/implementationExecutionSchedulerDispatch";

export type ApplyQuickRunContinuationAfterGithubVerifyResult = Readonly<{
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly continuationDispatchedOnServer: boolean;
  readonly fallbackResult?: ServerQuickRunContinuationResult;
}>;

export async function applyQuickRunContinuationAfterGithubVerify(input: {
  readonly projectId: string;
  readonly verify: TaskCursorGithubVerifyResult;
  readonly advance: QuickRunGithubAdvanceResult;
  readonly requirementsSlice: RequirementsStateJson;
  readonly execution: TaskCursorExecutionV1;
  readonly cursorApiToken: string;
  readonly execReadinessOk: boolean;
  readonly execContext: ExecutionSetupSourceGenerationContext;
  readonly previousCodeTaskId?: string | null;
  readonly previousCommitSha?: string | null;
  readonly nowIso?: string;
}): Promise<ApplyQuickRunContinuationAfterGithubVerifyResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  let orchestrationPatch = input.advance.orchestrationPatch;
  let continuationDispatchedOnServer = false;
  let fallbackResult: ServerQuickRunContinuationResult | undefined;

  if (!input.verify.ok) {
    return { orchestrationPatch, continuationDispatchedOnServer };
  }

  const mergedSlice = mergeRequirementsStateJson(
    input.requirementsSlice,
    orchestrationPatch as Partial<RequirementsStateJson>,
  );

  const patchPersistedEntry = buildQuickRunContinuationPatchPersistedTimelineEntry({
    projectId: input.projectId,
    hasNextDispatch: shouldMarkQuickRunHasNextDispatch({
      projectId: input.projectId,
      requirementsState: mergedSlice,
    }),
    nowIso,
  });
  orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, {
    promptTimeline: appendPromptTimeline(
      mergeRequirementsStateJson(input.requirementsSlice, orchestrationPatch as Partial<RequirementsStateJson>)
        .promptTimeline ?? [],
      patchPersistedEntry,
    ),
  });

  await persistTaskCursorOrchestrationToProject({
    projectId: input.projectId,
    orchestrationPatch: orchestrationPatch as Record<string, unknown>,
  });

  const canDispatch = Boolean(input.cursorApiToken.trim()) && input.execReadinessOk;

  const completedCodeTaskId =
    input.previousCodeTaskId?.trim() ||
    String(input.execution.codeTaskId ?? "").trim() ||
    "";

  if (!canDispatch) {
    const reason = !input.cursorApiToken.trim()
      ? "cursor_api_token_missing"
      : "execution_setup_not_ready";
    orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, {
      promptTimeline: appendPromptTimeline(
        mergeRequirementsStateJson(input.requirementsSlice, orchestrationPatch as Partial<RequirementsStateJson>)
          .promptTimeline ?? [],
        buildQuickRunContinuationNoopTimelineEntry({
          projectId: input.projectId,
          currentCodeTaskId: input.previousCodeTaskId,
          selectedCodeTaskIds: [],
          reason,
          nowIso,
        }),
      ),
    });
    await persistTaskCursorOrchestrationToProject({
      projectId: input.projectId,
      orchestrationPatch: orchestrationPatch as Record<string, unknown>,
    });
    return { orchestrationPatch, continuationDispatchedOnServer };
  }

  const scheduler = await scheduleNextExecutionUnitAfterVerified({
    projectId: input.projectId,
    completedTaskId: input.execution.taskId,
    completedCodeTaskId: completedCodeTaskId || input.execution.taskId,
    sourceCommitSha: input.previousCommitSha,
    requirementsOverlay: mergeRequirementsStateJson(
      input.requirementsSlice,
      orchestrationPatch as Partial<RequirementsStateJson>,
    ),
    nowIso,
  });
  fallbackResult = scheduler.result;

  orchestrationPatch = mergeOrchestrationPersistPatches(
    orchestrationPatch,
    fallbackResult.orchestrationPatch ?? {},
    {
      promptTimeline: appendPromptTimeline(
        mergeRequirementsStateJson(
          input.requirementsSlice,
          mergeOrchestrationPersistPatches(
            orchestrationPatch,
            fallbackResult.orchestrationPatch ?? {},
          ) as Partial<RequirementsStateJson>,
        ).promptTimeline ?? [],
        ...scheduler.timeline,
      ),
    },
  );
  await persistTaskCursorOrchestrationToProject({
    projectId: input.projectId,
    orchestrationPatch: orchestrationPatch as Record<string, unknown>,
  });

  continuationDispatchedOnServer = fallbackResult.outcome === "dispatched" && fallbackResult.ok;

  return { orchestrationPatch, continuationDispatchedOnServer, fallbackResult };
}
