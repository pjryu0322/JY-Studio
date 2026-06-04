import {
  selectCompletedCodeTasksForIntegration,
  type CompletedCodeTaskIntegrationTarget,
  type ExcludedCodeTaskIntegrationTarget,
} from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import {
  evaluateCodeTaskIntegration,
  type CodeTaskIntegrationSource,
} from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  buildImplementationPreviewScopeV1,
  type ImplementationPreviewScopeV1,
} from "@/lib/prototype/implementationPreviewScopeV1";
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
    return { ok: false, message: "완료된 CodeTask가 없어 통합할 수 없습니다." };
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

/** @deprecated Prefer evaluateImplementationIntegrationEligibility */
export { selectCompletedCodeTasksForIntegration };
