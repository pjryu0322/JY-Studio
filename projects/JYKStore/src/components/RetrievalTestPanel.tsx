"use client";

import { FormEvent, useState } from "react";
import { runRetrievalApiTest, type RetrievalApiTestResult } from "@/lib/retrieval-api";

export function RetrievalTestPanel() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [knowledgePackId, setKnowledgePackId] = useState("easy-auth");
  const [query, setQuery] = useState("");
  const [filtersText, setFiltersText] = useState(
    '{\n  "documentType": "SAMPLE_CODE",\n  "programmingLanguage": "Java"\n}',
  );
  const [topK, setTopK] = useState(8);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<RetrievalApiTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!apiKey.trim()) {
      setError("API Key를 입력해 주세요.");
      return;
    }
    if (!knowledgePackId.trim()) {
      setError("knowledgePackId를 입력해 주세요.");
      return;
    }

    let filters: Record<string, unknown> | undefined;
    const trimmedFilters = filtersText.trim();
    if (trimmedFilters) {
      try {
        const parsed = JSON.parse(trimmedFilters);
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("filters는 JSON object여야 합니다.");
          return;
        }
        filters = parsed as Record<string, unknown>;
      } catch {
        setError("filters JSON을 파싱하지 못했습니다.");
        return;
      }
    }

    setTesting(true);
    try {
      const testResult = await runRetrievalApiTest({
        apiKey: apiKey.trim(),
        knowledgePackId: knowledgePackId.trim(),
        query: query.trim() || undefined,
        filters,
        topK,
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
        Metadata Retrieval API를 직접 호출해 응답을 확인합니다. API Key는 이 화면에서만 사용되며 저장하지
        않습니다. JYKStore는 답변을 생성하지 않고 context 후보만 반환합니다.
      </p>

      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="retrieval-api-key">
          API Key
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="retrieval-api-key"
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

      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="retrieval-pack-id">
          knowledgePackId
        </label>
        <input
          id="retrieval-pack-id"
          value={knowledgePackId}
          onChange={(e) => setKnowledgePackId(e.target.value)}
          placeholder="예: easy-auth"
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="retrieval-query">
          query (선택)
        </label>
        <input
          id="retrieval-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: Callback 예제를 보여줘"
          className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700" htmlFor="retrieval-filters">
          filters (JSON, 선택)
        </label>
        <textarea
          id="retrieval-filters"
          value={filtersText}
          onChange={(e) => setFiltersText(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="retrieval-topk">
            topK
          </label>
          <select
            id="retrieval-topk"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="mt-2 min-h-[44px] rounded-xl border border-store-border px-3 text-sm"
          >
            {[3, 5, 8, 10, 20].map((n) => (
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
        {testing ? "호출 중…" : "Retrieval API 테스트"}
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
              <dt className="text-store-muted">contextCount</dt>
              <dd className="font-semibold text-slate-900">{result.contextCount ?? "—"}</dd>
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
