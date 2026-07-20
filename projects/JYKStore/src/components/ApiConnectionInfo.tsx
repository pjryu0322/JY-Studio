"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectionInfoRow } from "@/components/ConnectionInfoRow";
import { CopyButton } from "@/components/CopyButton";
import { IssuedApiKeyNotice } from "@/components/IssuedApiKeyNotice";
import { API_KEY_PLACEHOLDER } from "@/lib/integration-examples";
import { ROUTES } from "@/lib/routes";
import { issueSelectedPackApiKey } from "@/lib/selected-pack-api-key-client";

const MASKED_API_KEY = "••••••••••••••••••••••••";

export function ApiConnectionInfo({
  packId,
  packName,
  endpoint,
  onIssued,
}: {
  readonly packId: string;
  readonly packName: string;
  readonly endpoint: string;
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

  const onHide = () => setRawKeyOnce(null);
  const apiKeyDisplay = rawKeyOnce ?? MASKED_API_KEY;
  const authorizationValue = `Bearer ${API_KEY_PLACEHOLDER}`;

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">API 연결 정보</h2>
          <p className="mt-1 text-sm leading-relaxed text-store-muted">
            외부 애플리케이션에서 이 지식팩을 호출할 때 필요한 정보입니다.
          </p>
        </div>
        <Link
          href={ROUTES.apiKeys}
          className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-store-accent"
        >
          API Key 전체 관리
        </Link>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-store-muted">
        이 Key는 사용자 계정의 API 호출에 사용되며 특정 지식팩 전용 Key가 아닙니다. Key 이름에는 지식팩 이름이
        참고용으로 포함될 수 있습니다.
      </p>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {rawKeyOnce ? <div className="mt-3"><IssuedApiKeyNotice rawKey={rawKeyOnce} onHide={onHide} /></div> : null}

      <div className="mt-3">
        <ConnectionInfoRow
          label="API Key"
          value={apiKeyDisplay}
          copyLabel="API Key 복사"
          actions={
            rawKeyOnce ? (
              <>
                <CopyButton value={rawKeyOnce} label="API Key 복사" className="min-w-[5.5rem]" />
                <button
                  type="button"
                  onClick={onHide}
                  className="inline-flex min-h-[44px] min-w-[5.5rem] items-center justify-center rounded-xl border border-store-border bg-white px-3 text-sm font-bold text-slate-700 active:bg-slate-50"
                >
                  숨기기
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void onIssue()}
                disabled={issuing}
                className="inline-flex min-h-[44px] min-w-[5.5rem] items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {issuing ? "발급 중…" : "API Key 발급"}
              </button>
            )
          }
        />
        <ConnectionInfoRow label="Pack ID" value={packId} copyLabel="Pack ID 복사" />
        <ConnectionInfoRow label="Endpoint" value={endpoint} copyLabel="Endpoint 복사" />
        <ConnectionInfoRow
          label="Authorization"
          value={authorizationValue}
          copyLabel="Authorization 헤더 형식 복사"
        />
      </div>
    </section>
  );
}
