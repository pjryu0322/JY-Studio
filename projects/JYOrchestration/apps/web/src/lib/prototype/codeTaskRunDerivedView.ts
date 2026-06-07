import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { normalizeCodeTaskQualityOutcomeFromRun } from "@/lib/prototype/codeTaskQualityOutcome";
import {
  mapTaskCursorExecutionToCursorSession,
  resolveCursorSessionForRunPhase,
  type CursorSession,
} from "@/lib/prototype/cursorSessionModel";
import {
  buildCodeTaskExecutionFlowSteps,
  deriveCodeTaskExecutionFlowPhase,
  enrichCodeTaskRunForFlowPhase,
  formatCodeTaskExecutionFlowPhaseKo,
  type CodeTaskExecutionFlowPhase,
  type CodeTaskExecutionFlowStepVm,
} from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { evaluateCodeTaskReviewSecurityPolicy } from "@/lib/prototype/implementationReviewSecurityPolicy";
import type { CodeTaskRun } from "@/lib/prototype/implementationRuntimeStateModel";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type CodeTaskRunDerivedPhase = CodeTaskExecutionFlowPhase;
export type CodeTaskProgressStep = CodeTaskExecutionFlowStepVm;

export type CodeTaskRunStatusLabel = Readonly<{
  readonly title: string;
  readonly detail: string;
  readonly severity: "idle" | "running" | "success" | "warning" | "error";
}>;

export function deriveCodeTaskRunPhase(input: {
  readonly run: CodeTaskRun;
  readonly cursorSession?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly dbRun?: Readonly<{ readonly commitSha?: string | null; readonly runtimeState?: string | null }> | null;
}): CodeTaskRunDerivedPhase {
  const execution = resolveCursorSessionForRunPhase(input.cursorSession ?? null, input.run);
  const enriched = enrichCodeTaskRunForFlowPhase({
    run: input.run,
    execution,
    dbRun: input.dbRun ?? undefined,
  });

  return deriveCodeTaskExecutionFlowPhase({
    parentTaskId: input.run.processTaskId,
    taskCursorExecution: execution,
    autoGate: input.autoGate ?? null,
    latestRun: enriched ?? input.run,
    dbRuntimeState: input.dbRun?.runtimeState ?? null,
  });
}

export function deriveCodeTaskRunProgressSteps(input: {
  readonly run: CodeTaskRun;
  readonly codeTask?: ImplementationCodeTaskV1 | null;
  readonly workItem?: CursorWorkItem | null;
  readonly cursorSession?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): readonly CodeTaskProgressStep[] {
  const phase = deriveCodeTaskRunPhase({
    run: input.run,
    cursorSession: input.cursorSession,
    autoGate: input.autoGate,
  });
  const codeTask: ImplementationCodeTaskV1 =
    input.codeTask ??
    ({
      codeTaskId: input.run.codeTaskId,
      parentTaskId: input.run.processTaskId,
      title: "",
      description: "",
      changeType: "feature",
      targetHints: [],
      dependencies: [],
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
    } satisfies ImplementationCodeTaskV1);
  const policy = evaluateCodeTaskReviewSecurityPolicy({
    codeTask,
    workItem: input.workItem ?? null,
  });
  return buildCodeTaskExecutionFlowSteps({ phase, policy });
}

export function deriveCodeTaskRunStatusLabel(input: {
  readonly run: CodeTaskRun;
  readonly cursorSession?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): CodeTaskRunStatusLabel {
  const phase = deriveCodeTaskRunPhase({
    run: input.run,
    cursorSession: input.cursorSession,
    autoGate: input.autoGate,
  });
  const title = formatCodeTaskExecutionFlowPhaseKo(phase);
  const github = normalizeCodeTaskGithubOutcomeFromRun(input.run);
  const quality = normalizeCodeTaskQualityOutcomeFromRun(input.run);

  let severity: CodeTaskRunStatusLabel["severity"] = "idle";
  if (phase === "completed") severity = "success";
  else if (phase === "failed" || phase === "github_branch_missing" || phase === "github_verify_timeout") {
    severity = "error";
  } else if (
    phase === "cursor_running" ||
    phase === "github_verifying" ||
    phase === "lightweight_checking" ||
    phase === "github_verified" ||
    phase === "next_code_task_dispatch_pending" ||
    phase === "next_code_task_dispatch_connecting"
  ) {
    severity = "running";
  } else if (phase === "prompt_preflight_failed") severity = "warning";

  const detail =
    quality?.status === "passed"
      ? "경량 자동검사 완료"
      : github?.status === "verified"
        ? "GitHub commit 확인 완료"
        : title;

  return { title, detail, severity };
}

export function mapExecutionToCursorSession(
  execution: TaskCursorExecutionV1 | null | undefined,
): CursorSession | null {
  return mapTaskCursorExecutionToCursorSession(execution);
}
