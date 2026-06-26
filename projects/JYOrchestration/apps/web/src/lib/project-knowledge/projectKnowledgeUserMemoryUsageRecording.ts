import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { isAgentMemoryEnabledInControl } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryTimelineSummary } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import type { UserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import {
  buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries,
  promptTimelineEntryIdFromEntry,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export async function recordSingleChatUserMemoryUsageForProject(input: {
  readonly projectId: string;
  readonly userId: string;
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly memoryControlEnabled: boolean;
  readonly summaries: readonly UserProjectKnowledgeMemoryTimelineSummary[];
  readonly byAgent?: Readonly<Partial<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>>;
  readonly promptTrace: RequirementsPromptTimelineEntry;
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid || !input.summaries.length) return;

  const { appendUserProjectKnowledgeMemoryUsageEventsForProject } = await import(
    "@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence"
  );

  const promptSectionMarkdownByAgent = {} as Partial<Record<ProjectKnowledgeAgent, string>>;
  if (input.byAgent) {
    for (const [agent, ctx] of Object.entries(input.byAgent) as [
      ProjectKnowledgeAgent,
      UserProjectKnowledgeAgentPromptContext | undefined,
    ][]) {
      if (ctx?.markdown?.trim()) promptSectionMarkdownByAgent[agent] = ctx.markdown;
    }
  }

  const events = buildUserProjectKnowledgeMemoryUsageEventsFromTimelineSummaries({
    projectId: pid,
    userId: input.userId,
    surface: "single_chat",
    summaries: input.summaries,
    controlEnabled: input.memoryControlEnabled,
    isAgentEnabled: (agent) => isAgentMemoryEnabledInControl(input.control, agent),
    promptSectionMarkdownByAgent,
    promptTimelineEntryId: promptTimelineEntryIdFromEntry({
      createdAt: input.promptTrace.createdAt,
      action: input.promptTrace.action,
    }),
    nowIso: input.promptTrace.createdAt,
  });

  if (!events.length) return;
  await appendUserProjectKnowledgeMemoryUsageEventsForProject({ projectId: pid, events });
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

  const { appendUserProjectKnowledgeMemoryUsageEventsForProject } = await import(
    "@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence"
  );

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
  await appendUserProjectKnowledgeMemoryUsageEventsForProject({ projectId: pid, events });
}
