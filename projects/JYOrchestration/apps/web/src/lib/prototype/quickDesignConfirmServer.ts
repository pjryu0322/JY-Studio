import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  runConfirmQuickDesignForImplementationFromState,
  type ConfirmQuickDesignForImplementationFromStateInput,
  type ConfirmQuickDesignForImplementationResult,
} from "@/lib/prototype/implementationQuickDesignDraftBridge";
import {
  runQuickDesignConfirmFlow,
  buildQuickDesignConfirmPlanningStateSnapshotFromRequirementsState,
  type QuickDesignConfirmFlowResult,
} from "@/lib/requirements/quickDesignConfirmFlow";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  loadPlanningDatabaseSettingsForProject,
  resolvePlanningPostgresPassword,
} from "@/lib/planning/planningDatabaseSettingsService";
import {
  provisionImplementationSampleStore,
} from "@/lib/planning/provisionProjectStageDataStores";
import { prisma } from "@/lib/prisma";
import { resolveQuickDesignLlmServerContext } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettings.server";

async function loadExecutionSetupGitRepoName(projectId: string): Promise<string | null> {
  const row = await prisma.executionSetup.findUnique({
    where: { projectId },
    select: { gitRepoName: true },
  });
  const name = String(row?.gitRepoName ?? "").trim();
  return name || null;
}

export type QuickDesignConfirmServerMode = "implementation" | "planning";

export type QuickDesignConfirmServerInput = Readonly<{
  readonly projectId: string;
  readonly actorUserId: string;
  readonly mode: QuickDesignConfirmServerMode;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson?: unknown;
  readonly conversationMessages: readonly RequirementsMessage[];
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sourceStage?: OrchestrationStage;
  readonly envOkOverride?: boolean;
  readonly gitRepoName?: string | null;
  readonly serviceFlow?: FastPlanGenerationInput["serviceFlow"];
  readonly problemInterview?: FastPlanGenerationInput["problemInterview"];
}>;

export type QuickDesignConfirmServerResult =
  | Readonly<{ readonly success: false; readonly message: string }>
  | Readonly<{
      readonly success: true;
      readonly mode: "implementation";
      readonly result: Extract<ConfirmQuickDesignForImplementationResult, { readonly kind: "success" }>;
    }>
  | Readonly<{
      readonly success: true;
      readonly mode: "planning";
      readonly flow: Extract<QuickDesignConfirmFlowResult, { readonly kind: "success" }>;
    }>;

export async function runQuickDesignConfirmOnServer(
  input: QuickDesignConfirmServerInput,
): Promise<QuickDesignConfirmServerResult> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { success: false, message: "projectId가 필요합니다." };
  }

  const { refinementSettings, providerContext } = await resolveQuickDesignLlmServerContext({
    projectId,
    actorUserId: input.actorUserId,
  });

  if (input.mode === "implementation") {
    const result = await runConfirmQuickDesignForImplementationFromState({
      projectId,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      requirementsStateJson: input.requirementsStateJson ?? {},
      conversationMessages: input.conversationMessages,
      slotDefinitions: input.slotDefinitions,
      sourceStage: input.sourceStage,
      envOkOverride: input.envOkOverride,
      refinementSettings,
      providerContext,
    });
    if (result.kind === "blocked") {
      return { success: false, message: result.message };
    }
    return { success: true, mode: "implementation", result };
  }

  const state =
    input.requirementsStateJson && typeof input.requirementsStateJson === "object"
      ? (input.requirementsStateJson as Record<string, unknown>)
      : {};
  const draft = state.fastPlanDraftV1 as import("@/lib/requirements/fastPlanDraftTypes").FastPlanDraftStateV1 | null | undefined;
  const orchestrationForConfirm = state.singleChatOrchestrationV1 as
    | import("@/lib/requirements/singleChatOrchestrationTypes").RequirementsSingleChatOrchestrationStateV1
    | null
    | undefined;
  if (!draft?.memberDrafts?.length || !orchestrationForConfirm) {
    return { success: false, message: "확정할 Quick Design 초안 정보를 찾을 수 없습니다." };
  }

  const parsedState = parseRequirementsStateJson(input.requirementsStateJson ?? {});
  const [dbSettings, gitRepoNameFromSetup] = await Promise.all([
    loadPlanningDatabaseSettingsForProject(projectId),
    input.gitRepoName ? Promise.resolve(input.gitRepoName) : loadExecutionSetupGitRepoName(projectId),
  ]);
  const planningState = {
    ...buildQuickDesignConfirmPlanningStateSnapshotFromRequirementsState({
      ...parsedState,
      planningDatabaseSettingsV1: dbSettings,
    }),
    featurePlanningSlotsV1:
      parsedState.featurePlanningSlotsV1 ??
      ((state.featurePlanningSlotsV1 as Record<string, unknown> | null) ?? null),
    gitRepoName: gitRepoNameFromSetup,
  };

  const nowIso = new Date().toISOString();
  const flowResult = await runQuickDesignConfirmFlow({
    projectId,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMessages: input.conversationMessages,
    serviceFlow: input.serviceFlow ?? parsedState.serviceFlowV1 ?? (state.serviceFlowV1 as { readonly version?: string } | null) ?? null,
    problemInterview: input.problemInterview ?? null,
    sourceStage: input.sourceStage ?? "IDEATION",
    nowIso,
    fastPlanDraftV1: draft,
    orchestrationForConfirm,
    slotDefinitions: input.slotDefinitions,
    planningState,
    envOkOverride: input.envOkOverride,
    refinementSettings,
    providerContext,
  });

  if (flowResult.kind === "blocked") {
    return { success: false, message: flowResult.message };
  }

  let flow = flowResult;
  const handoff = flowResult.prep.planningHandoffForImplementationV1;
  if (
    flowResult.prep.prepComplete &&
    handoff?.implementationDataPlan.dataPersistenceMode === "POSTGRES_SAMPLE_DB"
  ) {
    const provisionNow = new Date().toISOString();
    const [password] = await Promise.all([resolvePlanningPostgresPassword(projectId)]);
    const provision = await provisionImplementationSampleStore({
      projectId,
      planningDataSlotsV1: flowResult.statePatch.planningDataSlotsV1 ?? null,
      settings: dbSettings,
      password,
      nowIso: provisionNow,
    });
    if (provision.planningDataSlotsV1) {
      flow = {
        ...flowResult,
        statePatch: {
          ...flowResult.statePatch,
          planningDataSlotsV1: provision.planningDataSlotsV1,
        },
        timelineEntries: provision.timelineEntry
          ? [...flowResult.timelineEntries, provision.timelineEntry]
          : flowResult.timelineEntries,
      };
    }
    if (!provision.ok) {
      return {
        success: false,
        message: `구현단계 샘플 저장소 생성에 실패했습니다. ${provision.message}`,
      };
    }
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { requirementsStateJson: true },
      });
      const parsed = parseRequirementsStateJson(project?.requirementsStateJson);
      const merged = {
        ...parsed,
        ...flow.statePatch,
        promptTimeline: [
          ...(parsed.promptTimeline ?? []),
          ...(flow.timelineEntries ?? []),
        ],
      };
      await prisma.project.update({
        where: { id: projectId },
        data: { requirementsStateJson: merged as object },
      });
    } catch {
      // confirm response still returns flow patch to client
    }
  }

  return { success: true, mode: "planning", flow };
}
