"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProviderPackBasicInfoTab } from "@/components/ProviderPackBasicInfoTab";
import { ProviderPackDraftTab } from "@/components/ProviderPackDraftTab";
import { ProviderPackInspectionTab } from "@/components/ProviderPackInspectionTab";
import { ProviderPackReviewTab } from "@/components/ProviderPackReviewTab";
import { ProviderPackSourceTab } from "@/components/ProviderPackSourceTab";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderPackTabs } from "@/components/ProviderPackTabs";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  fetchProviderPack,
  fetchProviderKnowledgeUnitDraftsApi,
  submitProviderPackApi,
  updateProviderPackApi,
  withdrawProviderPackReviewApi,
} from "@/lib/provider-center-api";
import { buildProviderInspectionReadiness } from "@/lib/provider-pack-inspection-readiness";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabFromLocation,
  type ProviderPackTabId,
} from "@/lib/provider-pack-tabs";
import { providerPackDetailPath } from "@/lib/routes";
import {
  PROVIDER_PACK_CREATED_BANNER_TITLE,
  PROVIDER_PACK_CREATED_COLLECT_CTA,
  PROVIDER_PACK_CREATED_ID_PREFIX,
  PROVIDER_PACK_CREATED_NEXT_TASK,
  PROVIDER_PACK_GO_TO_INSPECTION_SHORT,
  PROVIDER_PACK_GO_TO_REVIEW_TAB,
  PROVIDER_PACK_ID_LABEL,
  PROVIDER_PACK_NEXT_TASK_INSPECTION,
  PROVIDER_PACK_NEXT_TASK_SUBMIT,
  PROVIDER_PACK_NEXT_TASK_WAITING_ADMIN,
  PROVIDER_REVIEW_WITHDRAW_CONFIRM,
} from "@/lib/role-based-ux-copy";

export function ProviderPackEditor({ packId }: { readonly packId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCreatedBanner = searchParams.get("created") === "1";
  const [locationHash, setLocationHash] = useState("");

  const [pack, setPack] = useState<ProviderPackDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [draftRefreshNonce, setDraftRefreshNonce] = useState(0);
  const [knowledgeUnitDraftCount, setKnowledgeUnitDraftCount] = useState(0);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [versionOverview, setVersionOverview] = useState("");

  const editable = pack?.status === "DRAFT";

  useEffect(() => {
    const syncHash = () => setLocationHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderPack(packId);
      setPack(data.pack);
      setName(data.pack.name);
      setShortDescription(data.pack.shortDescription);
      setDescription(data.pack.description);
      setVersionOverview(data.pack.versions[0]?.overview ?? "");
      setDraftRefreshNonce((n) => n + 1);
      if (data.pack.status === "DRAFT") {
        try {
          const drafts = await fetchProviderKnowledgeUnitDraftsApi(packId);
          setKnowledgeUnitDraftCount(drafts.items.length);
        } catch {
          setKnowledgeUnitDraftCount(0);
        }
      } else {
        setKnowledgeUnitDraftCount(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식팩을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceDocumentCount =
    pack?.versions[0]?.sourceDocuments.length ??
    pack?.versions.flatMap((v) => v.sourceDocuments).length ??
    0;

  const inspectionReadiness = useMemo(() => {
    if (!pack) return null;
    return buildProviderInspectionReadiness({
      pack,
      sourceDocumentCount,
      knowledgeUnitDraftCount,
    });
  }, [pack, sourceDocumentCount, knowledgeUnitDraftCount]);

  const defaultTab = useMemo(
    () =>
      resolveDefaultProviderPackTab({
        created: showCreatedBanner,
        status: pack?.status ?? "DRAFT",
        sourceDocumentCount,
        knowledgeUnitDraftCount,
        inspectionComplete: inspectionReadiness?.canSubmitReview ?? false,
      }),
    [
      showCreatedBanner,
      pack?.status,
      sourceDocumentCount,
      knowledgeUnitDraftCount,
      inspectionReadiness?.canSubmitReview,
    ],
  );

  const activeTab = resolveProviderPackTabFromLocation({
    tabParam: searchParams.get("tab"),
    hash: locationHash,
    fallback: defaultTab,
  });

  const selectTab = useCallback(
    (tab: ProviderPackTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.delete("created");
      router.replace(`${providerPackDetailPath(packId)}?${params.toString()}`, { scroll: false });
    },
    [packId, router, searchParams],
  );

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editable) return;
    setSaving(true);
    setError(null);
    try {
      const data = await updateProviderPackApi(packId, {
        name,
        shortDescription,
        description,
        versionOverview,
      });
      setPack(data.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitReview = async () => {
    if (!editable) return;
    const ok = window.confirm(
      "최종 점검 후 검수 요청을 제출할까요? 제출 시 시스템이 최신 품질 점검을 다시 실행하며, 통과 후에는 초안 수정이 제한됩니다.",
    );
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await submitProviderPackApi(packId);
      setPack(data.pack);
      selectTab("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const onWithdrawReview = async () => {
    const ok = window.confirm(PROVIDER_REVIEW_WITHDRAW_CONFIRM);
    if (!ok) return;
    setWithdrawing(true);
    setError(null);
    try {
      const data = await withdrawProviderPackReviewApi(packId);
      setPack(data.pack);
      selectTab("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 요청 회수에 실패했습니다.");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!pack) {
    return <p className="text-sm text-red-700">{error ?? "지식팩을 찾을 수 없습니다."}</p>;
  }

  const latestVersion = pack.versions[0];
  const showNextTask =
    !showCreatedBanner &&
    sourceDocumentCount > 0 &&
    knowledgeUnitDraftCount > 0 &&
    (pack.status === "DRAFT" || pack.status === "REVIEWING");

  return (
    <div className="space-y-4 pb-6">
      {showCreatedBanner ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-900">
          <p className="font-semibold">{PROVIDER_PACK_CREATED_BANNER_TITLE}</p>
          <p className="mt-1 text-xs text-slate-700">
            {PROVIDER_PACK_CREATED_ID_PREFIX}{" "}
            <span className="font-mono font-semibold text-slate-900">{pack.packId}</span>
          </p>
          <p className="mt-1 text-xs text-slate-700">{PROVIDER_PACK_CREATED_NEXT_TASK}</p>
          <button
            type="button"
            onClick={() => selectTab("source")}
            className="mt-2 text-xs font-bold text-store-accent underline-offset-2 hover:underline"
          >
            {PROVIDER_PACK_CREATED_COLLECT_CTA}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl">{pack.icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{pack.name}</h1>
          <p className="text-xs text-store-muted">
            <span className="font-semibold text-slate-700">{PROVIDER_PACK_ID_LABEL}</span>{" "}
            <span className="font-mono">{pack.packId}</span>
          </p>
        </div>
        <ProviderPackStatusBadge status={pack.status} />
      </div>

      {showNextTask && inspectionReadiness ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-900">
          <p className="text-xs font-bold text-blue-900">다음 할 일</p>
          {pack.status === "REVIEWING" ? (
            <p className="mt-1 text-xs text-slate-700">{PROVIDER_PACK_NEXT_TASK_WAITING_ADMIN}</p>
          ) : inspectionReadiness.canSubmitReview ? (
            <>
              <p className="mt-1 text-xs text-slate-700">{PROVIDER_PACK_NEXT_TASK_SUBMIT}</p>
              <button
                type="button"
                onClick={() => selectTab("review")}
                className="mt-2 min-h-[40px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
              >
                {PROVIDER_PACK_GO_TO_REVIEW_TAB}
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-700">{PROVIDER_PACK_NEXT_TASK_INSPECTION}</p>
              <button
                type="button"
                onClick={() => selectTab("inspection")}
                className="mt-2 min-h-[40px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
              >
                {PROVIDER_PACK_GO_TO_INSPECTION_SHORT}
              </button>
            </>
          )}
        </div>
      ) : null}

      <ProviderPackTabs activeTab={activeTab} onSelectTab={selectTab} />

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div id="pack-wizard-main" className="scroll-mt-24">
        {activeTab === "basic" ? (
          <ProviderPackBasicInfoTab
            packId={pack.packId}
            packName={pack.name}
            editable={editable}
            name={name}
            shortDescription={shortDescription}
            description={description}
            versionOverview={versionOverview}
            versionLabel={latestVersion?.version ?? "—"}
            saving={saving}
            onNameChange={setName}
            onShortDescriptionChange={setShortDescription}
            onDescriptionChange={setDescription}
            onVersionOverviewChange={setVersionOverview}
            onSave={onSave}
          />
        ) : null}

        {activeTab === "source" ? (
          <ProviderPackSourceTab
            packId={packId}
            editable={editable}
            sourceDocumentCount={sourceDocumentCount}
            onChanged={load}
            onGoToDraftTab={() => selectTab("draft")}
          />
        ) : null}

        {activeTab === "draft" ? (
          <ProviderPackDraftTab
            packId={packId}
            editable={editable}
            sourceDocumentCount={sourceDocumentCount}
            knowledgeUnitDraftCount={knowledgeUnitDraftCount}
            draftRefreshNonce={draftRefreshNonce}
            onChanged={load}
            onGoToSourceTab={() => selectTab("source")}
          />
        ) : null}

        {activeTab === "inspection" ? (
          <ProviderPackInspectionTab
            packId={packId}
            pack={pack}
            editable={editable}
            sourceDocumentCount={sourceDocumentCount}
            knowledgeUnitDraftCount={knowledgeUnitDraftCount}
            onGoToSourceTab={() => selectTab("source")}
            onGoToDraftTab={() => selectTab("draft")}
            onGoToReviewTab={() => selectTab("review")}
            onPackUpdated={setPack}
          />
        ) : null}

        {activeTab === "review" ? (
          <ProviderPackReviewTab
            pack={pack}
            editable={editable}
            submitting={submitting}
            withdrawing={withdrawing}
            sourceDocumentCount={sourceDocumentCount}
            knowledgeUnitDraftCount={knowledgeUnitDraftCount}
            onSubmitReview={() => void onSubmitReview()}
            onWithdrawReview={() => void onWithdrawReview()}
            onGoToSourceTab={() => selectTab("source")}
            onGoToInspectionTab={() => selectTab("inspection")}
          />
        ) : null}
      </div>
    </div>
  );
}
