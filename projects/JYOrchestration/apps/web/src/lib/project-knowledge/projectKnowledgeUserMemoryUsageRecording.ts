import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { isAgentMemoryEnabledInControl } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  buildUserProjectKnowledgeMemoryTimelineSummaries,
  type UserProjectKnowledgeMemoryTimelineSummary,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import type { UserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import type { prepareSameUserProjectKnowledgeMemoryPromptContexts } from "@/lib/project-knowledge/projectKnowledgeUserMemoryService";
import {
  buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries,
  promptTimelineEntryIdFromEntry,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import { appendUserProjectKnowledgeMemoryUsageEventsForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type PreparedUserProjectKnowledgeMemoryPromptContexts = Awaited<
  ReturnType<typeof prepareSameUserProjectKnowledgeMemoryPromptContexts>
>;

export type AppendUserProjectKnowledgeMemoryUsageEventsForProject = typeof appendUserProjectKnowledgeMemoryUsageEventsForProject;

export async function recordSingleChatUserMemoryUsageFromPreparedContext(input: {
  readonly projectId?: string | null;
  readonly userId: string;
  readonly prepared: PreparedUserProjectKnowledgeMemoryPromptContexts | null;
  readonly control: UserProjectKnowledgeMemoryControlV1 | null;
  readonly summaries?: readonly UserProjectKnowledgeMemoryTimelineSummary[];
  readonly byAgent?: Readonly<Partial<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>>;
  readonly promptTrace: RequirementsPromptTimelineEntry | null;
  readonly recorder?: AppendUserProjectKnowledgeMemoryUsageEventsForProject;
}): Promise<boolean> {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) return false;
  if (!input.prepared) return false;
  if (!input.control) return false;
  if (!input.promptTrace) return false;

  const summaries =
    input.summaries ??
    buildUserProjectKnowledgeMemoryTimelineSummaries(input.prepared.byAgent);
  if (!summaries.length) return false;

  const byAgent = input.byAgent ?? input.prepared.byAgent;
  const recorder = input.recorder ?? appendUserProjectKnowledgeMemoryUsageEventsForProject;

  const promptSectionMarkdownByAgent = {} as Partial<Record<ProjectKnowledgeAgent, string>>;
  for (const [agent, ctx] of Object.entries(byAgent) as [
    ProjectKnowledgeAgent,
    UserProjectKnowledgeAgentPromptContext | undefined,
  ][]) {
    if (ctx?.markdown?.trim()) promptSectionMarkdownByAgent[agent] = ctx.markdown;
  }

  const events = buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries({
    projectId,
    userId: input.userId,
    surface: "single_chat",
    summaries,
    controlEnabled: input.prepared.memoryControlEnabled,
    isAgentEnabled: (agent) => isAgentMemoryEnabledInControl(input.control!, agent),
    promptSectionMarkdownByAgent,
    promptTimelineEntryId: promptTimelineEntryIdFromEntry({
      createdAt: input.promptTrace.createdAt,
      action: input.promptTrace.action,
    }),
    nowIso: input.promptTrace.createdAt,
  });

  if (!events.length) return false;
  await recorder({ projectId, events });
  return true;
}

export async function recordSingleChatUserMemoryUsageForProject(input: {
  readonly projectId: string;
  readonly userId: string;
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly memoryControlEnabled: boolean;
  readonly summaries: readonly UserProjectKnowledgeMemoryTimelineSummary[];
  readonly byAgent?: Readonly<Partial<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>>;
  readonly promptTrace: RequirementsPromptTimelineEntry;
  readonly prepared?: PreparedUserProjectKnowledgeMemoryPromptContexts;
}): Promise<void> {
  const prepared =
    input.prepared ??
    ({
      byAgent: (input.byAgent ?? {}) as PreparedUserProjectKnowledgeMemoryPromptContexts["byAgent"],
      totalItemCount: 0,
      sourceProjectCount: 0,
      memoryControlEnabled: input.memoryControlEnabled,
    } satisfies PreparedUserProjectKnowledgeMemoryPromptContexts);

  await recordSingleChatUserMemoryUsageFromPreparedContext({
    projectId: input.projectId,
    userId: input.userId,
    prepared,
    control: input.control,
    summaries: input.summaries,
    byAgent: input.byAgent ?? prepared.byAgent,
    promptTrace: input.promptTrace,
  });
}

export function fireAndForgetSingleChatUserMemoryUsage(input: {
  readonly projectId?: string | null;
  readonly userId: string;
  readonly prepared: PreparedUserProjectKnowledgeMemoryPromptContexts | null;
  readonly control: UserProjectKnowledgeMemoryControlV1 | null;
  readonly summaries?: readonly UserProjectKnowledgeMemoryTimelineSummary[];
  readonly promptTrace: RequirementsPromptTimelineEntry | null;
}): void {
  void recordSingleChatUserMemoryUsageFromPreparedContext({
    projectId: input.projectId,
    userId: input.userId,
    prepared: input.prepared,
    control: input.control,
    summaries: input.summaries,
    byAgent: input.prepared?.byAgent,
    promptTrace: input.promptTrace,
  }).catch((err) => {
    console.error("[single_chat_user_memory_usage_record_failed]", err);
  });
}

export async function recordCodeTaskDeveloperMemoryUsageForProject(input: {
  readonly projectId: string;
  readonly userId: string;
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly memoryControlEnabled: boolean;
  readonly developerSummary: UserProjectKnowledgeMemoryTimelineSummary | null | undefined;
  readonly developerContextMarkdown?: string | null;
  readonly codeTaskId: string;
  readonly runId?: string | null;
  readonly nowIso?: string;
  readonly recorder?: AppendUserProjectKnowledgeMemoryUsageEventsForProject;
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid) return;

  const summary =
    input.developerSummary ??
    ({
      kind: "user_project_knowledge_memory_context" as const,
      agent: "developer" as const,
      itemCount: 0,
      sourceProjectCount: 0,
      injected: false,
    } satisfies UserProjectKnowledgeMemoryTimelineSummary);

  const recorder = input.recorder ?? appendUserProjectKnowledgeMemoryUsageEventsForProject;

  const timelineId = promptTimelineEntryIdFromEntry({
    createdAt: input.nowIso,
    action: "task_cursor_prompt_built",
  });

  const events = buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries({
    projectId: pid,
    userId: input.userId,
    surface: "codetask_prompt",
    summaries: [summary],
    controlEnabled: input.memoryControlEnabled,
    isAgentEnabled: (agent) => isAgentMemoryEnabledInControl(input.control, agent),
    promptSectionMarkdownByAgent: input.developerContextMarkdown
      ? { developer: input.developerContextMarkdown }
      : undefined,
    promptTimelineEntryId: timelineId,
    codeTaskId: input.codeTaskId,
    runId: input.runId,
    nowIso: input.nowIso,
  });

  if (!events.length) return;
  await recorder({ projectId: pid, events });
}
