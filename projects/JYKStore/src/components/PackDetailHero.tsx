"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { AddToMyPacksButton } from "@/components/AddToMyPacksButton";
import { ConnectActionButton } from "@/components/ConnectActionButton";
import { PackMetaGrid } from "@/components/PackMetaGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useMyPacks } from "@/hooks/useMyPacks";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";
import { ROUTES } from "@/lib/routes";

function publicPayloadDownloadHref(packId: string) {
  return `/api/v1/packs/${encodeURIComponent(packId)}/payload/download`;
}

export function PackDetailHero({ pack }: { readonly pack: KnowledgePack }) {
  const { mounted, isMyPack } = useMyPacks();
  const added = mounted && isMyPack(pack.packId);
  const capabilities = pack.capabilities;
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;
  const downloadReady = capabilities?.download.status === "READY";

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
            {capabilities ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {downloadReady ? (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    다운로드 가능
                  </span>
                ) : null}
                {apiReady ? (
                  <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                    API 연동 가능
                  </span>
                ) : downloadReady ? (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                    API 준비 중
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <PackMetaGrid pack={pack} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-store-muted">
          {apiReady
            ? "내 지식팩에 추가하면 연동에 필요한 정보를 바로 확인할 수 있습니다."
            : downloadReady
              ? "이 지식팩은 원본 다운로드를 지원합니다. API 연동은 준비 중입니다."
              : "내 지식팩에 추가해 보관할 수 있습니다."}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <AddToMyPacksButton packId={pack.packId} variant="detail" capabilities={capabilities} />
          {!added && apiReady ? (
            <ConnectActionButton
              packId={pack.packId}
              capabilities={capabilities}
              label="연동 가이드 보기"
            />
          ) : null}
          {downloadReady ? (
            <a
              href={publicPayloadDownloadHref(pack.packId)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-slate-800 active:bg-slate-50"
            >
              다운로드
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
