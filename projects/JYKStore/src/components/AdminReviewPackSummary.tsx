import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { AdminReviewStatusBadge } from "@/components/AdminReviewStatusBadge";

export function AdminReviewPackSummary({ detail }: { readonly detail: AdminReviewDetailDto }) {
  const { pack } = detail;

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-3xl">{pack.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{pack.name}</h2>
            <AdminReviewStatusBadge status={pack.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-store-muted">{pack.packId}</p>
          <p className="mt-2 text-sm text-slate-700">{pack.shortDescription}</p>
          <dl className="mt-3 grid gap-1 text-xs text-store-muted">
            <div>
              제공자: <span className="text-slate-800">{pack.providerName}</span> ({pack.providerType})
            </div>
            <div>
              카테고리: <span className="text-slate-800">{pack.categoryId}</span>
            </div>
          </dl>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-700">{pack.description}</p>
      {pack.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {pack.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
