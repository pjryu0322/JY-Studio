/**
 * MVP — central in-memory run + step store backing `executionService` (implements ports).
 */

import type { ExecutionRun } from "../contracts/mvpExecutionTypes";
import type { RunStore, StepStore, StepAppendInput, RunMeta } from "../ports/mvpPorts";
import {
  mvpAppendExecutionStep,
  mvpClearAllExecutionSteps,
  mvpGetExecutionStepsForRun,
} from "./executionStepLog";

const runs = new Map<string, ExecutionRun>();
const runMeta = new Map<string, RunMeta>();

export const mvpInMemoryRunStore: RunStore = {
  get: (runId) => runs.get(runId),
  put: (run) => {
    runs.set(run.id, run);
  },
  clear: () => {
    runs.clear();
    runMeta.clear();
  },
  getMeta: (runId) => runMeta.get(runId),
  setMeta: (runId, meta) => {
    runMeta.set(runId, meta);
  },
  deleteMeta: (runId) => {
    runMeta.delete(runId);
  },
};

export const mvpInMemoryStepStore: StepStore = {
  append: (record: StepAppendInput) => {
    mvpAppendExecutionStep(record);
  },
  getStepsForRun: (runId) => mvpGetExecutionStepsForRun(runId),
  clearAll: () => {
    mvpClearAllExecutionSteps();
  },
};
