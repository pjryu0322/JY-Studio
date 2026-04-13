/**
 * JYOrchestration — shared constructors for application-layer results (reduces inline repetition).
 * Shapes must stay aligned with `mvpExecutionContracts.ts` discriminated unions.
 */

import type { MvpExecutionAppFailureCode } from "./mvpExecutionResultCodes";
import { MVP_EXECUTION_APP_CODE } from "./mvpExecutionResultCodes";

/** Success branch: `ok` + `OK` + caller-supplied payload fields. */
export function appSuccessResult<P extends Record<string, unknown>>(
  payload: P
): { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK } & P {
  return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, ...payload };
}

/** Failure branch: `ok` + failure `code` + optional extra fields (e.g. `readiness` for `NOT_READY`). */
export function appFailureResult(
  code: MvpExecutionAppFailureCode,
  extras?: Record<string, unknown>
): { ok: false; code: MvpExecutionAppFailureCode } & Record<string, unknown> {
  if (extras != null) {
    return { ok: false, code, ...extras };
  }
  return { ok: false, code };
}
