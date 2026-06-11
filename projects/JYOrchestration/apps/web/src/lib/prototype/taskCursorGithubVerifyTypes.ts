import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type TaskCursorGithubVerifyRequestBody = Readonly<{
  readonly projectId: string;
  readonly execution: TaskCursorExecutionV1;
  readonly codeTaskId?: string;
  /** CodeTask row 수동 GitHub 재확인 */
  readonly manualGithubRecheck?: boolean;
  readonly implementationTaskExecutionStateV1?: unknown;
  readonly workItems?: readonly CursorWorkItem[];
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationQuickRunV1?: unknown;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly implementationAutoQualityGateV1?: unknown;
  readonly implementationAutoQualityGateHistoryV1?: unknown;
  readonly implementationQualityGateResultsV1?: unknown;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly codeTaskExecutionQueueV1?: unknown;
}>;

export type TaskCursorGithubVerifyApiResponse = Readonly<{
  readonly success?: boolean;
  readonly status?: string;
  readonly message?: string;
  readonly verify?: TaskCursorGithubVerifyResult;
  readonly execution?: TaskCursorExecutionV1;
  readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  readonly nextQuickRunDispatch?: QuickRunGithubAdvanceDispatch | null;
  readonly continuationDispatchedOnServer?: boolean;
  readonly commitSha?: string | null;
}>;
