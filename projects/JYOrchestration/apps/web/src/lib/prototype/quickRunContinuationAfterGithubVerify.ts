import { dispatchQuickRunContinuationOnServer } from "@/lib/prototype/implementationQuickRunContinuationDispatchService";
import type { QuickRunGithubAdvanceResult } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import type { ExecutionSetupSourceGenerationContext } from "@/lib/prototype/executionSetupSourceGeneration";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildQuickRunContinuationNoopTimelineEntry,
  buildQuickRunContinuationPatchPersistedTimelineEntry,
  buildQuickRunNextCodeTaskDispatchedTimelineEntry,
  buildQuickRunQueuedFallbackDispatchRequestedTimelineEntry,
  buildQuickRunQueuedFallbackTimelineFromServerResult,
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
  tryDispatchCurrentQueuedQuickRunAfterDbAdvance,
  type ServerQuickRunContinuationResult,
} from "@/lib/prototype/serverQuickRunContinuationService";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { shouldMarkQuickRunHasNextDispatch } from "@/lib/prototype/implementationQuickRunQueue";

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
    hasNextDispatch:
      Boolean(input.advance.nextDispatch) ||
      shouldMarkQuickRunHasNextDispatch({
        projectId: input.projectId,
        requirementsState: mergedSlice,
        selectedCodeTaskIds:
          parseImplementationQuickRunV1(mergedSlice.implementationQuickRunV1)?.selectedCodeTaskIds ??
          null,
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

  if (input.advance.nextDispatch && canDispatch) {
    const dispatchOutcome = await dispatchQuickRunContinuationOnServer({
      projectId: input.projectId,
      dispatch: input.advance.nextDispatch,
      baseOrchestrationPatch: orchestrationPatch,
      requirementsSlice: mergeRequirementsStateJson(
        input.requirementsSlice,
        orchestrationPatch as Record<string, unknown>,
      ),
      context: input.execContext,
      cursorApiToken: input.cursorApiToken,
      nowIso,
    });
    orchestrationPatch = dispatchOutcome.orchestrationPatch;
    continuationDispatchedOnServer = dispatchOutcome.dispatched;
    if (dispatchOutcome.dispatched) {
      const dispatchedEntry = buildQuickRunNextCodeTaskDispatchedTimelineEntry({
        projectId: input.projectId,
        currentCodeTaskId: input.previousCodeTaskId ?? input.advance.nextDispatch.codeTaskId,
        nextCodeTaskId: input.advance.nextDispatch.codeTaskId,
        selectedCodeTaskIds: [],
        completedCodeTaskCount: 0,
        reason: "next_dispatch_on_server",
        nowIso,
      });
      orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, {
        promptTimeline: appendPromptTimeline(
          mergeRequirementsStateJson(input.requirementsSlice, orchestrationPatch as Partial<RequirementsStateJson>)
            .promptTimeline ?? [],
          dispatchedEntry,
        ),
      });
      await persistTaskCursorOrchestrationToProject({
        projectId: input.projectId,
        orchestrationPatch: orchestrationPatch as Record<string, unknown>,
      });
    }
    return { orchestrationPatch, continuationDispatchedOnServer, fallbackResult };
  }

  if (input.advance.nextDispatch && !canDispatch) {
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

  const fallbackRequest = buildQuickRunQueuedFallbackDispatchRequestedTimelineEntry({
    projectId: input.projectId,
    previousCodeTaskId: input.previousCodeTaskId,
    previousCommitSha: input.previousCommitSha,
    reason: "verified_without_next_dispatch",
    nowIso,
  });
  orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, {
    promptTimeline: appendPromptTimeline(
      mergeRequirementsStateJson(input.requirementsSlice, orchestrationPatch as Partial<RequirementsStateJson>)
        .promptTimeline ?? [],
      fallbackRequest,
    ),
  });
  await persistTaskCursorOrchestrationToProject({
    projectId: input.projectId,
    orchestrationPatch: orchestrationPatch as Record<string, unknown>,
  });

  if (!canDispatch) {
    const reason = !input.cursorApiToken.trim()
      ? "cursor_api_token_missing"
      : "execution_setup_not_ready";
    const skipEntries = buildQuickRunQueuedFallbackTimelineFromServerResult({
      projectId: input.projectId,
      outcome: "skipped",
      reason,
      codeTaskId: null,
    });
    orchestrationPatch = mergeOrchestrationPersistPatches(orchestrationPatch, {
      promptTimeline: appendPromptTimeline(
        mergeRequirementsStateJson(input.requirementsSlice, orchestrationPatch as Partial<RequirementsStateJson>)
          .promptTimeline ?? [],
        ...skipEntries,
      ),
    });
    await persistTaskCursorOrchestrationToProject({
      projectId: input.projectId,
      orchestrationPatch: orchestrationPatch as Record<string, unknown>,
    });
    return { orchestrationPatch, continuationDispatchedOnServer };
  }

  fallbackResult = await tryDispatchCurrentQueuedQuickRunAfterDbAdvance({
    projectId: input.projectId,
    nowIso,
  });

  const fallbackTimeline = buildQuickRunQueuedFallbackTimelineFromServerResult({
    projectId: input.projectId,
    serverResult: fallbackResult,
    reason: "verified_without_next_dispatch",
  });
  orchestrationPatch = mergeOrchestrationPersistPatches(
    orchestrationPatch,
    fallbackResult.orchestrationPatch ?? {},
    {
      promptTimeline: appendPromptTimeline(
        mergeRequirementsStateJson(
          input.requirementsSlice,
          mergeOrchestrationPersistPatches(orchestrationPatch, fallbackResult.orchestrationPatch ?? {}) as Partial<
            RequirementsStateJson
          >,
        ).promptTimeline ?? [],
        ...fallbackTimeline,
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
