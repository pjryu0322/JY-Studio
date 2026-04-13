/**
 * JYOrchestration — command vs query classification for `MvpExecutionApplicationService`.
 *
 * - **Commands** may mutate MVP in-memory execution state (e.g. start a new run).
 * - **Queries** only read through the MVP orchestration facade / inspection VM; they do not
 *   start runs or append steps themselves (though the underlying MVP engine may still be
 *   invoked for read models).
 *
 * This file documents intent only; behavior lives in `mvpExecutionApplicationService.ts`.
 */

export const MVP_EXECUTION_APPLICATION_COMMANDS = ["startRun"] as const;

export const MVP_EXECUTION_APPLICATION_QUERIES = [
  "getReadiness",
  "getRunSummary",
  "getRunDetail",
  "getStepList",
  "getRunInspection",
] as const;

export type MvpExecutionApplicationCommandName = (typeof MVP_EXECUTION_APPLICATION_COMMANDS)[number];
export type MvpExecutionApplicationQueryName = (typeof MVP_EXECUTION_APPLICATION_QUERIES)[number];
