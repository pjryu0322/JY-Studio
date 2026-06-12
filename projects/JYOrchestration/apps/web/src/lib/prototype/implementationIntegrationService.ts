import {
  selectCompletedCodeTasksForIntegration,
  type CompletedCodeTaskIntegrationTarget,
  type ExcludedCodeTaskIntegrationTarget,
} from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE } from "@/lib/prototype/implementationIntegrationGate";
import {
  evaluateCodeTaskIntegration,
  type CodeTaskIntegrationSource,
} from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  buildImplementationPreviewScopeV1,
  type ImplementationPreviewScopeV1,
} from "@/lib/prototype/implementationPreviewScopeV1";
import {
  buildPreviewFromCompletedCodeTasks,
  type BuildPreviewFromCompletedCodeTasksResult,
} from "@/lib/prototype/buildPreviewFromCompletedCodeTasks";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type IntegrateCompletedCodeTasksInput = CodeTaskIntegrationSource &
  Readonly<{
    readonly generatedAt?: string;
  }>;

export type IntegrateCompletedCodeTasksResult =
  | Readonly<{
      readonly ok: true;
      readonly included: readonly CompletedCodeTaskIntegrationTarget[];
      readonly excluded: readonly ExcludedCodeTaskIntegrationTarget[];
      readonly previewScope: ImplementationPreviewScopeV1;
      readonly summary: string;
    }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

export function integrateCompletedCodeTasksForPreview(
  input: IntegrateCompletedCodeTasksInput,
): IntegrateCompletedCodeTasksResult {
  const targets = evaluateCodeTaskIntegration(input);

  if (!targets.canIntegrate) {
    const message =
      targets.excluded.length > 0
        ? INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE
        : "완료된 CodeTask가 없어 통합할 수 없습니다.";
    return { ok: false, message };
  }

  const previewScope = buildImplementationPreviewScopeV1({
    generatedAt: input.generatedAt,
    included: targets.included,
    excluded: targets.excluded,
    warnings: targets.warnings,
  });

  const summary = `완료된 CodeTask ${targets.included.length}개 기준 통합 · 제외 ${targets.excluded.length}개`;

  return {
    ok: true,
    included: targets.included,
    excluded: targets.excluded,
    previewScope,
    summary,
  };
}

export function buildTaskCursorExecutionsForIntegration(input: {
  readonly current?: TaskCursorExecutionV1 | null;
  readonly history?: readonly TaskCursorExecutionV1[] | null;
}): readonly TaskCursorExecutionV1[] {
  const rows: TaskCursorExecutionV1[] = [];
  if (input.current) rows.push(input.current);
  for (const row of input.history ?? []) {
    if (!rows.some((existing) => existing.taskId === row.taskId && existing.cursorRunId === row.cursorRunId)) {
      rows.push(row);
    }
  }
  return rows;
}

export type IntegrateAndBuildPreviewResult =
  | Readonly<{
      readonly ok: true;
      readonly integration: Extract<IntegrateCompletedCodeTasksResult, { readonly ok: true }>;
      readonly previewBuild: BuildPreviewFromCompletedCodeTasksResult;
      readonly previewRuntime: ImplementationPreviewRuntimeV1;
      readonly previewUrl: string | null;
    }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

/** 통합(scope) 성공 후 Preview runtime 준비 — Preview 실패 시에도 integration 결과는 유지한다. */
export function integrateAndBuildPreviewFromCompletedCodeTasks(input: {
  readonly projectId: string;
  readonly source: CodeTaskIntegrationSource;
  readonly nowIso?: string;
}): IntegrateAndBuildPreviewResult {
  const integration = integrateCompletedCodeTasksForPreview({
    ...input.source,
    generatedAt: input.nowIso,
  });
  if (!integration.ok) {
    return { ok: false, message: integration.message };
  }
  const previewBuild = buildPreviewFromCompletedCodeTasks({
    projectId: input.projectId,
    previewScope: integration.previewScope,
    nowIso: input.nowIso,
  });
  return {
    ok: true,
    integration,
    previewBuild,
    previewRuntime: previewBuild.runtime,
    previewUrl: previewBuild.previewUrl ?? null,
  };
}

/** @deprecated Prefer evaluateImplementationIntegrationEligibility */
export { selectCompletedCodeTasksForIntegration };
