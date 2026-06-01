import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationReadinessUserSummary = Readonly<{
  readonly codeTaskCount: number;
  readonly llmRefinedTaskCount: number;
  readonly fallbackTaskCount: number;
  readonly totalBatches?: number;
  readonly concurrency?: number;
  readonly elapsedMs?: number;
  readonly refinementStatus: string;
  readonly statusLabel: string;
  readonly elapsedLabel?: string;
}>;

function parseTimelineNumberField(responseText: string, key: string): number | undefined {
  const match = responseText.match(new RegExp(`(?:^|\\s)${key}=(\\d+)`));
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

function extractLlmRefinementMetricsFromTimeline(
  timelineEntries: readonly RequirementsPromptTimelineEntry[] | undefined,
): Readonly<{ readonly concurrency?: number; readonly elapsedMs?: number }> {
  if (!timelineEntries?.length) return {};
  const targets = new Set([
    "implementation_code_task_llm_refinement_passed",
    "implementation_code_task_llm_refinement_partial",
    "implementation_code_task_llm_refinement_batch_planned",
  ]);
  for (let i = timelineEntries.length - 1; i >= 0; i -= 1) {
    const entry = timelineEntries[i];
    if (!entry || !targets.has(String(entry.action ?? ""))) continue;
    const text = String(entry.responseText ?? "");
    const concurrency = parseTimelineNumberField(text, "concurrency");
    const elapsedMs = parseTimelineNumberField(text, "elapsedMs");
    if (concurrency != null || elapsedMs != null) {
      return { concurrency, elapsedMs };
    }
  }
  return {};
}

export function formatElapsedMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  if (safe < 1000) return "1초 미만";
  const totalSec = Math.floor(safe / 1000);
  if (totalSec < 60) return `${totalSec}초`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec}초`;
}

function resolveStatusLabel(refinementStatus: string, llmRefined: number, fallback: number): string {
  if (refinementStatus === "llm_refined" && fallback === 0) return "LLM 정제 완료";
  if (refinementStatus === "llm_partial_refined" || (llmRefined > 0 && fallback > 0)) {
    return "일부 정제 완료";
  }
  if (llmRefined === 0 && fallback > 0) return "기본 규칙 기반 대체";
  return "기본 규칙 기반으로 대체 완료";
}

export function buildImplementationReadinessUserSummary(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
}): ImplementationReadinessUserSummary {
  const plan = input.codeTaskPlan;
  const summary = plan?.llmRefinementSummary;
  const timelineMetrics = extractLlmRefinementMetricsFromTimeline(input.timelineEntries);

  const codeTaskCount = plan?.codeTaskCount ?? plan?.tasks.length ?? 0;
  const llmRefinedTaskCount =
    summary?.llmRefinedTaskCount ?? plan?.tasks.filter((t) => t.refinementSource === "llm").length ?? 0;
  const fallbackTaskCount =
    summary?.fallbackTaskCount ??
    (codeTaskCount > 0 ? Math.max(0, codeTaskCount - llmRefinedTaskCount) : 0);

  const refinementStatus = String(plan?.refinementStatus ?? "heuristic_only");
  const concurrency = summary?.concurrency ?? timelineMetrics.concurrency;
  const elapsedMs = summary?.elapsedMs ?? timelineMetrics.elapsedMs;

  return {
    codeTaskCount,
    llmRefinedTaskCount,
    fallbackTaskCount,
    totalBatches: summary?.totalBatches,
    concurrency,
    elapsedMs,
    refinementStatus,
    statusLabel: resolveStatusLabel(refinementStatus, llmRefinedTaskCount, fallbackTaskCount),
    ...(elapsedMs != null ? { elapsedLabel: formatElapsedMs(elapsedMs) } : {}),
  };
}

export function formatImplementationReadinessIntroLines(
  userSummary: ImplementationReadinessUserSummary,
): readonly string[] {
  if (userSummary.llmRefinedTaskCount === 0 && userSummary.fallbackTaskCount > 0) {
    return ["LLM 정제는 실패하여 기본 규칙 기반 CodeTask로 대체되었습니다."];
  }
  if (
    userSummary.llmRefinedTaskCount > 0 &&
    userSummary.fallbackTaskCount > 0 &&
    userSummary.refinementStatus === "llm_partial_refined"
  ) {
    return ["일부 CodeTask는 기본 규칙 기반으로 대체되었습니다."];
  }
  return [];
}

export function formatCodeTaskLlmRefinementSummaryLines(
  userSummary: ImplementationReadinessUserSummary,
): readonly string[] {
  const lines = [
    "CodeTask LLM 정제:",
    `- 전체 CodeTask: ${userSummary.codeTaskCount}개`,
    `- LLM 정제: ${userSummary.llmRefinedTaskCount}개`,
    `- Fallback: ${userSummary.fallbackTaskCount}개`,
  ];
  if (userSummary.totalBatches != null) {
    lines.push(`- Batch: ${userSummary.totalBatches}개`);
  }
  if (userSummary.concurrency != null) {
    lines.push(`- 병렬 처리: ${userSummary.concurrency}개씩`);
  }
  if (userSummary.elapsedLabel) {
    lines.push(`- 소요 시간: ${userSummary.elapsedLabel}`);
  }
  lines.push(`- 상태: ${userSummary.statusLabel}`);
  return lines;
}

export function formatCodeTaskLlmRefinementSummaryFromPlan(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly timelineEntries?: readonly RequirementsPromptTimelineEntry[];
}): readonly string[] {
  if (!input.codeTaskPlan) return [];
  const userSummary = buildImplementationReadinessUserSummary(input);
  return formatCodeTaskLlmRefinementSummaryLines(userSummary);
}
