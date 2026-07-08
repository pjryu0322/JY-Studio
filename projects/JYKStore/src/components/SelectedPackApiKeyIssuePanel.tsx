"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { issueSelectedPackApiKey } from "@/lib/selected-pack-api-key-client";

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
    <div className="space-y-3">
      <p className="text-sm text-store-muted">
        선택한 지식팩의 Context API 테스트에 사용할 Key를 발급합니다. 이 Key는 현재 브라우저 식별자(clientId) 기준으로
        발급되며, Context API 연동 테스트에 사용할 수 있습니다. (packId 전용 Key는 아닙니다.)
      </p>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {rawKeyOnce ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-950">API Key가 발급되었습니다</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            API Key는 이번에만 표시됩니다. 복사한 뒤 숨길 수 있습니다. 숨긴 뒤에도 아래 Context API 테스트 패널에는 이미
            반영되어 있습니다.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 text-xs text-slate-800">
              {rawKeyOnce}
            </code>
            <CopyButton value={rawKeyOnce} label="Key 복사" className="w-full sm:w-auto" />
          </div>
          <button
            type="button"
            onClick={() => setRawKeyOnce(null)}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 active:bg-slate-50"
          >
            확인했습니다 / Key 숨기기
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void onIssue()}
          disabled={issuing}
          className="min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {issuing ? "발급 중…" : "이 지식팩 연동용 API Key 발급"}
        </button>
      )}
    </div>
  );
}
