"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { IssuedApiKeyNotice } from "@/components/IssuedApiKeyNotice";
import { issueSelectedPackApiKey } from "@/lib/selected-pack-api-key-client";

/**
 * Compact API Key issue control used by connect flows that already render Pack ID / Endpoint elsewhere.
 * Prefer {@link ApiConnectionInfo} on the connect page.
 */
export function SelectedPackApiKeyIssuePanel({
  packId,
  packName,
  onIssued,
}: {
  readonly packId: string;
  readonly packName: string;
  readonly onIssued: (rawKey: string) => void;
}) {
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawKeyOnce, setRawKeyOnce] = useState<string | null>(null);

  const onIssue = async () => {
    setIssuing(true);
    setError(null);
    try {
      const result = await issueSelectedPackApiKey({ packId, packName });
      setRawKeyOnce(result.rawKey);
      onIssued(result.rawKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API Key를 발급하지 못했습니다.");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-store-muted">
        이 Key는 사용자 계정의 API 호출에 사용되며 특정 지식팩 전용 Key가 아닙니다. Key 이름에는 지식팩 이름이
        참고용으로 포함될 수 있습니다.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {rawKeyOnce ? (
        <IssuedApiKeyNotice rawKey={rawKeyOnce} onHide={() => setRawKeyOnce(null)} />
      ) : (
        <button
          type="button"
          onClick={() => void onIssue()}
          disabled={issuing}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {issuing ? "발급 중…" : "API Key 발급"}
        </button>
      )}

      {rawKeyOnce ? (
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto break-all rounded-lg bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-800">
            {rawKeyOnce}
          </code>
          <CopyButton value={rawKeyOnce} label="Key 복사" className="min-w-[5.5rem]" />
        </div>
      ) : null}
    </div>
  );
}
