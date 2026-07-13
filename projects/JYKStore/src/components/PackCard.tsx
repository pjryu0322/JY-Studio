"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { AddToMyPacksButton } from "@/components/AddToMyPacksButton";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { packDetailPath } from "@/lib/routes";

function formatUsage(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatRating(rating: number): string {
  if (rating <= 0) return "—";
  return rating.toFixed(1);
}

export function PackCard({ pack }: { readonly pack: KnowledgePack }) {
  const detailHref = packDetailPath(pack.packId);

  return (
    <article className="rounded-2xl border border-store-border bg-store-card shadow-card">
      <Link href={detailHref} className="flex gap-3 p-3 active:bg-slate-50">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-2xl"
          aria-hidden
        >
          {pack.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-bold text-slate-900">{pack.name}</h3>
            {pack.isVerified ? <VerifiedBadge /> : null}
            <StatusBadge status={pack.status} />
          </div>
          <p className="mt-0.5 text-xs text-store-muted">{pack.provider}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{pack.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-store-muted">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{pack.category}</span>
            <span>★ {formatRating(pack.rating)}</span>
            <span>· {formatUsage(pack.usageCount)} 사용</span>
            <span>· v{pack.version}</span>
          </div>
          {pack.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {pack.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="px-3 pb-3">
        <AddToMyPacksButton packId={pack.packId} variant="card" capabilities={pack.capabilities} />
      </div>
    </article>
  );
}
