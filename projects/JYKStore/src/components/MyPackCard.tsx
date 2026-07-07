"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { ConnectActionButton } from "@/components/ConnectActionButton";
import { CopyButton } from "@/components/CopyButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { packDetailPath } from "@/lib/routes";
import { useMyPacks } from "@/hooks/useMyPacks";

export function MyPackCard({ pack }: { readonly pack: KnowledgePack }) {
  const { removeMyPack } = useMyPacks();

  const onRemove = () => {
    const ok = window.confirm("이 지식팩을 내 지식팩에서 제거할까요?");
    if (!ok) return;
    void removeMyPack(pack.packId).catch(() => {
      window.alert("지식팩을 제거하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    });
  };

  return (
    <article className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-2xl"
          aria-hidden
        >
          {pack.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-900">{pack.name}</h2>
            {pack.isVerified ? <VerifiedBadge /> : null}
          </div>
          <p className="mt-0.5 text-xs text-store-muted">{pack.provider}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{pack.shortDescription}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-store-muted">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{pack.packId}</span>
            <span>v{pack.version}</span>
            <span>· {pack.updatedAt}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <ConnectActionButton packId={pack.packId} />
        <div className="flex gap-2">
          <CopyButton value={pack.packId} label="Pack ID 복사" className="flex-1" />
          <Link
            href={packDetailPath(pack.packId)}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-store-border bg-white px-3 text-sm font-bold text-slate-800 active:bg-slate-50"
          >
            상세 보기
          </Link>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-[44px] w-full rounded-xl px-4 text-sm font-semibold text-red-600 active:bg-red-50"
        >
          제거
        </button>
      </div>
    </article>
  );
}
