import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  buildQuickRunStuckGithubVerifyDedupeKey,
  resolveQuickRunStuckGithubVerifyTarget,
} from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import {
  applyTaskCursorGithubVerifyApiResult,
  buildTaskCursorGithubVerifyRequestBody,
  postTaskCursorGithubVerify,
  resolveTaskCursorGithubVerifyUserNotice,
} from "@/lib/prototype/taskCursorGithubVerifyClient";
import {
  parseCodeTaskExecutionQueueV1,
  resolveFirstIncompleteSelectedCodeTaskId,
} from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type QuickRunGithubVerifyRecoveryInput = Readonly<{
  readonly projectId: string;
  readonly state: RequirementsStateJson;
  readonly effectiveQueue: CodeTaskExecutionQueueV1 | null;
  readonly stuckVerifyDedupeRef: { current: string | null };
  readonly continuationTriggerRef: { current: string | null };
  readonly enrichPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly onNextQuickRunDispatch: (dispatch: QuickRunGithubAdvanceDispatch) => void;
  readonly showToast: (message: string) => void;
  readonly onFailureNotice?: (message: string) => void;
  readonly refreshRuntime?: () => void | Promise<void>;
}>;

/** Quick Run stuck 시 GitHub verify + 서버 advance. 대상 없으면 false. */
export async function runQuickRunStuckGithubVerifyRecovery(
  input: QuickRunGithubVerifyRecoveryInput,
): Promise<boolean> {
  const pid = input.projectId.trim();
  if (!pid) return false;

  const quickRun = parseImplementationQuickRunV1(input.state.implementationQuickRunV1);
  const queue =
    input.effectiveQueue ?? parseCodeTaskExecutionQueueV1(input.state.codeTaskExecutionQueueV1);
  const runs = parseCodeTaskExecutionRunsV1(input.state.codeTaskExecutionRunsV1) ?? [];
  const execution = resolveQuickRunStuckGithubVerifyTarget({
    projectId: pid,
    quickRun,
    queue,
    runs,
    codeTaskPlan: input.state.implementationCodeTaskPlanV1,
    taskCursorExecution: parseTaskCursorExecutionV1(input.state.taskCursorExecutionV1),
    taskCursorExecutionHistory: input.state.taskCursorExecutionHistoryV1,
  });
  if (!execution || !queue) return false;

  const codeTaskId =
    resolveFirstIncompleteSelectedCodeTaskId({ queue, runs }) ??
    String(queue.selectedCodeTaskIds[queue.currentIndex] ?? "").trim();
  if (!codeTaskId) return false;

  const dedupe = buildQuickRunStuckGithubVerifyDedupeKey(execution, codeTaskId);
  if (input.stuckVerifyDedupeRef.current === dedupe) return false;
  input.stuckVerifyDedupeRef.current = dedupe;

  input.showToast(`${execution.taskId} · GitHub branch에서 commit 확인 중…`);
  try {
    const json = await postTaskCursorGithubVerify(
      buildTaskCursorGithubVerifyRequestBody({
        projectId: pid,
        execution,
        state: input.state,
        codeTaskId,
        effectiveQueue: input.effectiveQueue,
      }),
    );
    const ok = applyTaskCursorGithubVerifyApiResult({
      json,
      enrichPatch: input.enrichPatch,
      applyOrchestrationPatch: input.applyOrchestrationPatch,
      shouldApplyNextDispatch: (next) => input.continuationTriggerRef.current !== next.triggerKey,
      onNextQuickRunDispatch: (next) => {
        input.continuationTriggerRef.current = next.triggerKey;
        input.onNextQuickRunDispatch(next);
      },
    });
    void input.refreshRuntime?.();
    const notice = resolveTaskCursorGithubVerifyUserNotice(json);
    if (!ok) {
      input.stuckVerifyDedupeRef.current = null;
      input.onFailureNotice?.(notice);
    }
    input.showToast(notice);
    return ok;
  } catch (error) {
    input.stuckVerifyDedupeRef.current = null;
    const message = error instanceof Error ? error.message : String(error);
    input.showToast(`GitHub 확인 오류: ${message}`);
    return false;
  }
}
