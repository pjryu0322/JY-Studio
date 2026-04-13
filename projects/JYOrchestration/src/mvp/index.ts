/**
 * MVP public surface (isolated). No connection to production APIs or Stage1/2.
 */

export * from "./task/taskService";
export * from "./prompt/promptService";
export * from "./reviewer/reviewerService";
export * from "./execution/executionService";
export * from "./execution/executionStepLog";
export * from "./execution/executionStepProjections";
export * from "./execution/mvpRunSummary";
export * from "./cursor/cursorService";
export * from "./git/gitService";
export * from "./orchestration/orchestrationService";
export * from "./orchestration/mvpOrchestrationFacade";
export * from "./contracts/mvpStructuredFailure";
export * from "./contracts/mvpDtos";
export * from "./ports/mvpPorts";
export * from "./runtime/mvpExecutionPortsBundle";
export * from "./execution/inMemoryExecutionState";
export * from "./exampleFlow";
export * from "./testing/mvpExecutionFixtures";
export { runMvpSelfCheck } from "./mvpSelfCheck";
