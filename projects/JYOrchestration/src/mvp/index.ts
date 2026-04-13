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
export * from "./exampleFlow";
export * from "./testing/mvpExecutionFixtures";
export { runMvpSelfCheck } from "./mvpSelfCheck";
