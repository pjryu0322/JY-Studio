"use client";

import type { KnowledgePack } from "@/types/knowledge-pack";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";

function formatUsage(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function PackCard(p: {
  readonly pack: KnowledgePack;
  readonly onAddToLibrary?: (packId: string) => void;
}) {
  const { pack } = p;
  return (
    <article className="flex gap-3 rounded-2xl border border-store-border bg-store-card p-3 shadow-card">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-bold text-white"
        aria-hidden
      >
        {pack.iconLabel.slice(0, 4)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate text-sm font-bold text-slate-900">{pack.name}</h3>
          {pack.verified ? <VerifiedBadge /> : null}
          <StatusBadge status={pack.status} />
        </div>
        {pack.provider ? (
          <p className="mt-0.5 text-xs text-store-muted">{pack.provider}</p>
        ) : null}
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{pack.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-store-muted">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{pack.category}</span>
          <span>★ {pack.rating.toFixed(1)}</span>
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
        <button
          type="button"
          className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90"
          onClick={() => p.onAddToLibrary?.(pack.packId)}
        >
          내 지식팩에 추가
        </button>
      </div>
    </article>
  );
}
