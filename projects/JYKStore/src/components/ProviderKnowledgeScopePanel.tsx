"use client";

/**
 * Provider: respond to admin knowledge-scope include/exclude requests.
 */
import { useCallback, useEffect, useState } from "react";

type ProviderScopeItem = {
  id: string;
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  providerRequestNote: string | null;
  previewKind: string | null;
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProviderKnowledgeScopePanel({ packId }: { readonly packId: string }) {
  const [items, setItems] = useState<ProviderScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-scope`,
        { credentials: "include" },
      );
      const data = (await response.json().catch(() => null)) as {
        items?: ProviderScopeItem[];
        error?: string | { message?: string };
      } | null;
      if (!response.ok) {
        const msg =
          typeof data?.error === "object"
            ? data.error.message
            : typeof data?.error === "string"
              ? data.error
              : `불러오기 실패 (${response.status})`;
        throw new Error(msg);
      }
      setItems(data?.items ?? []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "요청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = useCallback(
    async (itemId: string, decision: "INCLUDED" | "EXCLUDED") => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch(
          `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-scope`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemIds: [itemId], decision }),
          },
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string | { message?: string };
        } | null;
        if (!response.ok) {
          const msg =
            typeof data?.error === "object"
              ? data.error.message
              : typeof data?.error === "string"
                ? data.error
                : `응답 실패 (${response.status})`;
          throw new Error(msg);
        }
        setMessage(decision === "INCLUDED" ? "포함으로 반영했습니다." : "제외로 반영했습니다.");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "판정에 실패했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [load, packId],
  );

  if (loading) {
    return <p className="text-sm text-store-muted">지식화 범위 확인 요청을 불러오는 중…</p>;
  }

  if (items.length === 0 && !error) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
      <header>
        <h3 className="text-sm font-semibold text-store-ink">지식화 대상 확인 요청</h3>
        <p className="text-xs text-store-muted">
          관리자가 포함 여부를 물어본 파일입니다. 기술 상세는 표시하지 않습니다.
        </p>
      </header>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-store-border bg-white px-3 py-2 text-sm"
          >
            <p className="font-medium text-store-ink">{item.fileName}</p>
            <p className="break-all text-xs text-store-muted">{item.relativePath}</p>
            <p className="text-xs text-store-muted">
              {item.extension || "확장자 없음"} · {formatBytes(item.sizeBytes)}
            </p>
            {item.providerRequestNote ? (
              <p className="mt-1 text-xs text-amber-900">요청 사유: {item.providerRequestNote}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                className="rounded-lg border border-store-border px-2 py-1 text-xs hover:bg-store-surface"
                href={`/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-scope/items/${encodeURIComponent(item.id)}/preview`}
                target="_blank"
                rel="noreferrer"
              >
                미리보기
              </a>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                onClick={() => void respond(item.id, "INCLUDED")}
              >
                포함
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-stone-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                onClick={() => void respond(item.id, "EXCLUDED")}
              >
                제외
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
