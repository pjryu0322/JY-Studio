"use client";

/**
 * Reason / blocking copy from {@link PlanningExecutionMessageViewModel} — structural strings only.
 */

import type { PlanningExecutionMessageViewModel } from "@jy-orch/application/public";

export function PlanningExecutionMessagePanel({
  title,
  message,
}: {
  readonly title: string;
  readonly message: PlanningExecutionMessageViewModel;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-label={title}>
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      <p className="mt-2 text-sm text-neutral-700">{message.reasonSummary}</p>
      {message.blockingReasonSummary ? (
        <p className="mt-2 text-sm text-red-800" data-testid="blocking-reason">
          {message.blockingReasonSummary}
        </p>
      ) : null}
    </section>
  );
}
