"use client";

import { useState } from "react";
import { ProviderGitHubAutoCollectPanel } from "@/components/ProviderGitHubAutoCollectPanel";
import { ProviderSourceDocumentForm } from "@/components/ProviderSourceDocumentForm";
import {
  PROVIDER_PACK_SOURCE_METHOD_GITHUB,
  PROVIDER_PACK_SOURCE_METHOD_GITHUB_BADGE,
  PROVIDER_PACK_SOURCE_METHOD_MANUAL,
  PROVIDER_PACK_SOURCE_STEP_TITLE,
  PROVIDER_PACK_WIZARD_SOURCE_STEP,
} from "@/lib/role-based-ux-copy";

type SourceMethod = "github" | "manual";

export function ProviderPackSourceStep({
  packId,
  editable,
  sourceDocumentCount,
  onChanged,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly sourceDocumentCount: number;
  readonly onChanged: () => Promise<void>;
}) {
  const [method, setMethod] = useState<SourceMethod>("github");

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-store-accent">2단계</p>
      <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_WIZARD_SOURCE_STEP}</h2>
      <p className="mt-1 text-xs text-store-muted">{PROVIDER_PACK_SOURCE_STEP_TITLE}</p>

      {sourceDocumentCount > 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          원천 문서 {sourceDocumentCount}개 등록됨
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setMethod("github")}
          className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-bold ${
            method === "github"
              ? "border-store-accent bg-blue-50 text-store-accent"
              : "border-store-border bg-white text-slate-800"
          }`}
        >
          {PROVIDER_PACK_SOURCE_METHOD_GITHUB}{" "}
          <span className="text-[11px] font-semibold text-emerald-700">
            ({PROVIDER_PACK_SOURCE_METHOD_GITHUB_BADGE})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMethod("manual")}
          className={`min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-bold ${
            method === "manual"
              ? "border-store-accent bg-blue-50 text-store-accent"
              : "border-store-border bg-white text-slate-800"
          }`}
        >
          {PROVIDER_PACK_SOURCE_METHOD_MANUAL}
        </button>
      </div>

      {method === "github" ? (
        <ProviderGitHubAutoCollectPanel
          packId={packId}
          disabled={!editable}
          onChanged={onChanged}
          wizardMode
        />
      ) : (
        <div className="mt-4 rounded-2xl border border-store-border bg-slate-50 p-4">
          <ProviderSourceDocumentForm packId={packId} disabled={!editable} onAdded={onChanged} />
        </div>
      )}
    </section>
  );
}
