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

export async function loadUserProjectKnowledgeMemoryPanel(input: {
  readonly projectId: string;
  readonly userId: string;
}): Promise<{
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly preview: UserProjectKnowledgeMemoryPreviewV1;
  readonly usageSummary: UserProjectKnowledgeMemoryUsageApiSummaryV1;
}> {
  const projectId = input.projectId.trim();
  const control = await loadUserProjectKnowledgeMemoryControlForProject(projectId);
  const preview = await buildUserProjectKnowledgeMemoryPreview({
    userId: input.userId,
    targetProjectId: projectId,
    control,
  });
  const usageState = await loadUserProjectKnowledgeMemoryUsageStateForProject(projectId);
  const usageSummary = sanitizeUserProjectKnowledgeMemoryUsageSummaryForApi(
    summarizeUserProjectKnowledgeMemoryUsage({ state: usageState, limit: 10 }),
  );
  return { control, preview, usageSummary };
}
