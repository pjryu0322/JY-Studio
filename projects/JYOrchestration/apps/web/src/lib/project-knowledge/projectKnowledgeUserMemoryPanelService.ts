import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { buildUserProjectKnowledgeMemoryPreview } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import type { UserProjectKnowledgeMemoryPreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import { loadUserProjectKnowledgeMemoryControlForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";
import {
  sanitizeUserProjectKnowledgeMemoryUsageSummaryForApi,
  summarizeUserProjectKnowledgeMemoryUsage,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsage";
import type { UserProjectKnowledgeMemoryUsageApiSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageTypes";
import { loadUserProjectKnowledgeMemoryUsageStateForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence";
import { buildUserProjectKnowledgeMemoryStalePreviewFromSources } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleService";
import type { UserProjectKnowledgeMemoryStalePreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleTypes";
import { PROJECT_KNOWLEDGE_AGENTS } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

export async function loadUserProjectKnowledgeMemoryPanel(input: {
  readonly projectId: string;
  readonly userId: string;
}): Promise<{
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly preview: UserProjectKnowledgeMemoryPreviewV1;
  readonly usageSummary: UserProjectKnowledgeMemoryUsageApiSummaryV1;
  readonly stalePreview: UserProjectKnowledgeMemoryStalePreviewV1;
}> {
  const projectId = input.projectId.trim();
  const control = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
  const preview = await buildUserProjectKnowledgeMemoryPreview({
    userId: input.userId,
    targetProjectId: projectId,
    control,
  });
  const usageState = await loadUserProjectKnowledgeMemoryUsageStateForProject(projectId);
  const usageSummaryRaw = summarizeUserProjectKnowledgeMemoryUsage({ state: usageState, limit: 20 });
  const usageSummary = sanitizeUserProjectKnowledgeMemoryUsageSummaryForApi(
    summarizeUserProjectKnowledgeMemoryUsage({ state: usageState, limit: 10 }),
  );
  const agentLastUsedAt = {} as Partial<Record<(typeof PROJECT_KNOWLEDGE_AGENTS)[number], string>>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    const at = usageSummaryRaw.byAgent[agent].lastUsedAt;
    if (at) agentLastUsedAt[agent] = at;
  }
  const stalePreview = buildUserProjectKnowledgeMemoryStalePreviewFromSources({
    preview,
    agentLastUsedAt,
  });
  return { control, preview, usageSummary, stalePreview };
}
