import type { ReactNode } from "react";
import { CopyButton } from "@/components/CopyButton";

export function ConnectionInfoRow({
  label,
  value,
  copyLabel,
  actions,
}: {
  readonly label: string;
  readonly value: string;
  readonly copyLabel: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-store-border py-3 first:border-t-0 first:pt-0 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <p className="text-xs font-semibold text-store-muted">{label}</p>
      <code className="min-w-0 overflow-x-auto break-all rounded-lg bg-slate-50 px-2.5 py-2 font-mono text-xs font-medium text-slate-800">
        {value}
      </code>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {actions ?? <CopyButton value={value} label={copyLabel} className="min-w-[5.5rem]" />}
      </div>
    </div>
  );
}
