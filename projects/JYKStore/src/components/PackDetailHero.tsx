"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { AddToMyPacksButton } from "@/components/AddToMyPacksButton";
import { ConnectActionButton } from "@/components/ConnectActionButton";
import { PackMetaGrid } from "@/components/PackMetaGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useMyPacks } from "@/hooks/useMyPacks";
import { ROUTES } from "@/lib/routes";

export function PackDetailHero({ pack }: { readonly pack: KnowledgePack }) {
  const { mounted, isMyPack } = useMyPacks();
  const added = mounted && isMyPack(pack.packId);

  return (
    <div className="space-y-4">
      <Link href={ROUTES.packs} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent">
        ← 지식팩 목록
      </Link>
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex gap-4">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-4xl"
            aria-hidden
          >
            {pack.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-lg font-bold text-slate-900">{pack.name}</h1>
              {pack.isVerified ? <VerifiedBadge /> : null}
              <StatusBadge status={pack.status} />
            </div>
            <p className="mt-1 text-sm text-store-muted">{pack.provider}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{pack.shortDescription}</p>
          </div>
        </div>
        <div className="mt-4">
          <PackMetaGrid pack={pack} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-store-muted">
          내 지식팩에 추가하면 연동에 필요한 정보를 바로 확인할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <AddToMyPacksButton packId={pack.packId} variant="detail" />
          {!added ? (
            <ConnectActionButton packId={pack.packId} label="연동 가이드 보기" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
