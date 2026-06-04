import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RuntimePromptQualityGateDiagnostics } from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import {
  patchTaskCursorExecution,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const RUNTIME_PROMPT_QUALITY_GATE_FAILURE_TYPE =
  "runtime_prompt_quality_gate_failed" as const;

export const PROMPT_PREFLIGHT_FAILED_PHASE = "prompt_preflight_failed" as const;

export type PromptPreflightFailureMetadata = Readonly<{
  readonly phase: typeof PROMPT_PREFLIGHT_FAILED_PHASE;
  readonly failureType: typeof RUNTIME_PROMPT_QUALITY_GATE_FAILURE_TYPE;
  readonly cursorStarted: false;
  readonly githubVerifyStarted: false;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}>;

export function buildPromptPreflightFailureMetadata(
  diagnostics: RuntimePromptQualityGateDiagnostics,
): PromptPreflightFailureMetadata {
  return {
    phase: PROMPT_PREFLIGHT_FAILED_PHASE,
    failureType: RUNTIME_PROMPT_QUALITY_GATE_FAILURE_TYPE,
    cursorStarted: false,
    githubVerifyStarted: false,
    errors: diagnostics.errors,
    warnings: diagnostics.warnings,
  };
}

export function patchTaskCursorExecutionForPromptPreflightFailure(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly errorMessage: string;
  readonly nowIso?: string;
}): TaskCursorExecutionV1 {
  return patchTaskCursorExecution(input.execution, {
    status: "prompt_ready",
    failureReason: "prompt_preflight_failed",
    errorMessage: input.errorMessage,
    cursorRunId: undefined,
    nowIso: input.nowIso,
  });
}

export function buildRuntimePromptQualityGateTimelineEntry(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly diagnostics: RuntimePromptQualityGateDiagnostics;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const meta = buildPromptPreflightFailureMetadata(input.diagnostics);
  return buildImplementationExecutionLogTimelineEntry({
    action: "runtime_prompt_quality_gate_failed",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      workBranch: input.diagnostics.workBranch,
      phase: meta.phase,
      failureType: meta.failureType,
      cursorStarted: meta.cursorStarted,
      githubVerifyStarted: meta.githubVerifyStarted,
    },
    detailLines: [
      ...(meta.errors.length ? [`errors=${meta.errors.join(",")}`] : []),
      ...(meta.warnings.length ? [`warnings=${meta.warnings.join(",")}`] : []),
    ],
    error: meta.errors[0] ?? input.diagnostics.errors[0],
    nowIso: input.nowIso,
  });
}

export const PROMPT_PREFLIGHT_USER_BLOCK_MESSAGE =
  "프롬프트 품질 검사 실패로 Cursor 실행 전 차단되었습니다." as const;
