import type { ProviderPackListItemDto } from "@/lib/provider-pack-dto";

const LABELS: Record<ProviderPackListItemDto["status"], string> = {
  DRAFT: "초안",
  REVIEWING: "검수 요청",
  PUBLISHED: "공개됨",
  VERIFIED: "검증됨",
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
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
