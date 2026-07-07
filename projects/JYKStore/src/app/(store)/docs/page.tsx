import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const DOC_LINKS = [
  {
    title: "Context API",
    description: "지식팩 context 조회 및 query 검색 API 문서",
    href: ROUTES.contextApiDocs,
  },
  {
    title: "Metadata Retrieval API",
    description: "Metadata Filter 기반 고급 context 검색 API 문서",
    href: ROUTES.retrievalApiDocs,
  },
  {
    title: "API 개요 / API Key",
    description: "Base URL, 인증 방식, API Key 보안 정책",
    href: ROUTES.apiDocs,
  },
  {
    title: "TypeScript SDK 샘플",
    description: "fetch 기반 client 샘플 코드와 사용법",
    href: ROUTES.sdkDocs,
  },
  {
    title: "Provider Center",
    description: "지식팩 제공자 등록 및 관리",
    href: ROUTES.provider,
  },
] as const;

const FLOW_STEPS = [
  "지식팩 선택",
  "내 지식팩 추가",
  "API Key 발급",
  "Context API 테스트",
  "서비스 코드에 연동",
] as const;

export default function DocsHubPage() {
  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.account}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 계정
      </Link>

      <div className="px-1">
        <h1 className="text-lg font-bold text-slate-900">JYKStore 문서</h1>
        <p className="mt-1 text-sm text-store-muted">
          지식팩을 서비스에 연동하기 위한 API/SDK 문서입니다.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {DOC_LINKS.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href}
              className="flex min-h-[44px] flex-col justify-center rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
            >
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-store-muted">{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">추천 연동 흐름</h2>
        <ol className="mt-3 space-y-2">
          {FLOW_STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3 text-sm text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
