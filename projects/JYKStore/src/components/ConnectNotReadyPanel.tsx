import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { packDetailPath, ROUTES } from "@/lib/routes";

export function ConnectNotReadyPanel({
  pack,
  failed = false,
}: {
  readonly pack: KnowledgePack;
  readonly failed?: boolean;
}) {
  if (failed) {
    return (
      <div className="space-y-4 pb-4">
        <Link
          href={ROUTES.myPacks}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
        >
          ← 내 지식팩
        </Link>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <h1 className="text-lg font-bold text-red-950">연동 준비 중 오류</h1>
          <p className="mt-2 text-sm leading-relaxed text-red-900">
            연동 준비 중 오류가 발생했습니다. 운영자가 Runtime 상태를 점검 중입니다.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={packDetailPath(pack.packId)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-slate-800"
          >
            상세 보기
          </Link>
          <Link
            href={ROUTES.myPacks}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
          >
            내 지식팩으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const downloadReady = pack.capabilities?.download.status === "READY";
  const catalogReady = pack.capabilities?.catalog.status === "READY";

  return (
    <div className="space-y-4 pb-4">
      <Link
        href={ROUTES.myPacks}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 내 지식팩
      </Link>

      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex gap-3">
          <span className="text-4xl" aria-hidden>
            {pack.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900">{pack.name}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{pack.shortDescription}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <h2 className="text-base font-bold text-amber-950">이 지식팩은 아직 API 연동을 지원하지 않습니다.</h2>
        <div className="mt-3 space-y-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">현재 사용 가능</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {catalogReady ? <li>카탈로그 열람</li> : null}
              {downloadReady ? <li>원본 다운로드</li> : null}
              {!catalogReady && !downloadReady ? <li>내 지식팩 보관</li> : null}
            </ul>
          </div>
          <div>
            <p className="font-semibold">준비 중</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Context API</li>
              <li>Retrieval API</li>
              <li>MCP</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {downloadReady ? (
          <a
            href={`/api/v1/packs/${encodeURIComponent(pack.packId)}/payload/download`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-store-accent"
          >
            다운로드
          </a>
        ) : null}
        <Link
          href={packDetailPath(pack.packId)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-store-border bg-white px-4 text-sm font-bold text-slate-800"
        >
          상세 보기
        </Link>
        <Link
          href={ROUTES.myPacks}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
        >
          내 지식팩으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
