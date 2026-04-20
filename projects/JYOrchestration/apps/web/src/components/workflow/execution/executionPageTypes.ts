import type { ExecutionPageActionState, PreExecutionSessionSelector } from "@/lib/workflow/businessExecutionSelectors";
import type { BusinessExecutionMonitoringState } from "@/lib/workflow/businessExecutionRunMonitoring";
import type { PreLaunchActionAvailability } from "@/lib/workflow/preLaunchActionModel";
import type { ExecutionPageViews } from "@/lib/workflow/executionViewState";
import type { ExecutionExecutorType } from "@/lib/workflow/executionAssignment";

export type ExecutionPageContentActions = {
  openTasks: () => void;
  selectActiveInput: () => void;
  prepareHandoffPrepared: () => void;
  createExecutionRequestDraft: () => void;
  approveExecutionDraft: () => void;
  recordBusinessExecutionRequest: () => void;
  approveBusinessExecution: () => void;
  createBusinessExecutionPackage: () => void;
  assignExecutor: (executorType: ExecutionExecutorType) => void;
  prepareExecutorHandoffPayload: () => void;
  prepareExecutorIntakeContract: () => void;
  prepareExecutorWorkOrder: () => void;
  declareLaunchIntent: () => void;
  prepareLaunchHandoffRecord: () => void;
  prepareExecutionBridge: () => void;
  prepareExecutorLaunchContract: () => void;
  markExecutionTriggerIntent: () => void;
  prepareActualExecutionAdapter: () => void;
  prepareActualLaunchCommand: () => void;
  startBusinessExecution: () => void;
  applyBusinessRunControl: (status: "running" | "completed" | "failed") => void;
  prepareExecutorIntegrationAdapter: () => void;
  runExecutorConnector: () => void;
  retryExecutorConnector: () => void;
};

export type ExecutionPageContentProps = {
  sessionId: string | null;
  requirementId: string | null;
  pre: PreExecutionSessionSelector;
  monitoring: BusinessExecutionMonitoringState;
  actions: ExecutionPageActionState;
  nextAction: PreLaunchActionAvailability;
  views: ExecutionPageViews;
  pageActions: ExecutionPageContentActions;
};
