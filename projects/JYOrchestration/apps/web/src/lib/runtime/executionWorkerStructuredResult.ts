/**
 * Shared execution worker job result shape.
 */

export type ExecutionWorkerStructuredResult = {
  readonly ok: boolean;
  readonly code: string;
  readonly message: string;
  readonly data?: unknown;
};
