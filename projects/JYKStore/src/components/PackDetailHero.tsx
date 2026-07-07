"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { PackMetaGrid } from "@/components/PackMetaGrid";
import { ROUTES } from "@/lib/routes";

const PHASE3_ADD_MSG = "Phase 3에서 내 지식팩 추가 기능이 연결됩니다.";
const PHASE3_CONNECT_MSG =
  "Phase 3에서 연동 가이드 화면이 연결됩니다. 내 지식팩에서 Pack ID와 API 예시를 확인할 수 있습니다.";

export function PackDetailHero({ pack }: { readonly pack: KnowledgePack }) {
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
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90"
            onClick={() => window.alert(PHASE3_ADD_MSG)}
          >
            내 지식팩에 추가
          </button>
          <button
            type="button"
            className="min-h-[44px] w-full rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50"
            onClick={() => window.alert(PHASE3_CONNECT_MSG)}
          >
            연동 가이드 보기
          </button>
        </div>
      </div>
    </div>
  );
}
