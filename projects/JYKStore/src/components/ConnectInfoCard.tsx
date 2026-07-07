import type { ReactNode } from "react";
import { CopyButton } from "@/components/CopyButton";

export function ConnectInfoCard({
  label,
  value,
  hint,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-store-muted">{label}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-800">
          {value}
        </code>
        <CopyButton value={value} label={`${label} 복사`} className="w-full sm:w-auto" />
      </div>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-store-muted">{hint}</p> : null}
      {children}
    </div>
  );
}
