"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProviderPackBasicInfoTab } from "@/components/ProviderPackBasicInfoTab";
import { ProviderDistributionTab } from "@/components/provider-distribution/ProviderDistributionTab";
import {
  computeDistributionReadiness,
} from "@/components/provider-distribution/ProviderDistributionReadiness";
import { ProviderPayloadTab } from "@/components/provider-distribution/ProviderPayloadTab";
import { ProviderKnowledgeGenerationTab } from "@/components/provider-distribution/ProviderKnowledgeGenerationTab";
import { ProviderPackReviewTab } from "@/components/ProviderPackReviewTab";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderPackTabs } from "@/components/ProviderPackTabs";
import type { PackDistributionMetadataDto } from "@/lib/distribution/distribution-metadata-service";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import { isDoclingPayloadPresent, isDoclingPayloadReady } from "@/lib/docling-import/docling-import-ui";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { PackLanguageCode } from "@/lib/pack-language";
import {
  resolveProviderEditableShortDescription,
  resolveProviderEditableVersionChangelog,
} from "@/lib/pack-summary-generator";
import {
  buildProviderPackProgress,
  isDistributionReadyForProgress,
  isMaterialReadyForProgress,
} from "@/lib/provider-pack-progress";
import {
  fetchProviderDoclingImportApi,
  fetchProviderKnowledgePipelineApi,
  fetchProviderPack,
  fetchProviderPackDistributionApi,
  submitProviderPackApi,
  updateProviderPackApi,
  withdrawProviderPackReviewApi,
  type DoclingKnowledgePipelineStatusDto,
} from "@/lib/provider-center-api";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabFromLocation,
  resolveProviderPackTabLocks,
  type ProviderPackTabId,
} from "@/lib/provider-pack-tabs";
import { providerPackDetailPath } from "@/lib/routes";
import {
  PROVIDER_PACK_ID_LABEL,
  PROVIDER_PACK_SAVE_DRAFT_SUCCESS,
  PROVIDER_REVIEW_WITHDRAW_CONFIRM,
  PROVIDER_SUBMIT_CONFIRM,
} from "@/lib/role-based-ux-copy";

export function ProviderPackEditor({ packId }: { readonly packId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCreatedBanner = searchParams.get("created") === "1";
  const [locationHash, setLocationHash] = useState("");

  const [pack, setPack] = useState<ProviderPackDetailDto | null>(null);
  const [doclingBundle, setDoclingBundle] = useState<DoclingImportBundlePublicDto | null>(null);
  const [distribution, setDistribution] = useState<PackDistributionMetadataDto | null>(null);
  const [knowledgeStatus, setKnowledgeStatus] =
    useState<DoclingKnowledgePipelineStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [basicFieldErrors, setBasicFieldErrors] = useState<{
    name?: string;
    shortDescription?: string;
    description?: string;
  }>({});

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [versionOverview, setVersionOverview] = useState("");
  const [language, setLanguage] = useState<PackLanguageCode | null>(null);

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
      const latestOverview = data.pack.versions[0]?.overview ?? "";
      const resolvedShort = resolveProviderEditableShortDescription({
        shortDescription: data.pack.shortDescription,
        overview: latestOverview,
      });
      setPack(data.pack);
      setName(data.pack.name);
      setShortDescription(resolvedShort);
      setDescription(data.pack.description);
      setLanguage(data.pack.versions[0]?.language ?? null);
      setVersionOverview(
        resolveProviderEditableVersionChangelog({
          overview: latestOverview,
          shortDescription: resolvedShort,
        }),
      );
      setSaveSuccessMessage(null);
      setBasicFieldErrors({});

      const [distRes, doclingRes, knowledgeRes] = await Promise.all([
        fetchProviderPackDistributionApi(packId).catch(() => ({ distribution: null })),
        fetchProviderDoclingImportApi(packId).catch(() => ({ bundle: null })),
        fetchProviderKnowledgePipelineApi(packId).catch(() => null),
      ]);
      setDistribution(distRes.distribution);
      setDoclingBundle(doclingRes.bundle);
      if (knowledgeRes) setKnowledgeStatus(knowledgeRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "지식팩을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceDocumentCount = pack?.versions[0]?.sourceDocuments.length ?? 0;
  const hasContentPayload = isDoclingPayloadPresent(doclingBundle?.status);
  const distributionMode = hasContentPayload || sourceDocumentCount === 0;

  const hasBasicInfo = Boolean(
    pack?.categoryId && shortDescription.trim() && description.trim() && name.trim(),
  );
  const hasLanguage = language === "ko" || language === "en";

  const distributionReadiness = useMemo(
    () =>
      computeDistributionReadiness({
        hasBasicInfo,
        hasLanguage,
        distribution,
        doclingBundle,
        knowledgePassed: Boolean(knowledgeStatus?.passed),
      }),
    [hasBasicInfo, hasLanguage, distribution, doclingBundle, knowledgeStatus?.passed],
  );

  const packProgress = useMemo(() => {
    if (!pack) return null;
    const working = pack.versions[0] ?? null;
    const materialReady = isMaterialReadyForProgress({
      sourceDocumentCount,
      payloadValidationStatus: null,
      doclingBundleStatus: isDoclingPayloadReady(doclingBundle?.status)
        ? "REVIEW_READY"
        : doclingBundle?.status ?? null,
    });
    const distributionReady = isDistributionReadyForProgress({
      sourceTitle: distribution?.sourceTitle,
      sourceUrl: distribution?.sourceUrl,
      licenseName: distribution?.licenseName,
    });

    return buildProviderPackProgress({
      packId: pack.packId,
      packStatus: pack.status,
      name: name || pack.name,
      categoryId: pack.categoryId,
      shortDescription: shortDescription || pack.shortDescription,
      description: description || pack.description,
      language: language ?? pack.versions[0]?.language ?? null,
      latestRejectionReason: pack.latestRejectionReason,
      workingVersion: working
        ? {
            id: working.id,
            version: working.version,
            sourceDocumentCount,
            materialReady,
            distributionReady,
          }
        : null,
      publishedVersion:
        pack.status === "PUBLISHED" || pack.status === "VERIFIED"
          ? working
            ? { id: working.id, version: working.version }
            : null
          : null,
    });
  }, [
    pack,
    name,
    shortDescription,
    description,
    language,
    sourceDocumentCount,
    distribution,
    doclingBundle,
  ]);

  const providerConfirmed = isDoclingPayloadReady(doclingBundle?.status);
  const knowledgePassed = Boolean(knowledgeStatus?.passed);

  const defaultTab = useMemo(
    () =>
      resolveDefaultProviderPackTab({
        created: showCreatedBanner,
        status: pack?.status ?? "DRAFT",
        sourceDocumentCount,
        hasPayload: isDoclingPayloadPresent(doclingBundle?.status),
        hasDistribution: Boolean(distribution),
        providerConfirmed,
        knowledgePassed,
      }),
    [
      showCreatedBanner,
      pack?.status,
      sourceDocumentCount,
      distribution,
      doclingBundle,
      providerConfirmed,
      knowledgePassed,
    ],
  );

  const activeTab = resolveProviderPackTabFromLocation({
    tabParam: searchParams.get("tab"),
    hash: locationHash,
    fallback: defaultTab,
  });

  const tabLocks = useMemo(
    () =>
      resolveProviderPackTabLocks({
        providerConfirmed,
        knowledgePassed,
        distributionReady: Boolean(
          distribution?.licenseName?.trim() &&
            (distribution?.sourceTitle?.trim() || distribution?.sourceUrl?.trim()),
        ),
      }),
    [providerConfirmed, knowledgePassed, distribution],
  );

  const selectTab = useCallback(
    (tab: ProviderPackTabId) => {
      if (tabLocks[tab]?.locked) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.delete("created");
      router.replace(`${providerPackDetailPath(packId)}?${params.toString()}`, { scroll: false });
    },
    [packId, router, searchParams, tabLocks],
  );

  const validateBasicInfo = useCallback(() => {
    const errors: {
      name?: string;
      shortDescription?: string;
      description?: string;
    } = {};
    const trimmedName = name.trim();
    const trimmedShort = shortDescription.trim();
    const trimmedDescription = description.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      errors.name = "이름은 2~100자로 입력해 주세요.";
    }
    if (trimmedShort.length < 10 || trimmedShort.length > 160) {
      errors.shortDescription = "한 줄 요약은 10~160자로 입력해 주세요.";
    }
    if (trimmedDescription.length < 20 || trimmedDescription.length > 1000) {
      errors.description = "상세 설명은 20~1000자로 입력해 주세요.";
    }

    setBasicFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, shortDescription, description]);

  const onSaveBasicInfo = useCallback(
    async (options?: { nextTab?: ProviderPackTabId }) => {
      if (!editable || saving) return;
      if (!validateBasicInfo()) return;

      setSaving(true);
      setError(null);
      setSaveSuccessMessage(null);
      try {
        const data = await updateProviderPackApi(packId, {
          name,
          shortDescription,
          description,
          versionOverview,
          language,
        });
        setPack(data.pack);
        setName(data.pack.name);
        setShortDescription(data.pack.shortDescription);
        setDescription(data.pack.description);
        setLanguage(data.pack.versions[0]?.language ?? null);
        setVersionOverview(
          resolveProviderEditableVersionChangelog({
            overview: data.pack.versions[0]?.overview ?? "",
            shortDescription: data.pack.shortDescription,
          }),
        );
        if (options?.nextTab) {
          selectTab(options.nextTab);
        } else {
          setSaveSuccessMessage(PROVIDER_PACK_SAVE_DRAFT_SUCCESS);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [
      editable,
      saving,
      validateBasicInfo,
      packId,
      name,
      shortDescription,
      description,
      versionOverview,
      language,
      selectTab,
    ],
  );

  const onSubmitReview = async () => {
    if (!editable) return;
    const ok = window.confirm(PROVIDER_SUBMIT_CONFIRM);
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

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl shrink-0">{pack.icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-lg font-bold text-slate-900 sm:truncate">
            {name.trim() || pack.name}
          </h1>
          <p className="break-all text-xs text-store-muted sm:truncate sm:break-normal">
            <span className="font-semibold text-slate-700">{PROVIDER_PACK_ID_LABEL}</span>{" "}
            <span className="font-mono">{pack.packId}</span>
          </p>
        </div>
        <ProviderPackStatusBadge status={pack.status} />
      </div>

      {packProgress ? (
        <div className="space-y-2">
          {packProgress.publishedVersion &&
          packProgress.workingVersion &&
          packProgress.publishedVersion.id !== packProgress.workingVersion.id ? (
            <p className="px-1 text-xs text-store-muted">
              공개 Version{" "}
              <span className="font-semibold text-slate-800">
                {packProgress.publishedVersion.version}
              </span>
              {" · "}
              작업 Version{" "}
              <span className="font-semibold text-slate-800">
                {packProgress.workingVersion.version}
              </span>
              {packProgress.currentStepLabel
                ? ` — ${packProgress.currentStepLabel}`
                : null}
            </p>
          ) : null}
        </div>
      ) : null}

      <ProviderPackTabs activeTab={activeTab} onSelectTab={selectTab} locks={tabLocks} />

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div id="pack-wizard-main" className="scroll-mt-24">
        {/* Keep tabs mounted (hidden) so Docling file selection / upload result survives tab switches. */}
        <div
          className={activeTab === "basic" ? undefined : "hidden"}
          aria-hidden={activeTab !== "basic"}
        >
          <ProviderPackBasicInfoTab
            editable={editable}
            name={name}
            shortDescription={shortDescription}
            description={description}
            versionOverview={versionOverview}
            language={language}
            versionLabel={latestVersion?.version ?? "—"}
            saving={saving}
            saveSuccessMessage={saveSuccessMessage}
            fieldErrors={basicFieldErrors}
            onNameChange={(value) => {
              setName(value);
              setSaveSuccessMessage(null);
              setBasicFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            onShortDescriptionChange={(value) => {
              setShortDescription(value);
              setSaveSuccessMessage(null);
              setBasicFieldErrors((prev) => ({ ...prev, shortDescription: undefined }));
            }}
            onDescriptionChange={(value) => {
              setDescription(value);
              setSaveSuccessMessage(null);
              setBasicFieldErrors((prev) => ({ ...prev, description: undefined }));
            }}
            onVersionOverviewChange={(value) => {
              setVersionOverview(value);
              setSaveSuccessMessage(null);
            }}
            onLanguageChange={(value) => {
              setLanguage(value);
              setSaveSuccessMessage(null);
            }}
            onSaveDraft={() => void onSaveBasicInfo()}
            onSaveAndContinue={() => void onSaveBasicInfo({ nextTab: "payload" })}
          />
        </div>

        <div
          className={activeTab === "payload" ? undefined : "hidden"}
          aria-hidden={activeTab !== "payload"}
        >
          <ProviderPayloadTab
            packId={packId}
            editable={editable}
            packStatus={pack.status}
            latestReviewStatus={pack.latestReviewStatus}
            cachedDoclingBundle={doclingBundle}
            onDoclingChanged={setDoclingBundle}
            onGoToKnowledge={() => selectTab("knowledge")}
            onPackUpdated={(next) => {
              setPack(next);
              setVersionOverview(next.versions[0]?.overview ?? "");
              setDoclingBundle(null);
              setDistribution(null);
            }}
          />
        </div>

        <div
          className={activeTab === "knowledge" ? undefined : "hidden"}
          aria-hidden={activeTab !== "knowledge"}
        >
          <ProviderKnowledgeGenerationTab
            packId={packId}
            editable={editable}
            onGoToDistribution={() => selectTab("distribution")}
            onStatusChange={setKnowledgeStatus}
          />
        </div>

        <div
          className={activeTab === "distribution" ? undefined : "hidden"}
          aria-hidden={activeTab !== "distribution"}
        >
          {tabLocks.distribution.locked ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {tabLocks.distribution.reason}
            </p>
          ) : (
            <ProviderDistributionTab
              packId={packId}
              editable={editable}
              onDistributionChanged={setDistribution}
            />
          )}
        </div>

        <div
          className={activeTab === "review" ? undefined : "hidden"}
          aria-hidden={activeTab !== "review"}
        >
          <ProviderPackReviewTab
            pack={pack}
            editable={editable}
            submitting={submitting}
            withdrawing={withdrawing}
            sourceDocumentCount={sourceDocumentCount}
            distributionMode={distributionMode}
            distributionReadiness={distributionReadiness}
            onSubmitReview={() => void onSubmitReview()}
            onWithdrawReview={() => void onWithdrawReview()}
            onGoToPayloadTab={() => selectTab("payload")}
            onGoToDistributionTab={() => selectTab("distribution")}
            onGoToKnowledgeTab={() => selectTab("knowledge")}
            onGoToBasicTab={() => selectTab("basic")}
          />
        </div>
      </div>
    </div>
  );
}
