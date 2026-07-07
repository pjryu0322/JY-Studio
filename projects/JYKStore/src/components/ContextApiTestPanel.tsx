"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  runContextApiTest,
  type ContextApiTestResult,
} from "@/lib/context-api-test-client";
import { ROUTES } from "@/lib/routes";

export function ContextApiTestPanel({
  packId,
  packName,
  initialApiKey,
}: {
  readonly packId: string;
  readonly packName: string;
  readonly initialApiKey?: string;
}) {
  const [apiKey, setApiKey] = useState(initialApiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ContextApiTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialApiKey) {
      setApiKey(initialApiKey);
    }
  }, [initialApiKey]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!apiKey.trim()) {
      setError("API Key를 입력하거나 위에서 새 API Key를 발급해 주세요.");
      return;
    }

    setTesting(true);
    try {
      const testResult = await runContextApiTest({
        packId,
        apiKey: apiKey.trim(),
        method,
        query: query.trim() || undefined,
        limit,
        includeMetadata,
      });
      setResult(testResult);
    } catch {
      setError("네트워크 오류로 테스트를 완료하지 못했습니다.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-store-muted">
        <span className="font-semibold text-slate-800">{packName}</span> ({packId})의 Context API 응답을
        확인합니다. API Key는 이 화면에서만 사용되며 새로고침 시 사라집니다.
      </p>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-700">
        API 연동 전 Context API 문서와 TypeScript SDK 샘플을 확인하세요.
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={ROUTES.contextApiDocs} className="font-semibold text-store-accent">
            Context API 문서 →
          </Link>
          <Link href={ROUTES.sdkDocs} className="font-semibold text-store-accent">
            TypeScript SDK 샘플 →
          </Link>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="context-test-api-key">
          API Key
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="context-test-api-key"
            type={showKey ? "text" : "password"}
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="발급한 API Key"
            className="min-h-[44px] flex-1 rounded-xl border border-store-border px-3 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="shrink-0 rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-700"
          >
            {showKey ? "숨기기" : "보이기"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-700">Method</span>
          <div className="mt-2 flex gap-2">
            {(["GET", "POST"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${
                  method === m ? "bg-store-accent text-white" : "border border-store-border bg-white text-slate-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="context-test-query">
          검색어 (q / query)
        </label>
        <input
          id="context-test-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: callback 오류, 인증 요청, 토큰 만료"
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <p className="mt-2 text-xs text-store-muted">
          query를 입력하면 title/content/section/tags/chunkType 기준으로 chunk ranking이 적용됩니다.
          includeMetadata=true일 때 응답 JSON에서 각 chunk의 <span className="font-semibold">score</span>와{" "}
          <span className="font-semibold">matchReasons</span>를 확인할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="context-test-limit">
            limit
          </label>
          <select
            id="context-test-limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-2 min-h-[44px] rounded-xl border border-store-border px-3 text-sm"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-[44px] items-end gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeMetadata}
            onChange={(e) => setIncludeMetadata(e.target.checked)}
            className="h-4 w-4 rounded border-store-border"
          />
          includeMetadata
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={testing}
        className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
      >
        {testing ? "호출 중…" : "Context API 테스트"}
      </button>

      {result ? (
        <div className="space-y-3 rounded-2xl border border-store-border bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-900">결과 요약</h3>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-store-muted">상태</dt>
              <dd className="font-mono font-semibold text-slate-900">
                {result.status} {result.statusText}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-store-muted">requestId</dt>
              <dd className="truncate font-mono text-xs text-slate-800">{result.requestId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-store-muted">chunkCount</dt>
              <dd className="font-semibold text-slate-900">{result.chunkCount ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-store-muted">응답 시간</dt>
              <dd className="font-semibold text-slate-900">{result.elapsedMs}ms</dd>
            </div>
            {result.errorMessage ? (
              <div className="flex justify-between gap-2">
                <dt className="text-store-muted">메시지</dt>
                <dd className="text-right text-red-800">{result.errorMessage}</dd>
              </div>
            ) : null}
          </dl>
          <div>
            <p className="text-xs font-semibold text-slate-700">응답 JSON</p>
            <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-white p-3 text-[11px] leading-relaxed text-slate-800">
              {JSON.stringify(result.responseBody, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </form>
  );
}
