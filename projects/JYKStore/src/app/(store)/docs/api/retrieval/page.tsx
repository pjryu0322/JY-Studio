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
          Metadata Filter 기반 Context 검색 API입니다. Metadata AND Filter → Keyword Ranking을 기본으로 하며,
          P14부터 local-hash embedding 기반 hybrid ranking을 선택할 수 있습니다.
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
          <li>
            P14 hybrid ranking은 local-hash embedding(dev/foundation provider)만 사용하며 외부 embedding/LLM API를
            호출하지 않습니다.
          </li>
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
          <li>knowledgePackId: 필수 (string)</li>
          <li>query: 선택 (string, 최대 2000자, 있으면 keyword ranking 적용)</li>
          <li>filters: 선택 (object, 허용되지 않은 key는 400 오류)</li>
          <li>topK: 선택, 기본 8, 최소 1, 최대 20</li>
          <li>includeMetadata: 선택, 기본 true (boolean)</li>
          <li>
            retrievalMode: 선택 (&quot;keyword&quot; | &quot;hybrid&quot;). 미지정 시 query가 있으면 hybrid,
            없으면 keyword로 동작합니다.
          </li>
          <li>잘못된 타입/필드는 400 INVALID_RETRIEVAL_REQUEST로 응답합니다.</li>
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

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Hybrid ranking (P14 foundation)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>처리 순서: metadata filter(AND) → keyword score → (hybrid) vector similarity → topK.</li>
          <li>metadata filter는 항상 vector/hybrid ranking보다 먼저 적용됩니다.</li>
          <li>
            hybrid score = keywordScore + metadataScore + cosineSimilarity × 100. embedding이 있는 chunk에만
            vector similarity가 가산됩니다.
          </li>
          <li>
            embedding이 없는 chunk는 keyword/metadata score로만 ranking됩니다. embedding 미생성 상태에서도
            Retrieval API는 실패하지 않습니다.
          </li>
          <li>
            정확한 hybrid 결과를 위해서는 Admin Chunk Manager의 &quot;embedding 재생성&quot;을 먼저 실행해야
            합니다.
          </li>
          <li>
            embedding은 local-hash-v1 provider로 생성합니다. 외부 embedding API 호출이 아니라 dev/foundation
            provider입니다.
          </li>
          <li>Vector DB/pgvector/외부 embedding provider는 향후 확장 예정입니다.</li>
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Candidate 수집 / stale 판정 (P14.1)</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>
            <code className="font-mono text-xs">candidateCollectionMode</code>:
            <span className="font-mono text-xs"> default-page</span>(filter·query 없음),
            <span className="font-mono text-xs"> metadata-filter</span>(filter 있음),
            <span className="font-mono text-xs"> query-scan</span>(filter 없고 query 있음).
          </li>
          <li>
            query가 있으면 filter가 없어도 첫 500개에 한정하지 않고 candidate를 paging scan합니다.
            (최대 5,000개)
          </li>
          <li>
            <code className="font-mono text-xs">scannedCandidateCount</code>는 실제 scan한 chunk 수,
            <code className="font-mono text-xs"> filteredCandidateCount</code>는 ranking 후보로 넘긴 수입니다.
          </li>
          <li>
            embedding contentHash는 title/content/section/tags 기준으로 계산합니다. metadata는 filter 조건으로만
            사용되며 embedding stale 판정에는 포함하지 않습니다.
          </li>
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

      <section className="space-y-3 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Knowledge Graph / Export (P15 foundation)</h2>
        <p className="text-sm text-store-muted">
          JYKStore는 지식팩을 다양한 AI 도구와 연계할 수 있도록 knowledge graph와 export를 제공합니다.
          JYKStore는 답변을 생성하지 않고 context / graph / export data만 제공하며, 답변 생성은 외부 AI 도구/LLM이
          수행합니다.
        </p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          JYKStore 서버는 OpenAI/Claude/Gemini 같은 외부 AI Provider를 직접 호출하지 않습니다. 반대로 외부 AI 도구·LLM
          Agent·OpenAI GPTs·Cursor/Copilot·타 플랫폼이 아래 public API를 <span className="font-semibold">Bearer API
          Key</span>로 호출해 context / graph / export data를 가져가는 구조는 지원합니다.
        </p>

        <h3 className="text-xs font-bold text-slate-900">Public API (외부 클라이언트 호출용)</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <span className="font-semibold">Graph Query API</span> —{" "}
            <code className="font-mono text-xs">POST /api/v1/graph/query</code> (Bearer API Key,{" "}
            <code className="font-mono text-xs">context:read</code> scope). knowledgePackId 기준으로 node/edge를
            조회합니다. label/summary/externalId contains 검색이며, graph traversal·semantic search·답변 생성은
            하지 않습니다.
          </li>
          <li>
            <span className="font-semibold">Package Export JSON</span> —{" "}
            <code className="font-mono text-xs">GET /api/v1/exports/package?knowledgePackId=&#123;packId&#125;</code>. pack /
            version / chunk / graph 메타를 포함하며 raw embedding vector는 제외합니다.
          </li>
          <li>
            <span className="font-semibold">RAG Export JSONL</span> —{" "}
            <code className="font-mono text-xs">GET /api/v1/exports/rag-jsonl?knowledgePackId=&#123;packId&#125;</code>. 외부
            RAG 시스템에 import 가능한 line-delimited JSON export입니다. 활성 chunk 1개 = 1 line.
          </li>
          <li>
            <span className="font-semibold">Graph Export JSON</span> —{" "}
            <code className="font-mono text-xs">GET /api/v1/exports/graph?knowledgePackId=&#123;packId&#125;</code>.
          </li>
          <li>
            <span className="font-semibold">Export Chunk APIs</span> —{" "}
            <code className="font-mono text-xs">
              GET /api/v1/exports/&#123;package|rag-jsonl|graph&#125;/chunk?knowledgePackId=&#123;packId&#125;&amp;offset=0&amp;limitBytes=256000
            </code>
            . 대용량 export는 <code className="font-mono text-xs">/chunk</code> endpoint를 사용해
            offset/limitBytes 단위로 나누어 조회할 수 있습니다.
          </li>
          <li>
            <span className="font-semibold">MCP-ready Manifest</span> —{" "}
            <code className="font-mono text-xs">GET /api/v1/exports/mcp-manifest?knowledgePackId=&#123;packId&#125;</code>.
            실제 MCP Server가 아니라 향후 MCP 연계를 위한 manifest(계약서)이며, 실제 API Key를 포함하지 않습니다.
          </li>
        </ul>
        <p className="text-xs text-store-muted">
          Public export API는 모두 <code className="font-mono">Authorization: Bearer &lt;JYKStore API Key&gt;</code> 인증을
          사용합니다. <code className="font-mono">knowledgePackId</code> 쿼리 파라미터가 없거나 비어 있으면 400(
          <code className="font-mono">INVALID_EXPORT_REQUEST</code>), chunk 파라미터 오류는 400(
          <code className="font-mono">INVALID_EXPORT_CHUNK_REQUEST</code>), 인증 실패 시 401/403을 반환합니다.
        </p>        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          모든 public API(Retrieval / Graph Query / Export)는 <span className="font-semibold">PUBLISHED 또는
          VERIFIED</span> 상태의 지식팩만 반환합니다. DRAFT / REVIEW / REJECTED / ARCHIVED 등 비공개 상태의 지식팩은
          존재 여부를 노출하지 않기 위해 <code className="font-mono">PACK_NOT_FOUND</code>(404)로 처리됩니다.
        </p>

        <h3 className="text-xs font-bold text-slate-900">Admin UI API (관리자 화면 다운로드용)</h3>
        <p className="text-xs text-store-muted">
          Admin 검수 화면에서는 동일한 export를{" "}
          <code className="font-mono">GET /api/v1/admin/packs/&#123;packId&#125;/exports/&#123;package|rag-jsonl|graph|mcp-manifest&#125;</code>{" "}
          경로로 제공하며, graph summary/rebuild는{" "}
          <code className="font-mono">/api/v1/admin/packs/&#123;packId&#125;/graph</code>,{" "}
          <code className="font-mono">/graph/rebuild</code>를 사용합니다.
        </p>

        <ul className="list-disc space-y-1 pl-5 text-xs text-store-muted">
          <li>Graph는 외부 LLM 없이 DB 데이터 기반 deterministic rebuild로 생성됩니다.</li>
          <li>Export/Graph에는 API Key, 사용자 정보, 과금 정보, audit log 등 민감 정보를 포함하지 않습니다.</li>
        </ul>

        <h3 className="text-xs font-bold text-slate-900">OpenAPI schema (P15.2)</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <span className="font-semibold">공통 schema</span> —{" "}
            <code className="font-mono text-xs">GET /api/v1/openapi.json</code>. JYKStore Public API 전체(OpenAPI
            3.1)를 반환하는 discovery endpoint로 인증이 필요 없습니다. schema 내 각 operation에는 Bearer 보안
            스키마가 명시됩니다.
          </li>
          <li>
            <span className="font-semibold">Pack 특화 schema</span> —{" "}
            <code className="font-mono text-xs">GET /api/v1/exports/openapi?knowledgePackId=&#123;packId&#125;</code>.
            Bearer API Key(<code className="font-mono text-xs">context:read</code>) 인증이 필요하고 PUBLISHED/VERIFIED
            pack만 반환합니다. <code className="font-mono text-xs">info.title</code>과 example에 해당 packId가 반영됩니다.
          </li>
        </ul>
        <p className="text-xs text-store-muted">
          Custom GPT Actions, Gemini function calling, Cursor/MCP wrapper 등 외부 AI 도구에 위 schema를 등록해 JYKStore
          Public API를 연동할 수 있습니다. 외부 클라이언트가 context/graph/export data를 받아 답변을 생성하며,
          JYKStore는 답변을 생성하지 않고 외부 LLM Provider API를 직접 호출하지 않습니다.
        </p>

        <h3 className="text-xs font-bold text-slate-900">외부 AI 도구 연동 방법</h3>

        <p className="text-sm font-semibold text-slate-800">1. Custom GPT Actions 연동</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>JYKStore에서 공개 상태(PUBLISHED/VERIFIED)의 지식팩 packId를 확인합니다.</li>
          <li>API Key를 발급하고 <code className="font-mono text-xs">context:read</code> scope를 부여합니다.</li>
          <li>
            Custom GPT Actions 설정에서 OpenAPI schema를 등록합니다. 공통 schema는{" "}
            <code className="font-mono text-xs">GET /api/v1/openapi.json</code>, 지식팩 특화 schema는{" "}
            <code className="font-mono text-xs">GET /api/v1/exports/openapi?knowledgePackId=&#123;packId&#125;</code>.
          </li>
          <li>Authentication은 Bearer API Key로 설정합니다.</li>
          <li>
            테스트 질의에서 <code className="font-mono text-xs">queryKnowledgePackContext</code> operation을 호출합니다.
          </li>
          <li>GPT는 JYKStore가 반환한 contexts를 근거로 답변을 생성합니다.</li>
        </ol>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          JYKStore API Key를 브라우저 localStorage/sessionStorage에 저장하지 않습니다. JYKStore는 답변을 생성하지 않고
          context만 반환하며, 답변 생성은 Custom GPT가 수행합니다.
        </p>
        <div>
          <p className="text-xs font-semibold text-slate-700">GPT Actions 테스트 질문 예시</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-store-muted">
            <li>간편인증 Callback 오류 처리 방법을 지식팩에서 찾아줘.</li>
            <li>Spring Boot 기준으로 간편인증 요청 API 예제를 찾아줘.</li>
            <li>운영환경 전환 시 확인해야 할 설정값을 지식팩에서 찾아줘.</li>
          </ul>
        </div>

        <p className="text-sm font-semibold text-slate-800">2. Gemini Function Calling wrapper 연동</p>
        <p className="text-sm text-slate-700">
          Gemini 연동은 애플리케이션 레이어에서 JYKStore OpenAPI schema를 function declaration 또는 tool wrapper로
          변환해 사용하는 방식입니다. JYKStore는 Gemini API를 직접 호출하지 않습니다.
        </p>

        <p className="text-sm font-semibold text-slate-800">3. Cursor / MCP wrapper 준비</p>
        <p className="text-sm text-slate-700">
          Cursor 연동은 현재 OpenAPI schema 또는 MCP-ready manifest를 기반으로 별도 wrapper를 구성하는 방식입니다.
          실제 JYKStore MCP Server runtime은 아직 제공하지 않습니다. MCP-ready manifest는 제공되며, P22 MCP Server Bridge에서 runtime을 다룹니다.
        </p>
      </section>
    </div>
  );
}
