import type { KnowledgePackStatus } from "@/types/pack";

const LABEL: Record<KnowledgePackStatus, string> = {
  PUBLISHED: "공개",
  DRAFT: "초안",
  REVIEWING: "검토중",
  DEPRECATED: "사용중단",
  SUSPENDED: "중지",
};

const STYLE: Record<KnowledgePackStatus, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  REVIEWING: "bg-amber-50 text-amber-800 border-amber-200",
  DEPRECATED: "bg-slate-200 text-slate-600 border-slate-300",
  SUSPENDED: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { readonly status: KnowledgePackStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STYLE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
