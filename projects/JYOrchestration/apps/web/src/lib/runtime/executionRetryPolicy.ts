/**
 * Runtime retry policy — centralized retry / repeated-failure guards.
 */

export type ExecutionRetryContext = {
  readonly verdict: string;
  readonly evaluationReason: string;
  readonly loopRetryCount: number;
  readonly maxLoopRetries: number;
  readonly stopOnRepeatedFailure: boolean;
  readonly priorRetryReason?: string | null;
};

export function shouldRetryExecution(ctx: ExecutionRetryContext): boolean {
  if (ctx.verdict !== "retry") {
    return false;
  }
  if (ctx.loopRetryCount >= ctx.maxLoopRetries) {
    return false;
  }
  if (
    ctx.stopOnRepeatedFailure &&
    ctx.priorRetryReason &&
    ctx.priorRetryReason === ctx.evaluationReason
  ) {
    return false;
  }
  return true;
}

export function shouldBlockRepeatedFailure(ctx: ExecutionRetryContext): boolean {
  return (
    ctx.stopOnRepeatedFailure &&
    ctx.verdict === "retry" &&
    Boolean(ctx.priorRetryReason) &&
    ctx.priorRetryReason === ctx.evaluationReason
  );
}

export function retryReasonForWorker(input: {
  readonly verdict: string;
  readonly evaluationReason: string;
  readonly blockedByRepeatedFailure: boolean;
}): string | null {
  if (input.blockedByRepeatedFailure) {
    return `repeated_failure:${input.evaluationReason}`;
  }
  if (input.verdict === "retry") {
    return input.evaluationReason;
  }
  return null;
}
