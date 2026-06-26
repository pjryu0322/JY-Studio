import {
  buildReferencePromptContextForProjectTurn,
  wrapReferenceContextForOrchestrationLlm,
} from "@/lib/project-knowledge/projectKnowledgeReferencePromptContext";
import type { CodeTaskDeveloperPromptAugmentation } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import {
  developerUserProjectKnowledgeMemoryTimelineSummary,
  type UserProjectKnowledgeMemoryTimelineSummary,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import { prepareSameUserProjectKnowledgeMemoryPromptContexts } from "@/lib/project-knowledge/projectKnowledgeUserMemoryService";
import { loadUserProjectKnowledgeMemoryControlForProject } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";

export type PreparedCodeTaskDeveloperPromptAugmentation = Readonly<{
  readonly augmentation: CodeTaskDeveloperPromptAugmentation;
  readonly developerMemoryTimeline: UserProjectKnowledgeMemoryTimelineSummary | null;
  readonly memoryControlEnabled: boolean;
  readonly control: UserProjectKnowledgeMemoryControlV1 | null;
}>;

export async function prepareCodeTaskDeveloperPromptAugmentation(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly projectName?: string;
  readonly projectDescription?: string;
}): Promise<PreparedCodeTaskDeveloperPromptAugmentation> {
  const userId = input.userId.trim();
  const targetProjectId = input.targetProjectId.trim();
  if (!userId || !targetProjectId) {
    return {
      augmentation: {},
      developerMemoryTimeline: null,
      memoryControlEnabled: true,
      control: null,
    };
  }

  const control = await loadUserProjectKnowledgeMemoryControlForProject(targetProjectId);

  const [referenceSection, memoryPrepared] = await Promise.all([
    buildReferencePromptContextForProjectTurn({
      projectId: targetProjectId,
      userMessage: "",
      projectName: input.projectName,
      projectDescription: input.projectDescription,
    }),
    prepareSameUserProjectKnowledgeMemoryPromptContexts({
      userId,
      targetProjectId,
      control,
    }),
  ]);

  const referencePromptContextBlock = referenceSection.hasReference
    ? wrapReferenceContextForOrchestrationLlm(referenceSection.promptText)
    : "";
  const developerMemoryContext = memoryPrepared.byAgent.developer;

  return {
    augmentation: {
      referencePromptContextBlock: referencePromptContextBlock || undefined,
      developerMemoryContext,
    },
    developerMemoryTimeline: developerUserProjectKnowledgeMemoryTimelineSummary(developerMemoryContext),
    memoryControlEnabled: memoryPrepared.memoryControlEnabled,
    control,
  };
}
