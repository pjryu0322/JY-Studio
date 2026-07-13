"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { ConnectActionButton } from "@/components/ConnectActionButton";
import { CopyButton } from "@/components/CopyButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";
import { packDetailPath } from "@/lib/routes";
import { useMyPacks } from "@/hooks/useMyPacks";

function publicPayloadDownloadHref(packId: string) {
  return `/api/v1/packs/${encodeURIComponent(packId)}/download`;
}

export function MyPackCard({ pack }: { readonly pack: KnowledgePack }) {
  const { removeMyPack } = useMyPacks();
  const capabilities = pack.capabilities;
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;
  const downloadReady = capabilities?.download.status === "READY";
  const mcpReady = capabilities?.mcp.status === "READY";

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
            <h2 className="text-sm font-bold text-slate-900">{pack.displayName?.trim() || pack.name}</h2>
            {pack.isVerified ? <VerifiedBadge /> : null}
          </div>
          <p className="mt-0.5 text-xs text-store-muted">{pack.provider}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{pack.shortDescription}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-store-muted">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{pack.packId}</span>
            <span>v{pack.version}</span>
            <span>· {pack.updatedAt}</span>
          </div>
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
              {mcpReady ? (
                <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                  MCP 가능
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {apiReady ? <ConnectActionButton packId={pack.packId} capabilities={capabilities} /> : null}
        {!apiReady && downloadReady ? (
          <a
            href={publicPayloadDownloadHref(pack.packId)}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent active:bg-slate-50"
          >
            다운로드
          </a>
        ) : null}
        {!apiReady && !downloadReady ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-store-muted">
            API 연동 기능은 준비 중입니다.
          </p>
        ) : null}
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
