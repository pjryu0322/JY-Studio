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
import { parseRequirementsStateJson, mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  loadPlanningDatabaseSettingsForProject,
  loadPlanningDatabaseSettingsRawForProject,
  resolvePlanningPostgresPassword,
} from "@/lib/planning/planningDatabaseSettingsService";
import { resolveJyprojectsPgConnectionForProvisioning } from "@/lib/planning/jyprojectsPgConnection.server";
import {
  QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY,
  classifyProjectSchemaStoreFailure,
} from "@/lib/planning/projectSchemaStoreFailure";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  provisionImplementationSampleStore,
} from "@/lib/planning/provisionProjectStageDataStores";
import { provisionQuickDesignImplementationSchemaAndSeed } from "@/lib/planning/provisionQuickDesignImplementationSchemaAndSeed.server";
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
      readonly storePrepWarning?: string | null;
    }>;

async function persistQuickDesignPlanningConfirmState(input: Readonly<{
  readonly projectId: string;
  readonly flow: Extract<QuickDesignConfirmFlowResult, { readonly kind: "success" }>;
  readonly dbSettingsPatch?: Partial<PlanningDatabaseSettingsV1> | null;
}>): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { requirementsStateJson: true },
    });
    const parsed = parseRequirementsStateJson(project?.requirementsStateJson);
    const mergedRequirements = mergeRequirementsStateJson(parsed, {
      ...input.flow.statePatch,
      promptTimeline: [...(parsed.promptTimeline ?? []), ...(input.flow.timelineEntries ?? [])],
      ...(input.dbSettingsPatch
        ? {
            planningDatabaseSettingsV1: {
              ...(parsed.planningDatabaseSettingsV1 ?? {}),
              ...input.dbSettingsPatch,
            } as PlanningDatabaseSettingsV1,
          }
        : {}),
    });
    await prisma.project.update({
      where: { id: input.projectId },
      data: { requirementsStateJson: mergedRequirements as object },
    });
    if (input.dbSettingsPatch) {
      const setup = await prisma.executionSetup.findUnique({
        where: { projectId: input.projectId },
        select: { planningDatabaseSettingsJson: true },
      });
      const prior =
        setup?.planningDatabaseSettingsJson && typeof setup.planningDatabaseSettingsJson === "object"
          ? (setup.planningDatabaseSettingsJson as Record<string, unknown>)
          : {};
      await prisma.executionSetup.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          planningDatabaseSettingsJson: { ...prior, ...input.dbSettingsPatch },
        },
        update: {
          planningDatabaseSettingsJson: { ...prior, ...input.dbSettingsPatch },
        },
      });
    }
  } catch (error) {
    console.error("[quick-design-confirm] persist planning state failed:", error);
  }
}

function buildStorePrepFailureDbPatch(input: Readonly<{
  readonly prior: PlanningDatabaseSettingsV1;
  readonly adminMessage: string;
  readonly failureReason: ReturnType<typeof classifyProjectSchemaStoreFailure>;
}>): Partial<PlanningDatabaseSettingsV1> {
  const projectDbFailureReason =
    input.failureReason === "JYPROJECTS_CONFIG_MISSING"
      ? ("POSTGRES_ADMIN_CONFIG_MISSING" as const)
      : input.failureReason === "JYPROJECTS_CONNECTION_FAILED"
        ? ("POSTGRES_CONNECTION_FAILED" as const)
        : input.failureReason === "CREATE_SCHEMA_PERMISSION_DENIED"
          ? ("CREATE_DATABASE_PERMISSION_DENIED" as const)
          : ("UNKNOWN" as const);
  return {
    ...input.prior,
    projectDbStatus: "FAILED",
    projectDbFailureReason,
    connectionStatus: "FAILED",
    lastErrorMessage: input.adminMessage.slice(0, 500),
    lastCheckedAt: new Date().toISOString(),
  };
}

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
  let storePrepWarning: string | null = null;
  const handoff = flowResult.prep.planningHandoffForImplementationV1;
  if (
    flowResult.prep.prepComplete &&
    (handoff?.implementationDataPlan.dataPersistenceMode === "JYPROJECTS_SCHEMA" ||
      handoff?.implementationDataPlan.dataPersistenceMode === "PLATFORM_SCHEMA" ||
      handoff?.implementationDataPlan.dataPersistenceMode === "PROJECT_DATABASE" ||
      handoff?.implementationDataPlan.dataPersistenceMode === "POSTGRES_SAMPLE_DB")
  ) {
    const provisionNow = new Date().toISOString();
    const rawSettings = await loadPlanningDatabaseSettingsRawForProject(projectId);
    const passwordOverride = await resolvePlanningPostgresPassword(projectId);
    const connection = resolveJyprojectsPgConnectionForProvisioning({
      planningSettings: rawSettings,
      passwordOverride,
    });

    const finishStorePrep = async (input: Readonly<{
      readonly dbPatch: Partial<PlanningDatabaseSettingsV1> | null;
      readonly warning: string;
    }>) => {
      storePrepWarning = input.warning;
      await persistQuickDesignPlanningConfirmState({
        projectId,
        flow,
        dbSettingsPatch: input.dbPatch,
      });
    };

    if (!connection.ok) {
      await finishStorePrep({
        warning: QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY,
        dbPatch: buildStorePrepFailureDbPatch({
          prior: rawSettings,
          adminMessage: connection.adminMessage,
          failureReason: connection.failureReason,
        }),
      });
      return { success: true, mode: "planning", flow, storePrepWarning };
    }

    const provision = await provisionImplementationSampleStore({
      projectId,
      planningDataSlotsV1: flowResult.statePatch.planningDataSlotsV1 ?? null,
      settings: connection.settings,
      password: connection.password,
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
      const failureReason = classifyProjectSchemaStoreFailure(provision.message);
      await finishStorePrep({
        warning: QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY,
        dbPatch: buildStorePrepFailureDbPatch({
          prior: rawSettings,
          adminMessage: provision.message,
          failureReason,
        }),
      });
      return { success: true, mode: "planning", flow, storePrepWarning };
    }

    const slotsAfterSchema = provision.planningDataSlotsV1 ?? flow.statePatch.planningDataSlotsV1 ?? null;
    const entities = slotsAfterSchema?.dataModelSlot?.entities ?? [];
    const implSchema = String(
      slotsAfterSchema?.dataStoreSlot?.implementationStore?.schemaName ??
        connection.settings.implementationSchemaName ??
        "",
    ).trim();
    if (entities.length && implSchema) {
      const structure = await provisionQuickDesignImplementationSchemaAndSeed({
        settings: connection.settings,
        password: connection.password,
        schemaName: implSchema,
        entities,
      });
      if (!structure.ok) {
        const failureReason = classifyProjectSchemaStoreFailure(structure.message);
        await finishStorePrep({
          warning: QUICK_DESIGN_CONFIRM_WITH_STORE_PREP_FAILURE_SUMMARY,
          dbPatch: buildStorePrepFailureDbPatch({
            prior: rawSettings,
            adminMessage: structure.message,
            failureReason,
          }),
        });
        return { success: true, mode: "planning", flow, storePrepWarning };
      }
    }

    await persistQuickDesignPlanningConfirmState({ projectId, flow, dbSettingsPatch: null });
  }

  return { success: true, mode: "planning", flow, storePrepWarning: storePrepWarning ?? undefined };
}
