"use client";

import Link from "next/link";
import type { KnowledgePack } from "@/types/pack";
import { PackCapabilityBadges } from "@/components/PackCapabilityBadges";
import { PackMetaGrid } from "@/components/PackMetaGrid";
import { PackPrimaryActions } from "@/components/PackPrimaryActions";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isPackApiIntegrationReady } from "@/lib/public-pack-capability";
import { ROUTES } from "@/lib/routes";

function providerTypeLabel(type: KnowledgePack["providerInfo"]["type"]): string {
  switch (type) {
    case "JYK_VERIFIED":
      return "검증 제공자";
    case "OFFICIAL":
      return "공식 제공";
    case "COMMUNITY":
      return "커뮤니티";
  }
}

function heroSummary(pack: KnowledgePack): string {
  const text = (pack.shortDescription || pack.description || "").trim();
  if (!text) return "";
  // Keep hero to roughly 2–3 lines.
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trim()}…`;
}

export function PackDetailHero({ pack }: { readonly pack: KnowledgePack }) {
  const displayName = pack.displayName?.trim() || pack.name;
  const capabilities = pack.capabilities;
  const apiReady = capabilities ? isPackApiIntegrationReady(capabilities) : false;
  const downloadReady = capabilities?.download.status === "READY" || pack.downloadInfo?.available;
  const summary = heroSummary(pack);

  return (
    <div className="space-y-4">
      <Link
        href={ROUTES.packs}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-store-accent"
      >
        ← 지식팩 목록
      </Link>
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <div className="flex gap-4">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-4xl"
            aria-hidden
          >
            {pack.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-lg font-bold leading-snug text-slate-900 break-words">{displayName}</h1>
              {pack.isVerified ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-1 text-sm text-store-muted">
              제공자: {pack.providerInfo.name}
              <span className="mx-1.5 text-slate-300">·</span>
              {providerTypeLabel(pack.providerInfo.type)}
            </p>
            <PackCapabilityBadges pack={pack} />
            {summary ? (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{summary}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <PackMetaGrid pack={pack} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-store-muted">
          {apiReady
            ? "이 지식팩은 API 연동과 원본 다운로드를 지원합니다."
            : downloadReady
              ? "다운로드형 지식팩입니다. 원본문서 다운로드가 가능하며 API·MCP 연동은 준비 중입니다."
              : "내 지식팩에 추가해 보관할 수 있습니다."}
        </p>
        <div className="mt-4">
          <PackPrimaryActions pack={pack} />
        </div>
      </div>
    </div>
  );
}
