"use client";

import { useCallback, type MutableRefObject } from "react";
import { persistImplementationQuickRunRequirementsPrep } from "@/components/preview/useImplementationQuickRunController";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import { resolveDeveloperPromptCopyFromSelection } from "@/lib/prototype/codeTaskDeveloperPromptBundle";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { resolveCheckedCodeTaskIdsFromBoardBridge } from "@/lib/prototype/implementationBoardCodeTaskSelection";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/**
 * Controls implementation-stage Developer Prompt copy actions.
 *
 * Scope:
 * - prepare implementation Quick Run prompt prerequisites before copy
 * - resolve target repository and branch metadata
 * - copy a single CodeTask Cursor prompt
 * - copy selected/current Developer prompts from the header action
 * - keep prompt copy logic outside the parent panel hook
 *
 * Not scope:
 * - Quick Run execution
 * - Cursor job dispatch
 * - GitHub verification
 * - Integration pipeline execution
 * - board rendering
 */
export type ImplementationDeveloperPromptCopyControllerInput = Readonly<{
  readonly projectId: string;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  readonly applyPendingFromOrchestrationPatchRef: MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
}>;

export type ImplementationDeveloperPromptCopyControllerValue = Readonly<{
  readonly handleCopyCodeTaskCursorPrompt: (codeTaskId: string) => void;
  readonly handleCopyDeveloperPromptsFromHeader: () => void;
}>;

export function useImplementationDeveloperPromptCopyController(
  input: ImplementationDeveloperPromptCopyControllerInput,
): ImplementationDeveloperPromptCopyControllerValue {
  const handleCopyCodeTaskCursorPrompt = useCallback(
    (codeTaskId: string) => {
      const pid = input.projectId.trim();
      const id = codeTaskId.trim();
      if (!pid || !id) return;
      void (async () => {
        const imp = await persistImplementationQuickRunRequirementsPrep({
          projectId: pid,
          requirementsState: input.orchestrationAwareRequirementsState,
          applyPendingFromOrchestrationPatch: (patch) => {
            input.applyPendingFromOrchestrationPatchRef.current(patch);
          },
          persistChatToDb: input.persistChatToDb,
        });
        const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
          gitRepoUrl: input.executionSetupRow?.gitRepoUrl,
          gitRepoName: input.executionSetupRow?.gitRepoName,
          gitRepoProvider: input.executionSetupRow?.gitRepoProvider,
          baseBranch: input.executionSetupRow?.baseBranch,
        });
        const runs = parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
        const result = resolveCodeTaskDeveloperPromptForCopy({
          projectId: pid,
          codeTaskId: id,
          codeTaskPlan: imp.implementationCodeTaskPlanV1 ?? null,
          taskList: imp.implementationTaskListV1 ?? null,
          cursorWorkItems: imp.cursorWorkItemsV1 ?? [],
          runs,
          targetRepository,
          baseBranch:
            input.executionSetupRow?.baseBranch ?? targetRepository?.defaultBranch ?? "main",
          allowedPathGlobs: parseStringArrayJson(input.executionSetupRow?.allowedPathGlobs),
          codeTaskPromptContextMapV1: imp.codeTaskPromptContextMapV1 ?? null,
        });
        if (!result.ok || !result.prompt) {
          return;
        }
        void writeClipboardText(result.prompt).then(() => {});
      })();
    },
    [
      input.projectId,
      input.executionSetupRow,
      input.orchestrationAwareRequirementsState,
      input.applyPendingFromOrchestrationPatchRef,
      input.persistChatToDb,
    ],
  );

  const handleCopyDeveloperPromptsFromHeader = useCallback(() => {
    const pid = input.projectId.trim();
    if (!pid) return;
    void (async () => {
      const imp = await persistImplementationQuickRunRequirementsPrep({
        projectId: pid,
        requirementsState: input.orchestrationAwareRequirementsState,
        applyPendingFromOrchestrationPatch: (patch) => {
          input.applyPendingFromOrchestrationPatchRef.current(patch);
        },
        persistChatToDb: input.persistChatToDb,
      });
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: input.executionSetupRow?.gitRepoUrl,
        gitRepoName: input.executionSetupRow?.gitRepoName,
        gitRepoProvider: input.executionSetupRow?.gitRepoProvider,
        baseBranch: input.executionSetupRow?.baseBranch,
      });
      const selectedCodeTaskIds = resolveCheckedCodeTaskIdsFromBoardBridge({
        bridge: input.boardSelectionBridge.getBridgeSnapshot(),
        requirementsState: imp,
      });
      const plan = imp.implementationCodeTaskPlanV1 ?? null;
      const currentCodeTaskId = resolveExecutionTargetCodeTaskId({
        selectedCodeTaskId: null,
        runtimeCurrentCodeTaskId:
          input.implementationRuntimeDbBundle?.job?.currentCodeTaskId?.trim() ?? null,
        codeTaskPlan: plan ?? undefined,
      });
      const runs = parseCodeTaskExecutionRunsV1(imp.codeTaskExecutionRunsV1) ?? [];
      const result = resolveDeveloperPromptCopyFromSelection({
        projectId: pid,
        selectedCodeTaskIds,
        currentCodeTaskId,
        codeTaskPlan: plan,
        taskList: imp.implementationTaskListV1 ?? null,
        cursorWorkItems: imp.cursorWorkItemsV1 ?? [],
        runs,
        targetRepository,
        baseBranch:
          input.executionSetupRow?.baseBranch ?? targetRepository?.defaultBranch ?? "main",
        allowedPathGlobs: parseStringArrayJson(input.executionSetupRow?.allowedPathGlobs),
        codeTaskPromptContextMapV1: imp.codeTaskPromptContextMapV1 ?? null,
      });
      if (!result.ok || !result.prompt) {
        return;
      }
      void writeClipboardText(result.prompt).then(() => {});
    })();
  }, [
    input.projectId,
    input.orchestrationAwareRequirementsState,
    input.executionSetupRow,
    input.implementationRuntimeDbBundle?.job?.currentCodeTaskId,
    input.boardSelectionBridge,
    input.applyPendingFromOrchestrationPatchRef,
    input.persistChatToDb,
  ]);

  return {
    handleCopyCodeTaskCursorPrompt,
    handleCopyDeveloperPromptsFromHeader,
  };
}
