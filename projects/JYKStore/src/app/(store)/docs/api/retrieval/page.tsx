import Link from "next/link";
import { DocsCodeBlock } from "@/components/DocsCodeBlock";
import { RetrievalTestPanel } from "@/components/RetrievalTestPanel";
import {
  authHeaderExample,
  retrievalApiErrorCodes,
  retrievalCurlExample,
  retrievalErrorResponseExample,
  retrievalFetchExample,
  retrievalMetadataFilterKeys,
  retrievalRequestBody,
  retrievalResponseExample,
} from "@/lib/api-docs-content";
import { ROUTES } from "@/lib/routes";

export default function RetrievalApiDocsPage() {
  return (
    <div className="space-y-5">
      <Link
        href={ROUTES.apiDocs}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← API 개요
      </Link>

      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">Metadata Retrieval API</h1>
        <p className="mt-1 text-sm text-store-muted">
          Metadata Filter 기반 Context 검색 API입니다. Knowledge Retrieval Engine Foundation 단계로, Keyword +
          Metadata Ranking을 사용합니다.
        </p>
      </div>

      <section className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
        <h2 className="text-sm font-bold text-slate-900">Context API와 Retrieval API</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Context API: 외부 AI 도구가 간단히 context를 가져가는 기본 API입니다.</li>
          <li>
            Retrieval API: metadata filter, topK, includeMetadata를 명시적으로 제어하는 고급 검색 API입니다.
          </li>
          <li>JYKStore는 답변을 생성하지 않고 context 후보만 반환합니다.</li>
          <li>P13은 Vector/Embedding/RAG/LLM 호출을 포함하지 않습니다. (P14에서 hybrid ranking으로 확장 예정)</li>
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">인증</h2>
        <DocsCodeBlock code={authHeaderExample} language="http" />
        <p className="text-xs text-store-muted">API Key는 서버 환경변수에 보관하고 브라우저에 저장하지 않습니다.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">POST</span>
          <code className="text-xs text-slate-900">/api/v1/retrieval/query</code>
        </div>
        <p className="text-sm text-slate-700">
          metadata filter와 keyword ranking을 결합해 관련 context 후보를 반환합니다. query가 비어 있어도 metadata
          filter만으로 조회할 수 있습니다.
        </p>

        <h3 className="text-xs font-bold text-slate-800">Request body</h3>
        <DocsCodeBlock code={retrievalRequestBody} language="json" />

        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
          <li>knowledgePackId: 필수</li>
          <li>query: 선택 (있으면 keyword ranking 적용)</li>
          <li>filters: 선택 (허용되지 않은 key는 400 오류)</li>
          <li>topK: 선택, 기본 8, 최소 1, 최대 20</li>
          <li>includeMetadata: 선택, 기본 true</li>
        </ul>

        <h3 className="text-xs font-bold text-slate-800">curl 예제</h3>
        <DocsCodeBlock code={retrievalCurlExample} language="bash" />
        <h3 className="text-xs font-bold text-slate-800">fetch 예제</h3>
        <DocsCodeBlock code={retrievalFetchExample} language="typescript" />
      </section>

      <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold text-amber-950">filters 동작 기준 (중요)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          <li>filters는 점수 가산 조건이 아니라 후보 제한(AND) 조건입니다.</li>
          <li>filters가 지정되면 모든 metadata 조건을 만족한 chunk만 ranking 대상이 됩니다.</li>
          <li>query가 있어도 metadata filter를 통과하지 못한 chunk는 결과에 포함되지 않습니다.</li>
          <li>filters가 지정됐는데 metadata가 없는 chunk는 결과에서 제외됩니다.</li>
          <li>metadata value는 string 또는 string[]만 사용합니다.</li>
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Metadata filter key</h2>
        <p className="text-sm text-slate-700">
          아래 key만 허용됩니다. 그 외 key는 400 오류로 처리됩니다. alias key는 canonical key로 정규화됩니다.
        </p>
        <ul className="flex flex-wrap gap-1">
          {retrievalMetadataFilterKeys.map((key) => (
            <li
              key={key}
              className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700"
            >
              {key}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">응답 예시</h2>
        <DocsCodeBlock code={retrievalResponseExample} language="json" />
        <p className="text-xs text-store-muted">
          검색 결과는 keyword + metadata match 기반이며, matchReasons에 선택 근거를 표시합니다.
          includeMetadata=false이면 각 context의 metadata는 응답에서 제외됩니다.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">오류 응답</h2>
        <DocsCodeBlock code={retrievalErrorResponseExample} language="json" />
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-store-muted">
              <th className="border-b border-store-border py-2 pr-2">Status</th>
              <th className="border-b border-store-border py-2 pr-2">Code</th>
              <th className="border-b border-store-border py-2">설명</th>
            </tr>
          </thead>
          <tbody>
            {retrievalApiErrorCodes.map((row) => (
              <tr key={row.code} className="align-top">
                <td className="border-b border-slate-100 py-2 pr-2 font-mono text-slate-900">{row.status}</td>
                <td className="border-b border-slate-100 py-2 pr-2 font-mono text-slate-900">{row.code}</td>
                <td className="border-b border-slate-100 py-2 text-slate-700">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">테스트 콘솔</h2>
        <RetrievalTestPanel />
      </section>
    </div>
  );
}
