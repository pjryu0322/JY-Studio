import Link from "next/link";
import { DocsCodeBlock } from "@/components/DocsCodeBlock";
import {
  apiBaseUrls,
  authHeaderExample,
  contextApiEndpoints,
  contextApiErrorCodes,
  errorResponseExample,
  securityPolicies,
} from "@/lib/api-docs-content";
import { ROUTES } from "@/lib/routes";

export default function ApiDocsPage() {
  return (
    <div className="space-y-5">
      <Link
        href={ROUTES.docs}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 문서
      </Link>

      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">JYKStore API 개요</h1>
        <p className="mt-1 text-sm text-store-muted">
          Context API 인증 방식과 공통 정책을 설명합니다.
        </p>
      </div>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">API Base URL</h2>
        <dl className="space-y-1 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            <dt className="text-store-muted">개발</dt>
            <dd className="font-mono text-slate-900">{apiBaseUrls.development}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-store-muted">운영</dt>
            <dd className="text-slate-900">{apiBaseUrls.production}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">인증 방식</h2>
        <p className="text-sm text-slate-700">
          모든 요청은 <code className="rounded bg-slate-100 px-1">Authorization</code> 헤더에 Bearer 토큰으로
          API Key를 전달합니다.
        </p>
        <DocsCodeBlock code={authHeaderExample} language="http" />
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Context API endpoint</h2>
        <ul className="space-y-2">
          {contextApiEndpoints.map((endpoint) => (
            <li
              key={`${endpoint.method} ${endpoint.path}`}
              className="rounded-xl border border-store-border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                  {endpoint.method}
                </span>
                <code className="text-xs text-slate-900">{endpoint.path}</code>
              </div>
              <p className="mt-1 text-xs text-store-muted">{endpoint.description}</p>
            </li>
          ))}
        </ul>
        <Link
          href={ROUTES.contextApiDocs}
          className="inline-flex min-h-[44px] items-center text-sm font-bold text-store-accent"
        >
          Context API 상세 문서 →
        </Link>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Metadata Retrieval API</h2>
        <p className="text-sm text-slate-700">
          metadata filter, topK, includeMetadata를 명시적으로 제어하는 고급 검색 API입니다.
          Keyword + metadata ranking과 local-hash hybrid retrieval foundation(P14)을 지원하며,
          external embedding provider·pgvector·답변 생성은 포함하지 않습니다.
        </p>
        <div className="rounded-xl border border-store-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">POST</span>
            <code className="text-xs text-slate-900">/api/v1/retrieval/query</code>
          </div>
          <p className="mt-1 text-xs text-store-muted">Metadata Filter 기반 Context 후보 검색</p>
        </div>
        <Link
          href={ROUTES.retrievalApiDocs}
          className="inline-flex min-h-[44px] items-center text-sm font-bold text-store-accent"
        >
          Retrieval API 상세 문서 →
        </Link>
      </section>

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">에러 응답 형식</h2>
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

      <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold text-amber-950">보안 정책</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          {securityPolicies.map((policy) => (
            <li key={policy}>{policy}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
