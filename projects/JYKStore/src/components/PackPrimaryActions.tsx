"use client";

import Link from "next/link";
import { useCallback, type MouseEvent } from "react";
import type { KnowledgePack } from "@/types/pack";
import { useMyPacks } from "@/hooks/useMyPacks";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";
import { myPackConnectPath, ROUTES } from "@/lib/routes";

function publicPayloadDownloadHref(packId: string) {
  return `/api/v1/packs/${encodeURIComponent(packId)}/payload/download`;
}

const primaryClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90";
const secondaryClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-slate-800 active:bg-slate-50";
const accentSecondaryClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50";

export function PackPrimaryActions({ pack }: { readonly pack: KnowledgePack }) {
  const { mounted, isMyPack, addMyPack } = useMyPacks();
  const added = mounted && isMyPack(pack.packId);
  const capabilities = pack.capabilities;
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;
  const downloadReady = capabilities?.download.status === "READY" || pack.downloadInfo?.available;

  const onAdd = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void addMyPack(pack.packId).catch(() => {
        window.alert("내 지식팩에 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      });
    },
    [addMyPack, pack.packId],
  );

  if (!mounted) {
    return <div className="min-h-[44px] w-full rounded-xl bg-slate-100" aria-hidden />;
  }

  if (!added) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className={primaryClass} onClick={onAdd}>
          내 지식팩에 추가
        </button>
        {downloadReady ? (
          <a href={publicPayloadDownloadHref(pack.packId)} className={secondaryClass}>
            다운로드
          </a>
        ) : null}
        {apiReady ? (
          <Link href={myPackConnectPath(pack.packId)} className={accentSecondaryClass}>
            연동하기
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
        ✓ 내 지식팩에 추가됨
      </p>
      {apiReady ? (
        <Link href={myPackConnectPath(pack.packId)} className={primaryClass}>
          연동하기
        </Link>
      ) : null}
      {downloadReady ? (
        <a
          href={publicPayloadDownloadHref(pack.packId)}
          className={apiReady ? secondaryClass : primaryClass}
        >
          다운로드
        </a>
      ) : null}
      <Link href={ROUTES.myPacks} className={secondaryClass}>
        내 지식팩에서 보기
      </Link>
    </div>
  );
}
