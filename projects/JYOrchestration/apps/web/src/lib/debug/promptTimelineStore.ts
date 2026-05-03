import { randomUUID } from "node:crypto";
import { getPromptTimelineProjectId, isPromptTimelineDebugServer } from "@/lib/debug/promptTimelineDebug";
import type { PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";

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
  if (!isPromptTimelineDebugServer()) return;
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

export function recordOpenAiJsonChatRound(input: {
  readonly projectId: string;
  readonly label: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly ok: boolean;
  readonly assistantText?: string;
  readonly errorMessage?: string;
}): void {
  if (!isPromptTimelineDebugServer()) return;
  const outbound = [`[system]\n${trunc(input.system)}`, `[user]\n${trunc(input.user)}`].join("\n\n---\n\n");
  const inbound = input.ok
    ? `[assistant]\n${trunc(input.assistantText ?? "")}`
    : `[error]\n${trunc(input.errorMessage ?? "unknown")}`;
  push(input.projectId, {
    id: `oa_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    at: new Date().toISOString(),
    channel: "openai",
    label: input.label,
    model: input.model,
    outbound,
    inbound,
  });
}

/** AsyncLocalStorage에 projectId가 있을 때만 기록 (요청 범위 한정). */
export function recordOpenAiJsonChatRoundFromContext(input: {
  readonly label: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly ok: boolean;
  readonly assistantText?: string;
  readonly errorMessage?: string;
}): void {
  const projectId = getPromptTimelineProjectId();
  if (!projectId) return;
  recordOpenAiJsonChatRound({
    projectId,
    label: input.label,
    model: input.model,
    system: input.system,
    user: input.user,
    ok: input.ok,
    assistantText: input.assistantText,
    errorMessage: input.errorMessage,
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
  if (!isPromptTimelineDebugServer()) return;
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
