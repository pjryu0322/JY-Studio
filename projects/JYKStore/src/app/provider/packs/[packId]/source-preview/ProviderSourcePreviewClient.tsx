"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export function ProviderSourcePreviewClient({ packId }: { readonly packId: string }) {
  const search = useSearchParams();
  const fileId = search.get("fileId")?.trim() || "";
  const page = Number(search.get("page") || "1");
  const pageSafe = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const src = useMemo(() => {
    if (!fileId) return null;
    const base = `/api/v1/provider/packs/${encodeURIComponent(packId)}/source-preview/${encodeURIComponent(fileId)}`;
    return `${base}#page=${pageSafe}`;
  }, [fileId, pageSafe, packId]);

  if (!fileId) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <h1 className="text-lg font-bold text-slate-900">원문 미리보기</h1>
        <p className="mt-2 text-sm text-rose-700">fileId가 필요합니다.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-bold text-slate-900">원문 미리보기</h1>
        <p className="mt-1 text-sm text-store-muted">원문 {pageSafe}페이지에서 확인</p>
      </header>
      {src ? (
        <iframe title="source-preview" src={src} className="min-h-0 w-full flex-1 bg-white" />
      ) : null}
    </main>
  );
}
