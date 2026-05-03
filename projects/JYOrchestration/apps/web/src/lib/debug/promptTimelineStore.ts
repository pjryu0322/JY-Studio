import { randomUUID } from "node:crypto";
import type {
  FeaturePlanningPromptLogStatus,
  FeaturePlanningPromptPurpose,
} from "@/lib/debug/featurePlanningPromptPurpose";
import type { FeaturePlanningPromptMetricsV1, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";

const MAX_BODY = 12_000;
const MAX_PER_PROJECT = 80;

export type { PromptTimelineChannel, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";

function trunc(s: string, max = MAX_BODY): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n…(이하 생략, ${t.length}자)`;
}

const byProject = new Map<string, PromptTimelineEntry[]>();

function push(projectId: string, entry: PromptTimelineEntry): void {
  const id = projectId.trim();
  if (!id) return;
  const list = byProject.get(id) ?? [];
  list.push(entry);
  while (list.length > MAX_PER_PROJECT) list.shift();
  byProject.set(id, list);
}

export function getPromptTimelineEntries(projectId: string): readonly PromptTimelineEntry[] {
  const id = projectId.trim();
  if (!id) return [];
  return [...(byProject.get(id) ?? [])].reverse();
}

/** 기능정리 OpenAI 호출 — projectId 고정, purpose·상태·JSON 미리보기 포함 */
export function recordFeaturePlanningOpenAi(input: {
  readonly projectId: string;
  readonly purpose: FeaturePlanningPromptPurpose;
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly status: FeaturePlanningPromptLogStatus;
  readonly responseText?: string;
  readonly parsedJson?: string;
  readonly errorMessage?: string;
  readonly promptMetrics?: FeaturePlanningPromptMetricsV1 | null;
}): void {
  const pid = input.projectId.trim();
  if (!pid) return;
  const metricsLine =
    input.promptMetrics && Object.keys(input.promptMetrics).length ?
      `\n\n---\n\n[promptMetrics]\n${trunc(JSON.stringify(input.promptMetrics), 2000)}`
    : "";
  const outbound = [`purpose=${input.purpose}`, `[system]\n${trunc(input.systemPrompt)}`, `[user]\n${trunc(input.userPrompt)}${metricsLine}`].join(
    "\n\n---\n\n"
  );
  const preview = input.parsedJson ? trunc(input.parsedJson, 6000) : null;
  const inbound =
    input.status === "SUCCESS"
      ? [`[response]\n${trunc(input.responseText ?? "")}`, preview ? `[parsedJson]\n${preview}` : ""].filter(Boolean).join("\n\n")
      : `[FAILED]\n${trunc(input.errorMessage ?? "unknown")}`;
  push(pid, {
    id: `fp_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    at: new Date().toISOString(),
    channel: "openai",
    label: `기능정리 · ${input.purpose}`,
    model: input.model,
    outbound,
    inbound,
    purpose: input.purpose,
    status: input.status,
    errorMessage: input.status === "FAILED" ? (input.errorMessage ?? null) : null,
    parsedJsonPreview: preview,
    promptMetrics: input.promptMetrics ?? null,
  });
}

export function recordCursorAgentLaunch(input: {
  readonly projectId: string;
  readonly label: string;
  readonly promptText: string;
  readonly launchUrl: string;
  readonly httpStatus?: number;
  readonly ok: boolean;
  readonly agentId?: string;
  readonly error?: string;
  readonly responseSnippet?: string;
}): void {
  const outbound = [`POST ${input.launchUrl}`, `[prompt]\n${trunc(input.promptText)}`].join("\n\n");
  const inbound = input.ok
    ? `[응답 OK] agentId=${input.agentId ?? "(없음)"}\n${trunc(input.responseSnippet ?? "")}`
    : `[실패] HTTP ${input.httpStatus ?? "?"}: ${trunc(input.error ?? "")}`;
  push(input.projectId, {
    id: `cr_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    at: new Date().toISOString(),
    channel: "cursor",
    label: input.label,
    model: null,
    outbound,
    inbound,
  });
}
