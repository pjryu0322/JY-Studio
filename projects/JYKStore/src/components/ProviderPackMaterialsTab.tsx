"use client";

import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import { getSourceFormatLabel, getSourceTypeLabel } from "@/lib/source-type-dto";
import {
  PROVIDER_PACK_MATERIALS_EMPTY,
  PROVIDER_PACK_MATERIALS_HINT,
  PROVIDER_PACK_MATERIALS_TITLE,
  PROVIDER_PACK_GO_TO_REVIEW_TAB,
} from "@/lib/role-based-ux-copy";

export function ProviderPackMaterialsTab({
  pack,
  onGoToReviewTab,
}: {
  readonly pack: ProviderPackDetailDto;
  readonly onGoToReviewTab: () => void;
}) {
  const docs = pack.versions.flatMap((version) =>
    version.sourceDocuments.map((doc) => ({
      ...doc,
      versionLabel: version.version,
    })),
  );

  return (
    <section
      id="pack-materials"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div>
        <h2 className="text-sm font-bold text-slate-900">{PROVIDER_PACK_MATERIALS_TITLE}</h2>
        <p className="mt-1 text-xs leading-relaxed text-store-muted">{PROVIDER_PACK_MATERIALS_HINT}</p>
      </div>

      {docs.length === 0 ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-950">
          {PROVIDER_PACK_MATERIALS_EMPTY}
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-xs text-slate-800"
            >
              <p className="font-semibold text-slate-900">{doc.title || doc.sourceUrl || doc.id}</p>
              <p className="mt-1 text-store-muted">
                v{doc.versionLabel} · {getSourceTypeLabel(doc.sourceType)} ·{" "}
                {getSourceFormatLabel(doc.sourceFormat)}
                {doc.validationStatus ? ` · 검증 ${doc.validationStatus}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onGoToReviewTab}
        className="min-h-[44px] rounded-xl bg-store-accent px-4 text-xs font-bold text-white"
      >
        {PROVIDER_PACK_GO_TO_REVIEW_TAB}
      </button>
    </section>
  );
}
