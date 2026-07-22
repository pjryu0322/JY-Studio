import Link from "next/link";
import { DocsCodeBlock } from "@/components/DocsCodeBlock";
import {
  sdkClientUsageExample,
  sdkErrorHandlingExample,
  sdkGetContextExample,
} from "@/lib/api-docs-content";
import { ROUTES } from "@/lib/routes";

export default function SdkDocsPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm leading-relaxed text-slate-800">
          현재 SDK는 npm package가 아니라 프로젝트에 복사해 사용할 수 있는 TypeScript 샘플입니다. 샘플 파일은{" "}
          <code className="rounded bg-white px-1">sdk/typescript/</code> 경로에 있습니다.
        </p>
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">환경변수 설정</h2>
        <p className="text-sm text-slate-700">
          API Key는 코드에 하드코딩하지 않고 서버 환경변수로 주입합니다.
        </p>
        <DocsCodeBlock
          code={`JYKSTORE_BASE_URL=http://localhost:3004
JYKSTORE_API_KEY=jyk_live_xxx`}
          language="dotenv"
        />
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">queryContext 예제</h2>
        <DocsCodeBlock code={sdkClientUsageExample} language="typescript" />
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">getContext 예제</h2>
        <DocsCodeBlock code={sdkGetContextExample} language="typescript" />
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">에러 처리 예제</h2>
        <DocsCodeBlock code={sdkErrorHandlingExample} language="typescript" />
      </section>

      <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold text-amber-950">API Key 보안 주의</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          <li>API Key는 서버 환경변수에 저장하고 클라이언트 번들에 포함하지 않습니다.</li>
          <li>localStorage/sessionStorage에 저장하지 않습니다.</li>
          <li>URL query로 전달하지 않습니다.</li>
          <li>유출 시 즉시 revoke 합니다.</li>
        </ul>
      </section>

      <Link
        href={ROUTES.contextApiDocs}
        className="inline-flex min-h-[44px] items-center text-sm font-bold text-store-accent"
      >
        Context API 문서 보기 →
      </Link>
    </div>
  );
}
