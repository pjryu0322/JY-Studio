"use client";

import Link from "next/link";
import { useState } from "react";
import type { KnowledgePack } from "@/types/pack";
import { AddToMyPacksButton } from "@/components/AddToMyPacksButton";
import { ApiConnectionInfo } from "@/components/ApiConnectionInfo";
import { CodeSnippet } from "@/components/CodeSnippet";
import { ConnectInfoCard } from "@/components/ConnectInfoCard";
import { ContextApiTestPanel } from "@/components/ContextApiTestPanel";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useMyPacks } from "@/hooks/useMyPacks";
import {
  createCurlExample,
  createCursorPromptExample,
  createGenericLlmPromptExample,
  createJavaScriptExample,
  createJavaSpringExample,
  createPythonExample,
  getPackContextEndpoint,
} from "@/lib/integration-examples";
import { ROUTES } from "@/lib/routes";

export function ConnectPageClient({ pack }: { readonly pack: KnowledgePack }) {
  const { mounted, isMyPack } = useMyPacks();
  const inLibrary = mounted && isMyPack(pack.packId);
  const endpoint = getPackContextEndpoint(pack.packId, { limit: 10 });
  const [issuedApiKey, setIssuedApiKey] = useState<string | undefined>(undefined);
  const mcpReady = pack.capabilities?.mcp.status === "READY";

  return (
    <div className="space-y-4 pb-4">
      <Link
        href={ROUTES.myPacks}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 내 지식팩
      </Link>

      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex gap-3">
          <span className="text-4xl" aria-hidden>
            {pack.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-lg font-bold text-slate-900">{pack.name}</h1>
              {pack.isVerified ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{pack.shortDescription}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-store-muted">
              <span className="font-mono text-slate-800">{pack.packId}</span>
              <span>· v{pack.version}</span>
            </div>
          </div>
        </div>
      </div>

      {mounted && !inLibrary ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm leading-relaxed text-amber-950">
            먼저 내 지식팩에 추가하면 관리 목록에서 다시 확인할 수 있습니다.
          </p>
          <div className="mt-3">
            <AddToMyPacksButton
              packId={pack.packId}
              variant="card"
              capabilities={pack.capabilities}
            />
          </div>
        </div>
      ) : null}

      <ApiConnectionInfo
        packId={pack.packId}
        packName={pack.name}
        endpoint={endpoint}
        onIssued={setIssuedApiKey}
      />

      <ContextApiTestPanel
        packId={pack.packId}
        packName={pack.name}
        initialApiKey={issuedApiKey}
      />

      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-base font-bold text-slate-900">예시 코드 복사</h2>
        <div className="mt-4 space-y-4">
          <CodeSnippet title="cURL" language="bash" code={createCurlExample(pack.packId)} />
          <CodeSnippet
            title="JavaScript fetch"
            language="javascript"
            code={createJavaScriptExample(pack.packId)}
          />
          <CodeSnippet title="Java / Spring" language="java" code={createJavaSpringExample(pack.packId)} />
          <CodeSnippet title="Python" language="python" code={createPythonExample(pack.packId)} />
        </div>
      </section>

      <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-base font-bold text-slate-900">AI 도구용 Prompt 복사</h2>
        <div className="mt-4 space-y-4">
          <CodeSnippet
            title="Cursor Prompt"
            description="Cursor 등 코딩 에이전트에 붙여 넣을 수 있는 안내 문구입니다."
            language="prompt"
            code={createCursorPromptExample(pack.packId, pack.name)}
          />
          <CodeSnippet
            title="Generic LLM Prompt"
            description="일반 LLM 채팅에 지식팩 근거를 명시할 때 사용합니다."
            language="prompt"
            code={createGenericLlmPromptExample(pack.packId, pack.name)}
          />
        </div>
      </section>

      {mcpReady ? (
        <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
          <h2 className="text-base font-bold text-slate-900">MCP 연결</h2>
          <p className="mt-2 text-sm leading-relaxed text-store-muted">
            이 지식팩은 MCP Bridge를 통해 Retrieval 도구로 연결할 수 있습니다. MCP 서버 설정과 API Key는 계정
            기준으로 사용합니다.
          </p>
          <div className="mt-4">
            <ConnectInfoCard
              label="MCP Manifest"
              value={`/api/v1/exports/mcp-manifest?knowledgePackId=${pack.packId}`}
              hint="Bearer API Key로 조회하는 MCP-ready 계약 문서입니다."
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
