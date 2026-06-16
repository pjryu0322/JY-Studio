import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  buildImplementationReadinessUserSummary,
  formatCodeTaskLlmRefinementSummaryLines,
  formatImplementationReadinessIntroLines,
  type ImplementationReadinessUserSummary,
} from "@/lib/prototype/implementationReadinessSummary";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { formatImplementationTaskListRoleSummaryLines } from "@/lib/requirements/implementationTaskList";
import { normalizeUserVisibleMessageText } from "@/lib/requirements/messageTextNormalize";

export type ImplementationPreparationUserSummary = Readonly<{
  readonly appShellCount: number;
  readonly processTaskCount: number;
  readonly workItemCount: number;
  readonly codeTaskCount: number;
  readonly templateNameKo?: string;
}>;

export type ImplementationPreparationDiagnostics = Readonly<{
  readonly codeTaskCount?: number;
  readonly llmRefinementStatus?: string;
  readonly refinedCount?: number;
  readonly fallbackCount?: number;
  readonly batchCount?: number;
  readonly concurrency?: number;
  readonly elapsedMs?: number;
  readonly elapsedLabel?: string;
  readonly statusLabel?: string;
  readonly introLines?: readonly string[];
}>;

export function buildImplementationPreparationUserSummary(input: {
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly workItemCount?: number;
  readonly templateNameKo?: string | null;
}): ImplementationPreparationUserSummary {
  const frameCount = input.taskList?.tasks.filter((t) => t.taskType === "frame").length ?? 0;
  const processTaskCount = input.taskList?.tasks.filter((t) => t.ownerRole === "developer").length ?? 0;
  const codeTaskCount = input.codeTaskPlan?.codeTaskCount ?? input.codeTaskPlan?.tasks.length ?? 0;
  const workItemCount = input.workItemCount ?? codeTaskCount;
  return {
    appShellCount: frameCount,
    processTaskCount,
    workItemCount,
    codeTaskCount,
    ...(input.templateNameKo?.trim() ? { templateNameKo: input.templateNameKo.trim() } : {}),
  };
}

export function formatImplementationPreparationUserMessage(
  summary: ImplementationPreparationUserSummary,
): string {
  const lines = [
    "구현 준비 항목을 생성했습니다.",
    `- 화면 프레임/App Shell: ${summary.appShellCount}개`,
    `- Process Task: ${summary.processTaskCount}개`,
    `- WorkItem: ${summary.workItemCount}개`,
    `- CodeTask: ${summary.codeTaskCount}개`,
  ];
  if (summary.templateNameKo) {
    lines.splice(1, 0, `- 확정 템플릿: ${summary.templateNameKo}`);
  }
  return normalizeUserVisibleMessageText(lines.join("\n"));
}

export function buildImplementationPreparationDiagnostics(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
}): ImplementationPreparationDiagnostics | null {
  if (!input.codeTaskPlan) return null;
  const readiness = buildImplementationReadinessUserSummary(input);
  const introLines = formatImplementationReadinessIntroLines(readiness);
  return {
    codeTaskCount: readiness.codeTaskCount,
    llmRefinementStatus: readiness.refinementStatus,
    refinedCount: readiness.llmRefinedTaskCount,
    fallbackCount: readiness.fallbackTaskCount,
    batchCount: readiness.totalBatches,
    concurrency: readiness.concurrency,
    elapsedMs: readiness.elapsedMs,
    elapsedLabel: readiness.elapsedLabel,
    statusLabel: readiness.statusLabel,
    ...(introLines.length ? { introLines } : {}),
  };
}

export function formatImplementationPreparationDiagnostics(
  diagnostics: ImplementationPreparationDiagnostics,
): string {
  const readinessSummary: ImplementationReadinessUserSummary = {
    codeTaskCount: diagnostics.codeTaskCount ?? 0,
    llmRefinedTaskCount: diagnostics.refinedCount ?? 0,
    fallbackTaskCount: diagnostics.fallbackCount ?? 0,
    totalBatches: diagnostics.batchCount,
    concurrency: diagnostics.concurrency,
    elapsedMs: diagnostics.elapsedMs,
    refinementStatus: diagnostics.llmRefinementStatus ?? "",
    statusLabel: diagnostics.statusLabel ?? "",
    ...(diagnostics.elapsedLabel ? { elapsedLabel: diagnostics.elapsedLabel } : {}),
  };

  const parts: string[] = [];
  if (diagnostics.introLines?.length) {
    parts.push(...diagnostics.introLines);
  }
  parts.push(...formatCodeTaskLlmRefinementSummaryLines(readinessSummary));
  return parts.join("\n");
}

export function formatImplementationPreparationDiagnosticsFromPlan(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
}): string {
  const diagnostics = buildImplementationPreparationDiagnostics(input);
  if (!diagnostics) return "";
  return formatImplementationPreparationDiagnostics(diagnostics);
}

/** User-visible 구현 작업목록 section (role counts only). */
export function formatImplementationPreparationTaskListSection(
  taskList: ImplementationTaskListV1 | null | undefined,
): string {
  if (!taskList?.tasks?.length || !taskList.roleSummary) return "";
  const lines = ["구현 작업목록:", ...formatImplementationTaskListRoleSummaryLines(taskList)];
  return normalizeUserVisibleMessageText(lines.join("\n"));
}
