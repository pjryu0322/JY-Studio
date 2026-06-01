import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  runConfirmQuickDesignForImplementationFromState,
  type ConfirmQuickDesignForImplementationFromStateInput,
  type ConfirmQuickDesignForImplementationResult,
} from "@/lib/prototype/implementationQuickDesignDraftBridge";
import { runQuickDesignConfirmFlow, type QuickDesignConfirmFlowResult } from "@/lib/requirements/quickDesignConfirmFlow";
import { resolveQuickDesignLlmServerContext } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettings.server";

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

  const nowIso = new Date().toISOString();
  const flowResult = await runQuickDesignConfirmFlow({
    projectId,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMessages: input.conversationMessages,
    serviceFlow: input.serviceFlow ?? (state.serviceFlowV1 as { readonly version?: string } | null) ?? null,
    problemInterview: input.problemInterview ?? null,
    sourceStage: input.sourceStage ?? "IDEATION",
    nowIso,
    fastPlanDraftV1: draft,
    orchestrationForConfirm,
    slotDefinitions: input.slotDefinitions,
    planningState: {
      featurePlanningSlotsV1: (state.featurePlanningSlotsV1 as Record<string, unknown> | null) ?? null,
      serviceFlowV1: (state.serviceFlowV1 as { readonly version?: string } | null) ?? null,
      projectArtifacts: (state.projectArtifacts as import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[]) ?? [],
      deliverableAssets:
        (state.deliverableAssets as import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset[]) ?? [],
      requirementsOrchestrationStageV1:
        (state.requirementsOrchestrationStageV1 as import("@/lib/requirements/requirementsStateJson").RequirementsOrchestrationStageV1 | null) ??
        null,
      implementationTaskListV1:
        (state.implementationTaskListV1 as import("@/lib/requirements/implementationTaskList").ImplementationTaskListV1 | null) ??
        null,
    },
    envOkOverride: input.envOkOverride,
    refinementSettings,
    providerContext,
  });

  if (flowResult.kind === "blocked") {
    return { success: false, message: flowResult.message };
  }
  return { success: true, mode: "planning", flow: flowResult };
}
