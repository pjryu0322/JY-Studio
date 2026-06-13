export {
  evaluateIntegrationButtonGate,
  evaluateIntegrationPrepareGateFromBoardSummary,
  evaluatePrepareIntegrationPreviewStartGate,
  isFinalWiringStepReadyForIntegrationButton,
  logIntegrationButtonClicked,
  logIntegrationButtonGateEvaluated,
  INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE,
  type IntegrationButtonGateBlockReasonV1,
} from "@/lib/prototype/implementationBoardIntegrationGate";

export { summarizeCodeTaskBoardGateFromRequirementsState } from "@/lib/prototype/implementationIntegrationBoardGateSummary";
