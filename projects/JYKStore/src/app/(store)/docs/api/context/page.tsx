import Link from "next/link";
import { DocsCodeBlock } from "@/components/DocsCodeBlock";
import {
  authHeaderExample,
  contextApiErrorCodes,
  contextQueryParameters,
  errorResponseExample,
  getContextCurlExample,
  getContextFetchExample,
  includeMetadataExcludedFields,
  postQueryCurlExample,
  postQueryFetchExample,
  postQueryRequestBody,
  successResponseExample,
} from "@/lib/api-docs-content";
import { ROUTES } from "@/lib/routes";

export default function ContextApiDocsPage() {
  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">인증</h2>
        <DocsCodeBlock code={authHeaderExample} language="http" />
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">GET</span>
          <code className="text-xs text-slate-900">/api/v1/packs/{"{packId}"}/context</code>
        </div>
        <p className="text-sm text-slate-700">지식팩의 활성 chunk context를 조회합니다.</p>

        <h3 className="text-xs font-bold text-slate-800">Query parameters</h3>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-store-muted">
              <th className="border-b border-store-border py-2 pr-2">이름</th>
              <th className="border-b border-store-border py-2 pr-2">타입</th>
              <th className="border-b border-store-border py-2 pr-2">필수</th>
              <th className="border-b border-store-border py-2">설명</th>
            </tr>
          </thead>
          <tbody>
            {contextQueryParameters.map((param) => (
              <tr key={param.name} className="align-top">
                <td className="border-b border-slate-100 py-2 pr-2 font-mono text-slate-900">{param.name}</td>
                <td className="border-b border-slate-100 py-2 pr-2 text-slate-700">{param.type}</td>
                <td className="border-b border-slate-100 py-2 pr-2 text-slate-700">
                  {param.required ? "예" : "아니오"}
                </td>
                <td className="border-b border-slate-100 py-2 text-slate-700">{param.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="text-xs font-bold text-slate-800">curl 예제</h3>
        <DocsCodeBlock code={getContextCurlExample} language="bash" />
        <h3 className="text-xs font-bold text-slate-800">fetch 예제</h3>
        <DocsCodeBlock code={getContextFetchExample} language="typescript" />
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">POST</span>
          <code className="text-xs text-slate-900">/api/v1/packs/{"{packId}"}/context/query</code>
        </div>
        <p className="text-sm text-slate-700">
          query 기반 keyword/ranking 검색으로 관련 chunk를 조회합니다.
        </p>

        <h3 className="text-xs font-bold text-slate-800">Request body</h3>
        <DocsCodeBlock code={postQueryRequestBody} language="json" />
        <h3 className="text-xs font-bold text-slate-800">curl 예제</h3>
        <DocsCodeBlock code={postQueryCurlExample} language="bash" />
        <h3 className="text-xs font-bold text-slate-800">fetch 예제</h3>
        <DocsCodeBlock code={postQueryFetchExample} language="typescript" />
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">성공 응답 예시</h2>
        <DocsCodeBlock code={successResponseExample} language="json" />
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-800">score / matchReasons</p>
          <p className="mt-1">
            query 검색 시 각 chunk의 <code className="rounded bg-white px-1">metadata.score</code>와{" "}
            <code className="rounded bg-white px-1">metadata.matchReasons</code>로 어떤 필드/토큰이 몇 점으로
            매칭됐는지 확인할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">includeMetadata=false</h2>
        <p className="text-sm text-slate-700">아래 정보는 응답에서 제외됩니다.</p>
        <ul className="flex flex-wrap gap-1">
          {includeMetadataExcludedFields.map((field) => (
            <li
              key={field}
              className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700"
            >
              {field}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">오류 응답</h2>
        <DocsCodeBlock code={errorResponseExample} language="json" />
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-store-muted">
              <th className="border-b border-store-border py-2 pr-2">Status</th>
              <th className="border-b border-store-border py-2 pr-2">Code</th>
              <th className="border-b border-store-border py-2">설명</th>
            </tr>
          </thead>
          <tbody>
            {contextApiErrorCodes.map((row) => (
              <tr key={row.code} className="align-top">
                <td className="border-b border-slate-100 py-2 pr-2 font-mono text-slate-900">{row.status}</td>
                <td className="border-b border-slate-100 py-2 pr-2 font-mono text-slate-900">{row.code}</td>
                <td className="border-b border-slate-100 py-2 text-slate-700">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Link
        href={ROUTES.sdkDocs}
        className="inline-flex min-h-[44px] items-center text-sm font-bold text-store-accent"
      >
        TypeScript SDK 샘플 보기 →
      </Link>
    </div>
  );
}
