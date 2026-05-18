import { randomUUID } from "node:crypto";
import type {
  FeaturePlanningPromptLogStatus,
  FeaturePlanningPromptPurpose,
} from "@/lib/debug/featurePlanningPromptPurpose";
import type { FeaturePlanningPromptMetricsV1, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";
import { prisma } from "@/lib/prisma";
import { IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";

const MAX_BODY = 12_000;
/** 메신저 로그는 system+최근 대화를 함께 담아 길어질 수 있음 */
const MAX_BODY_MESSENGER = 100_000;
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

function messengerLogRowToEntry(row: {
  id: string;
  createdAt: Date;
  channel: string;
  label: string;
  model: string | null;
  outbound: string;
  inbound: string;
  status: string | null;
  errorMessage: string | null;
}): PromptTimelineEntry {
  const st = String(row.status ?? "").trim();
  const status: FeaturePlanningPromptLogStatus | undefined =
    st === "SUCCESS" || st === "FAILED" ? st : undefined;
  return {
    id: row.id,
    at: row.createdAt.toISOString(),
    channel: row.channel === "cursor" ? "cursor" : "openai",
    label: row.label,
    model: row.model,
    outbound: row.outbound,
    inbound: row.inbound,
    ...(status ? { status } : {}),
    errorMessage: row.errorMessage,
  };
}

export async function listMessengerPromptTimelineEntriesForUser(
  userId: string,
  take = 120
): Promise<PromptTimelineEntry[]> {
  const uid = userId.trim();
  if (!uid) return [];
  const rows = await prisma.messengerPromptTimelineLog.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(messengerLogRowToEntry);
}

export async function listMessengerPromptTimelineEntriesForProject(
  projectId: string,
  take = 80
): Promise<PromptTimelineEntry[]> {
  const pid = projectId.trim();
  if (!pid) return [];
  const rows = await prisma.messengerPromptTimelineLog.findMany({
    where: { projectId: pid },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(messengerLogRowToEntry);
}

/**
 * 메신저 일반/AI 대화방의 Chat Completions 호출을 DB 타임라인에 남긴다(인메모리는 HMR·워커 분리로 비어 보일 수 있음).
 */
export async function recordMessengerOpenAi(input: {
  readonly userId: string;
  readonly roomId: string;
  readonly roomTitle?: string | null;
  readonly projectId?: string | null;
  readonly kind: "messenger_chat" | "messenger_project_draft";
  readonly model: string | null;
  readonly outbound: string;
  readonly ok: boolean;
  readonly replyText?: string;
  readonly error?: string;
}): Promise<void> {
  const uid = input.userId.trim();
  if (!uid) return;
  const roomLabel = String(input.roomTitle ?? "").trim() || input.roomId.trim().slice(0, 10);
  const modeLabel = input.kind === "messenger_project_draft" ? "프로젝트 초안" : "대화 응답";
  const label = `메신저 · ${modeLabel} · ${roomLabel}`;
  const inbound = input.ok
    ? `[response]\n${trunc(input.replyText ?? "")}`
    : `[FAILED]\n${trunc(input.error ?? "unknown")}`;
  const status = input.ok ? "SUCCESS" : "FAILED";
  const rid = input.roomId.trim();
  const pid = String(input.projectId ?? "").trim() || null;
  try {
    await prisma.messengerPromptTimelineLog.create({
      data: {
        userId: uid,
        roomId: rid || null,
        projectId: pid,
        kind: input.kind,
        label,
        channel: "openai",
        model: input.model,
        outbound: trunc(
          input.outbound,
          input.kind === "messenger_chat" || input.kind === "messenger_project_draft" ? MAX_BODY_MESSENGER : MAX_BODY
        ),
        inbound,
        status,
        errorMessage: input.ok ? null : (input.error ?? null),
      },
    });
  } catch (e) {
    console.error("recordMessengerOpenAi", e);
  }
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

export function recordKnowledgePackContextInjection(input: {
  readonly projectId: string;
  readonly agentRole: string;
  readonly recommendedKnowledgePackIds: readonly string[];
  readonly usedKnowledgePackIds: readonly string[];
  readonly contextChars: number;
  readonly mode: string;
  readonly diagnostics: readonly string[];
}): void {
  const pid = input.projectId.trim();
  if (!pid) return;
  const payload = {
    purpose: "KNOWLEDGE_PACK_CONTEXT_INJECTION",
    agentRole: input.agentRole,
    recommendedKnowledgePackIds: [...input.recommendedKnowledgePackIds],
    usedKnowledgePackIds: [...input.usedKnowledgePackIds],
    contextChars: input.contextChars,
    mode: input.mode,
    diagnostics: [...input.diagnostics],
  };
  const outbound = `[KNOWLEDGE_PACK_CONTEXT_INJECTION]\n${trunc(JSON.stringify(payload), 6000)}`;
  const inbound =
    input.contextChars > 0
      ? `주입 완료 · ${input.contextChars}자 · 사용 ${input.usedKnowledgePackIds.length}건`
      : "주입 생략(컨텍스트 없음)";
  push(pid, {
    id: `kp_inj_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    at: new Date().toISOString(),
    channel: "cursor",
    label: "지식팩 · Cursor 프롬프트 컨텍스트",
    model: null,
    outbound,
    inbound,
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

export function recordIdeationBootstrapOpenAi(input: {
  readonly projectId: string;
  readonly model: string | null;
  readonly promptText?: string;
  readonly ok: boolean;
  readonly replyText?: string;
  readonly error?: string;
  readonly fallbackText?: string;
  readonly at?: string;
}): void {
  const pid = input.projectId.trim();
  if (!pid) return;
  const at = input.at ?? new Date().toISOString();
  const outbound = input.promptText ? `[prompt]\n${trunc(input.promptText)}` : "[prompt]\n(없음)";
  const inbound = input.ok
    ? `[response]\n${trunc(input.replyText ?? "")}`
    : [`[FAILED]\n${trunc(input.error ?? "unknown")}`, input.fallbackText ? `\n\n[fallback]\n${trunc(input.fallbackText)}` : ""]
        .filter(Boolean)
        .join("");
  push(pid, {
    id: `id_boot_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    at,
    channel: "openai",
    label: `아이디어 구체화 · ${IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION}`,
    model: input.model,
    outbound,
    inbound,
  });
}
