import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import { PROVIDER_PACK_STATUS_UX } from "@/lib/role-based-ux-copy";

const LABELS: Record<ProviderPackListItemDto["status"], string> = {
  DRAFT: PROVIDER_PACK_STATUS_UX.DRAFT ?? "초안",
  REVIEWING: PROVIDER_PACK_STATUS_UX.REVIEWING ?? "검토 요청됨",
  PUBLISHED: PROVIDER_PACK_STATUS_UX.PUBLISHED ?? "공개됨",
  VERIFIED: PROVIDER_PACK_STATUS_UX.VERIFIED ?? "검증됨",
  DEPRECATED: "사용 중단",
  SUSPENDED: "중지됨",
};

const STYLES: Record<ProviderPackListItemDto["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  REVIEWING: "bg-amber-100 text-amber-900",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  VERIFIED: "bg-blue-100 text-blue-900",
  DEPRECATED: "bg-gray-100 text-gray-600",
  SUSPENDED: "bg-red-100 text-red-800",
};

export function ProviderPackStatusBadge({
  status,
}: {
  readonly status: ProviderPackListItemDto["status"];
}) {
  // Draft is the default editing context — avoid a redundant "초안 작성 중" chip.
  if (status === "DRAFT") return null;

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
