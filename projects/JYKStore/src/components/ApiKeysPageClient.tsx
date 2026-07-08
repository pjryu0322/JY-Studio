"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiKeyCard } from "@/components/ApiKeyCard";
import { ApiKeyCreateForm } from "@/components/ApiKeyCreateForm";
import { ApiKeyCreatedSecret } from "@/components/ApiKeyCreatedSecret";
import type { ApiKeyDto } from "@/lib/api-key-dto";
import { createApiKeyApi, fetchApiKeys, revokeApiKeyApi } from "@/lib/api-keys-api";

export function ApiKeysPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ApiKeyDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [rawKeyOnce, setRawKeyOnce] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApiKeys();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API Key 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = useCallback(async (input: { name: string; expiresAt: string | null }) => {
    setCreating(true);
    setError(null);
    try {
      const data = await createApiKeyApi({
        name: input.name,
        expiresAt: input.expiresAt,
      });
      setRawKeyOnce(data.rawKey);
      setItems((prev) => [data.apiKey, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API Key를 발급하지 못했습니다.");
    } finally {
      setCreating(false);
    }
  }, []);

  const onRevoke = useCallback(
    async (keyId: string) => {
      const ok = window.confirm("이 API Key를 폐기할까요? 폐기 후에는 복구할 수 없습니다.");
      if (!ok) return;

      setRevokingId(keyId);
      setError(null);
      try {
        await revokeApiKeyApi(keyId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "API Key를 폐기하지 못했습니다.");
      } finally {
        setRevokingId(null);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-4 pb-4">
      {rawKeyOnce ? (
        <ApiKeyCreatedSecret rawKey={rawKeyOnce} onDismiss={() => setRawKeyOnce(null)} />
      ) : null}

      <ApiKeyCreateForm onCreate={onCreate} creating={creating} />

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <section>
        <h2 className="mb-3 px-1 text-sm font-bold text-slate-900">발급된 API Key</h2>
        {loading ? (
          <div className="min-h-[120px] rounded-2xl bg-slate-50" aria-hidden />
        ) : items.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">
            아직 발급한 API Key가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((apiKey) => (
              <ApiKeyCard
                key={apiKey.id}
                apiKey={apiKey}
                onRevoke={onRevoke}
                revoking={revokingId === apiKey.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
