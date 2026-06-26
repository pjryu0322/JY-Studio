import { createHash, randomUUID } from "crypto";
import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { UserProjectKnowledgeMemoryTimelineSummary } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import {
  DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_MAX_EVENTS,
  USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_EVENT_VERSION,
  USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION,
  type UserProjectKnowledgeMemoryUsageEventV1,
  type UserProjectKnowledgeMemoryUsageOutcome,
  type UserProjectKnowledgeMemoryUsageStateV1,
  type UserProjectKnowledgeMemoryUsageSummaryV1,
  type UserProjectKnowledgeMemoryUsageSurface,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageTypes";

export function hashUserIdForMemoryUsage(userId: string | null | undefined): string | undefined {
  const uid = String(userId ?? "").trim();
  if (!uid) return undefined;
  return createHash("sha256").update(uid).digest("hex").slice(0, 16);
}

export function hashPromptSectionForMemoryUsage(markdown: string | null | undefined): string | undefined {
  const text = String(markdown ?? "").trim();
  if (!text) return undefined;
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

export function usageEventDedupeKey(
  event: Pick<
    UserProjectKnowledgeMemoryUsageEventV1,
    "surface" | "agent" | "promptTimelineEntryId" | "codeTaskId" | "runId"
  >,
): string {
  return [
    event.surface,
    event.agent,
    String(event.promptTimelineEntryId ?? ""),
    String(event.codeTaskId ?? ""),
    String(event.runId ?? ""),
  ].join("|");
}

function buildUsageEventId(input: {
  readonly at: string;
  readonly surface: UserProjectKnowledgeMemoryUsageSurface;
  readonly agent: ProjectKnowledgeAgent;
  readonly dedupeKey: string;
}): string {
  return createHash("sha256")
    .update(`${input.at}|${input.surface}|${input.agent}|${input.dedupeKey}|${randomUUID()}`)
    .digest("hex")
    .slice(0, 24);
}

export function resolveMemoryUsageOutcome(input: {
  readonly controlEnabled: boolean;
  readonly agentEnabled: boolean;
  readonly summary: Pick<UserProjectKnowledgeMemoryTimelineSummary, "itemCount" | "injected">;
}): UserProjectKnowledgeMemoryUsageOutcome {
  if (!input.controlEnabled) return "skipped_disabled";
  if (!input.agentEnabled) return "skipped_agent_disabled";
  if (input.summary.itemCount <= 0 || !input.summary.injected) return "skipped_empty";
  return "injected";
}

export function buildUserProjectKnowledgeMemoryUsageEvent(input: {
  readonly projectId: string;
  readonly userId?: string | null;
  readonly surface: UserProjectKnowledgeMemoryUsageSurface;
  readonly agent: ProjectKnowledgeAgent;
  readonly outcome: UserProjectKnowledgeMemoryUsageOutcome;
  readonly itemCount: number;
  readonly sourceProjectCount: number;
  readonly controlEnabled: boolean;
  readonly agentEnabled: boolean;
  readonly promptSectionMarkdown?: string | null;
  readonly promptTimelineEntryId?: string | null;
  readonly codeTaskId?: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
}): UserProjectKnowledgeMemoryUsageEventV1 {
  const at = input.nowIso ?? new Date().toISOString();
  const promptTimelineEntryId = String(input.promptTimelineEntryId ?? "").trim() || undefined;
  const codeTaskId = String(input.codeTaskId ?? "").trim() || undefined;
  const runId = String(input.runId ?? "").trim() || undefined;
  const dedupeKey = usageEventDedupeKey({
    surface: input.surface,
    agent: input.agent,
    promptTimelineEntryId,
    codeTaskId,
    runId,
  });

  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_EVENT_VERSION,
    id: buildUsageEventId({ at, surface: input.surface, agent: input.agent, dedupeKey }),
    at,
    projectId: input.projectId.trim(),
    userIdHash: hashUserIdForMemoryUsage(input.userId),
    surface: input.surface,
    agent: input.agent,
    outcome: input.outcome,
    itemCount: Math.max(0, Math.floor(input.itemCount)),
    sourceProjectCount: Math.max(0, Math.floor(input.sourceProjectCount)),
    controlEnabled: input.controlEnabled,
    agentEnabled: input.agentEnabled,
    promptSectionHash: hashPromptSectionForMemoryUsage(input.promptSectionMarkdown),
    ...(promptTimelineEntryId ? { promptTimelineEntryId } : {}),
    ...(codeTaskId ? { codeTaskId } : {}),
    ...(runId ? { runId } : {}),
  };
}

export function buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries(input: {
  readonly projectId: string;
  readonly userId?: string | null;
  readonly surface: UserProjectKnowledgeMemoryUsageSurface;
  readonly summaries: readonly UserProjectKnowledgeMemoryTimelineSummary[];
  readonly controlEnabled: boolean;
  readonly isAgentEnabled: (agent: ProjectKnowledgeAgent) => boolean;
  readonly promptSectionMarkdownByAgent?: Readonly<Partial<Record<ProjectKnowledgeAgent, string>>>;
  readonly promptTimelineEntryId?: string | null;
  readonly codeTaskId?: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
}): readonly UserProjectKnowledgeMemoryUsageEventV1[] {
  const events: UserProjectKnowledgeMemoryUsageEventV1[] = [];
  for (const summary of input.summaries) {
    const agent = summary.agent;
    const agentEnabled = input.isAgentEnabled(agent);
    const outcome = resolveMemoryUsageOutcome({
      controlEnabled: input.controlEnabled,
      agentEnabled,
      summary,
    });
    events.push(
      buildUserProjectKnowledgeMemoryUsageEvent({
        projectId: input.projectId,
        userId: input.userId,
        surface: input.surface,
        agent,
        outcome,
        itemCount: summary.itemCount,
        sourceProjectCount: summary.sourceProjectCount,
        controlEnabled: input.controlEnabled,
        agentEnabled,
        promptSectionMarkdown: input.promptSectionMarkdownByAgent?.[agent],
        promptTimelineEntryId: input.promptTimelineEntryId,
        codeTaskId: input.codeTaskId,
        runId: input.runId,
        nowIso: input.nowIso,
      }),
    );
  }
  return events;
}

function parseUsageEvent(raw: unknown): UserProjectKnowledgeMemoryUsageEventV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_EVENT_VERSION) return null;
  const agent = String(o.agent ?? "").trim();
  if (
    agent !== "planner" &&
    agent !== "analyst" &&
    agent !== "developer" &&
    agent !== "reviewer" &&
    agent !== "security"
  ) {
    return null;
  }
  const surface = o.surface === "single_chat" || o.surface === "codetask_prompt" ? o.surface : null;
  if (!surface) return null;
  const outcome = o.outcome;
  if (
    outcome !== "injected" &&
    outcome !== "skipped_disabled" &&
    outcome !== "skipped_empty" &&
    outcome !== "skipped_agent_disabled" &&
    outcome !== "failed"
  ) {
    return null;
  }
  const id = String(o.id ?? "").trim();
  const at = String(o.at ?? "").trim();
  const projectId = String(o.projectId ?? "").trim();
  if (!id || !at || !projectId) return null;

  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_EVENT_VERSION,
    id,
    at,
    projectId,
    ...(typeof o.userIdHash === "string" && o.userIdHash.trim() ? { userIdHash: o.userIdHash.trim() } : {}),
    surface,
    agent,
    outcome,
    itemCount:
      typeof o.itemCount === "number" && Number.isFinite(o.itemCount)
        ? Math.max(0, Math.floor(o.itemCount))
        : 0,
    sourceProjectCount:
      typeof o.sourceProjectCount === "number" && Number.isFinite(o.sourceProjectCount)
        ? Math.max(0, Math.floor(o.sourceProjectCount))
        : 0,
    controlEnabled: Boolean(o.controlEnabled),
    agentEnabled: o.agentEnabled !== false,
    ...(typeof o.promptSectionHash === "string" && o.promptSectionHash.trim()
      ? { promptSectionHash: o.promptSectionHash.trim().slice(0, 64) }
      : {}),
    ...(typeof o.promptTimelineEntryId === "string" && o.promptTimelineEntryId.trim()
      ? { promptTimelineEntryId: o.promptTimelineEntryId.trim().slice(0, 120) }
      : {}),
    ...(typeof o.codeTaskId === "string" && o.codeTaskId.trim()
      ? { codeTaskId: o.codeTaskId.trim().slice(0, 64) }
      : {}),
    ...(typeof o.runId === "string" && o.runId.trim() ? { runId: o.runId.trim().slice(0, 64) } : {}),
  };
}

export function parseUserProjectKnowledgeMemoryUsageStateV1(
  raw: unknown,
): UserProjectKnowledgeMemoryUsageStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION) return null;
  const events = Array.isArray(o.events)
    ? o.events.map(parseUsageEvent).filter((x): x is UserProjectKnowledgeMemoryUsageEventV1 => x != null)
    : [];
  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION,
    events,
    ...(typeof o.updatedAt === "string" && o.updatedAt.trim() ? { updatedAt: o.updatedAt.trim() } : {}),
  };
}

export function normalizeUserProjectKnowledgeMemoryUsageStateV1(
  raw: unknown,
): UserProjectKnowledgeMemoryUsageStateV1 {
  const parsed = parseUserProjectKnowledgeMemoryUsageStateV1(raw);
  if (parsed) return parsed;
  return { version: USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION, events: [] };
}

export function appendUserProjectKnowledgeMemoryUsageEvent(input: {
  readonly current: unknown;
  readonly event: UserProjectKnowledgeMemoryUsageEventV1;
  readonly maxEvents?: number;
}): UserProjectKnowledgeMemoryUsageStateV1 {
  return appendUserProjectKnowledgeMemoryUsageEvents({
    current: input.current,
    events: [input.event],
    maxEvents: input.maxEvents,
  });
}

export function appendUserProjectKnowledgeMemoryUsageEvents(input: {
  readonly current: unknown;
  readonly events: readonly UserProjectKnowledgeMemoryUsageEventV1[];
  readonly maxEvents?: number;
}): UserProjectKnowledgeMemoryUsageStateV1 {
  const maxEvents = input.maxEvents ?? DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_MAX_EVENTS;
  const base = normalizeUserProjectKnowledgeMemoryUsageStateV1(input.current);
  const seenId = new Set(base.events.map((e) => e.id));
  const seenDedupe = new Set(base.events.map((e) => usageEventDedupeKey(e)));
  const merged = [...base.events];

  for (const event of input.events) {
    const dedupe = usageEventDedupeKey(event);
    if (seenId.has(event.id) || seenDedupe.has(dedupe)) continue;
    seenId.add(event.id);
    seenDedupe.add(dedupe);
    merged.push(event);
  }

  const trimmed =
    merged.length > maxEvents ? merged.slice(merged.length - maxEvents) : merged;

  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION,
    events: trimmed,
    updatedAt: new Date().toISOString(),
  };
}

function emptyAgentUsageSummary(): UserProjectKnowledgeMemoryUsageSummaryV1["byAgent"][ProjectKnowledgeAgent] {
  return { injectedCount: 0, lastItemCount: 0 };
}

export function summarizeUserProjectKnowledgeMemoryUsage(input: {
  readonly state: unknown;
  readonly limit?: number;
}): UserProjectKnowledgeMemoryUsageSummaryV1 {
  const normalized = normalizeUserProjectKnowledgeMemoryUsageStateV1(input.state);
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 10)));
  const byAgent = {} as UserProjectKnowledgeMemoryUsageSummaryV1["byAgent"];
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    byAgent[agent] = emptyAgentUsageSummary();
  }

  let injectedEvents = 0;
  let skippedEvents = 0;

  for (const event of normalized.events) {
    if (event.outcome === "injected") {
      injectedEvents += 1;
      const row = byAgent[event.agent];
      byAgent[event.agent] = {
        injectedCount: row.injectedCount + 1,
        lastUsedAt: event.at,
        lastItemCount: event.itemCount,
      };
    } else {
      skippedEvents += 1;
    }
  }

  const recentEvents = normalized.events.slice(-limit).reverse();

  return {
    totalEvents: normalized.events.length,
    injectedEvents,
    skippedEvents,
    byAgent,
    recentEvents,
  };
}

export function sanitizeUserProjectKnowledgeMemoryUsageSummaryForApi(
  summary: UserProjectKnowledgeMemoryUsageSummaryV1,
): UserProjectKnowledgeMemoryUsageSummaryV1 {
  return {
    ...summary,
    recentEvents: summary.recentEvents.map((event) => {
      const { projectId: _p, userIdHash: _u, ...rest } = event;
      return rest as UserProjectKnowledgeMemoryUsageEventV1;
    }),
  };
}

export function promptTimelineEntryIdFromEntry(input: {
  readonly createdAt?: string;
  readonly action?: string;
}): string {
  const at = String(input.createdAt ?? "").trim();
  const action = String(input.action ?? "").trim();
  if (!at && !action) return createHash("sha256").update(randomUUID()).digest("hex").slice(0, 20);
  return createHash("sha256").update(`${at}|${action}`).digest("hex").slice(0, 24);
}
