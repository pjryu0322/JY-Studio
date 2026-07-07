const STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  REVIEWING: "bg-amber-100 text-amber-900",
  PUBLISHED: "bg-emerald-100 text-emerald-900",
  VERIFIED: "bg-blue-100 text-blue-900",
  DEPRECATED: "bg-gray-100 text-gray-600",
  SUSPENDED: "bg-red-100 text-red-800",
};

export function AdminReviewStatusBadge({ status }: { readonly status: string }) {
  const style = STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${style}`}>
      {status}
    </span>
  );
}
