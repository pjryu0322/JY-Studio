import type {
  RequirementsServiceFlowV1,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export type RequirementsOrchestrationContextWire = Readonly<{
  readonly singleChatOrchestrationV1?: unknown;
  readonly requirementsOrchestrationStageV1?: unknown;
  readonly featurePlanningSlotsV1?: unknown;
  readonly featureDetailSlotsV1?: unknown;
  readonly requirementsIntentOrchestrationV1?: unknown;
}>;

export function buildIntentRouterStateFromOrchestrationContext(
  flow: RequirementsServiceFlowV1 | null,
  orchCtx: RequirementsOrchestrationContextWire | undefined,
): RequirementsStateJson {
  return {
    serviceFlowV1: flow,
    singleChatOrchestrationV1: orchCtx?.singleChatOrchestrationV1 as RequirementsStateJson["singleChatOrchestrationV1"],
    requirementsOrchestrationStageV1:
      orchCtx?.requirementsOrchestrationStageV1 as RequirementsStateJson["requirementsOrchestrationStageV1"],
    featurePlanningSlotsV1: orchCtx?.featurePlanningSlotsV1 as RequirementsStateJson["featurePlanningSlotsV1"],
    featureDetailSlotsV1: orchCtx?.featureDetailSlotsV1 as RequirementsStateJson["featureDetailSlotsV1"],
    requirementsIntentOrchestrationV1:
      orchCtx?.requirementsIntentOrchestrationV1 as RequirementsStateJson["requirementsIntentOrchestrationV1"],
  };
}
