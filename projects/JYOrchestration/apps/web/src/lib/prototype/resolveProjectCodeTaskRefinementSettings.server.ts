import { resolveLlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import {
  type ProjectCodeTaskRefinementSettings,
  MISSING_SERVER_REFINEMENT_SETTINGS,
} from "@/lib/prototype/resolveProjectCodeTaskRefinementSettingsShared";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";

export type { ProjectCodeTaskRefinementSettings } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettingsShared";

export async function resolveProjectCodeTaskRefinementSettings(input: {
  readonly projectId: string;
  readonly actorUserId?: string | null;
}): Promise<ProjectCodeTaskRefinementSettings> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return MISSING_SERVER_REFINEMENT_SETTINGS;
  }

  let setup: {
    enableLlmCodeTaskRefinement?: boolean | null;
  } | null = null;
  try {
    setup = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({
        where: { projectId },
        select: {
          enableLlmCodeTaskRefinement: true,
        },
      }),
    );
  } catch {
    setup = null;
  }

  const providerContext = await resolveLlmCodeTaskRefinementProviderContext({
    projectId,
    actorUserId: input.actorUserId ?? null,
  });

  return {
    enableLlmCodeTaskRefinement: setup?.enableLlmCodeTaskRefinement === true,
    hasOpenaiPlannerApiKey: Boolean(String(providerContext.apiKey ?? "").trim()),
    providerSource: providerContext.providerSource ?? "none",
  };
}

export async function resolveQuickDesignLlmServerContext(input: {
  readonly projectId: string;
  readonly actorUserId: string;
}): Promise<
  Readonly<{
    refinementSettings: ProjectCodeTaskRefinementSettings;
    providerContext: Awaited<ReturnType<typeof resolveLlmCodeTaskRefinementProviderContext>>;
  }>
> {
  const [refinementSettings, providerContext] = await Promise.all([
    resolveProjectCodeTaskRefinementSettings({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
    }),
    resolveLlmCodeTaskRefinementProviderContext({
      projectId: input.projectId,
      actorUserId: input.actorUserId,
    }),
  ]);
  return { refinementSettings, providerContext };
}
