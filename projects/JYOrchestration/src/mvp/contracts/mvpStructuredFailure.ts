/**
 * MVP — structured failure payload (avoid inferring only from free-text messages).
 */

import type { MvpFailureCode } from "./mvpExecutionTypes";

export type MvpStructuredFailure = {
  failureCode: MvpFailureCode;
  failureMessage: string;
  retryable: boolean;
  /** Step that produced or classified this failure (aligns with `MvpExecutionStepType` literals). */
  sourceStepType: string;
};
