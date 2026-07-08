import { SOURCE_VALIDATION_LABELS } from "@/lib/source-type-dto";
import type { SourceValidationStatus } from "@prisma/client";

const STYLES: Record<string, string> = {
  PASS: "bg-emerald-50 text-emerald-800 border-emerald-200",
  WARNING: "bg-amber-50 text-amber-800 border-amber-200",
  FAIL: "bg-red-50 text-red-800 border-red-200",
  NOT_CHECKED: "bg-slate-100 text-slate-600 border-slate-200",
};

export function SourceValidationBadge({ status }: { readonly status: string }) {
  const label = SOURCE_VALIDATION_LABELS[status as SourceValidationStatus] ?? status;
  const style = STYLES[status] ?? STYLES.NOT_CHECKED;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}
