/**
 * JYOrchestration — small result factories for application-layer consistency.
 * Must preserve the exact `ok`/`code` shapes used by current contracts.
 */

import type { MvpExecutionAppFailureCode } from "./mvpExecutionResultCodes";
import { MVP_EXECUTION_APP_CODE } from "./mvpExecutionResultCodes";
import { appFailureResult, appSuccessResult } from "./mvpAppResultHelpers";

export function okResult<P extends Record<string, unknown>>(payload: P): { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK } & P {
  return appSuccessResult(payload);
}

export function failResult(
  code: MvpExecutionAppFailureCode,
  extras?: Record<string, unknown>
): { ok: false; code: MvpExecutionAppFailureCode } & Record<string, unknown> {
  return appFailureResult(code, extras);
}

