"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProviderPackBasicInfoTab } from "@/components/ProviderPackBasicInfoTab";
import { ProviderDistributionTab } from "@/components/provider-distribution/ProviderDistributionTab";
import { ProviderServiceValidationTab } from "@/components/provider-distribution/ProviderServiceValidationTab";
import {
  computeDistributionReadiness,
} from "@/components/provider-distribution/ProviderDistributionReadiness";
import { ProviderPayloadTab } from "@/components/provider-distribution/ProviderPayloadTab";
import { ProviderKnowledgeGenerationTab } from "@/components/provider-distribution/ProviderKnowledgeGenerationTab";
import { ProviderPackReviewTab } from "@/components/ProviderPackReviewTab";
import { ProviderPackStatusBadge } from "@/components/ProviderPackStatusBadge";
import { ProviderGenerationReviewPanel } from "@/components/ProviderGenerationReviewPanel";
import type { PackDistributionMetadataDto } from "@/lib/distribution/distribution-metadata-service";
import { isDistributionReadyForServiceValidation } from "@/lib/distribution/service-channel-policy";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import { isDoclingPayloadPresent } from "@/lib/docling-import/docling-import-ui";
import {
  doclingBundlePublicToMaterialContext,
  isDoclingSourceMaterialsReady,
} from "@/lib/docling-import/docling-source-materials-readiness";
import type { SearchDataUiState } from "@/lib/search-data/search-data-state";
import {
  resolveDistributionStepLockMessage,
  resolveSearchValidationStepDisplayState,
} from "@/lib/search-data/search-validation-ux-state";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { PackLanguageCode } from "@/lib/pack-language";
import {
  resolveProviderEditableShortDescription,
  resolveProviderEditableVersionChangelog,
} from "@/lib/pack-summary-generator";
import {
  buildProviderPackProgress,
  isDistributionReadyForProgress,
} from "@/lib/provider-pack-progress";
import { isOpenPackReviewStatus } from "@/lib/pack-review-status";
import {
  isAdminGenerationHoldActive,
  isProviderPackContentEditable,
} from "@/lib/pack-review-rejection-ack";
import {
  acknowledgeProviderPackRejectionApi,
  fetchProviderDoclingImportApi,
  fetchProviderKnowledgePipelineApi,
  fetchProviderPack,
  fetchProviderPackDistributionApi,
  fetchProviderSearchDataStatusApi,
  fetchProviderServiceValidationApi,
  submitProviderPackApi,
  updateProviderPackApi,
  withdrawProviderPackReviewApi,
  type DoclingKnowledgePipelineStatusDto,
  type ProviderWorkerZipRequestState,
  type ServiceValidationStatusDto,
} from "@/lib/provider-center-api";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabFromLocation,
  type ProviderPackTabId,
} from "@/lib/provider-pack-tabs";
import {
  resolveProviderRegistrationReadiness,
  tabLocksFromRegistrationReadiness,
} from "@/lib/provider-registration-readiness";
import { providerPackDetailPath } from "@/lib/routes";
import {
  PROVIDER_PACK_ID_LABEL,
  PROVIDER_PACK_LOCKED_ADMIN_GENERATION,
  PROVIDER_PACK_LOCKED_GENERATION_REVIEW,
  PROVIDER_PACK_LOCKED_WAITING_ADMIN_SERVICE,
  PROVIDER_PACK_LOCKED_REJECTION,
  PROVIDER_PACK_LOCKED_REVIEWING,
  PROVIDER_PACK_SAVE_DRAFT_SUCCESS,
  PROVIDER_REVIEW_REJECTED_ACK_CTA,
  PROVIDER_REVIEW_REJECTED_ACK_HINT,
  PROVIDER_REVIEW_REJECTED_TITLE,
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
  const [workerZipStatus, setWorkerZipStatus] = useState<
    ProviderWorkerZipRequestState["requestStatus"] | null
  >(null);
  const [distribution, setDistribution] = useState<PackDistributionMetadataDto | null>(null);
  const [knowledgeStatus, setKnowledgeStatus] =
    useState<DoclingKnowledgePipelineStatusDto | null>(null);
  const [serviceValidation, setServiceValidation] =
    useState<ServiceValidationStatusDto | null>(null);
  const [searchDataUiState, setSearchDataUiState] = useState<SearchDataUiState | null>(null);
  const [rankingPolicyStale, setRankingPolicyStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [acknowledgingRejection, setAcknowledgingRejection] = useState(false);
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

  const awaitingRejectionAck = Boolean(
    pack?.latestRejectionReason?.trim() && !pack.latestRejectionAcknowledged,
  );
  const adminGenerationHold = pack?.adminGenerationHold ?? null;
  const providerReviewPhase = pack?.providerReviewPhase ?? "NONE";
  const lockedByAdminGeneration = isAdminGenerationHoldActive(adminGenerationHold);
  const editable = isProviderPackContentEditable({
    status: pack?.status ?? "DRAFT",
    latestRejectionReason: pack?.latestRejectionReason,
    latestRejectionAcknowledged: pack?.latestRejectionAcknowledged,
    latestReviewStatus: pack?.latestReviewStatus,
    adminGenerationHold,
    providerReviewPhase,
  });
  const isReviewing =
    pack?.status === "REVIEWING" ||
    Boolean(pack?.latestReviewStatus && isOpenPackReviewStatus(pack.latestReviewStatus));

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

      const [distRes, doclingRes, knowledgeRes, serviceRes, searchDataRes] = await Promise.all([
        fetchProviderPackDistributionApi(packId).catch(() => ({ distribution: null })),
        fetchProviderDoclingImportApi(packId).catch(() => ({ bundle: null })),
        fetchProviderKnowledgePipelineApi(packId).catch(() => null),
        fetchProviderServiceValidationApi(packId).catch(() => null),
        fetchProviderSearchDataStatusApi(packId).catch(() => null),
      ]);
      setDistribution(distRes.distribution);
      setDoclingBundle(doclingRes.bundle);
      if (knowledgeRes) setKnowledgeStatus(knowledgeRes);
      if (serviceRes) setServiceValidation(serviceRes);
      if (searchDataRes) {
        setSearchDataUiState(searchDataRes.state);
        setRankingPolicyStale(Boolean(searchDataRes.rankingPolicyStale));
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
        knowledgePassed: Boolean(
          knowledgeStatus?.searchFoundationPassed ?? knowledgeStatus?.passed,
        ),
        serviceValidationPassed: Boolean(
          serviceValidation?.allPreparationChannelsPassed ??
            serviceValidation?.allSelectedPassed,
        ),
      }),
    [
      hasBasicInfo,
      hasLanguage,
      distribution,
      doclingBundle,
      knowledgeStatus?.searchFoundationPassed,
      knowledgeStatus?.passed,
      serviceValidation?.allPreparationChannelsPassed,
      serviceValidation?.allSelectedPassed,
    ],
  );

  const structurePassed = Boolean(knowledgeStatus?.structurePassed);
  const searchFoundationPassed = Boolean(knowledgeStatus?.searchFoundationPassed);
  const pipelineCurrent = Boolean(knowledgeStatus?.pipelineCurrent);
  const sourceMaterialsReady =
    isDoclingSourceMaterialsReady(doclingBundlePublicToMaterialContext(doclingBundle)) ||
    workerZipStatus === "COMPLETED";
  const distributionReady = Boolean(
    distribution &&
      isDistributionReadyForServiceValidation({
        sourceTitle: distribution.sourceTitle,
        sourceUrl: distribution.sourceUrl,
        rightsBasis: distribution.rightsBasis,
        rightsConfirmedAt: distribution.rightsConfirmedAt,
        allowApi: distribution.allowApi,
        allowMcp: distribution.allowMcp,
        allowDownload: distribution.allowDownload,
      }),
  );
  const serviceValidationPassed = Boolean(
    serviceValidation?.allPreparationChannelsPassed ??
      serviceValidation?.allSelectedPassed,
  );
  const providerConfirmed = sourceMaterialsReady;
  const distributionReadyForProgress = isDistributionReadyForProgress({
    sourceTitle: distribution?.sourceTitle,
    sourceUrl: distribution?.sourceUrl,
    licenseName: distribution?.licenseName,
    rightsBasis: distribution?.rightsBasis,
    rightsConfirmedAt: distribution?.rightsConfirmedAt,
    allowApi: distribution?.allowApi,
    allowMcp: distribution?.allowMcp,
    allowDownload: distribution?.allowDownload,
  });

  const registrationReadiness = useMemo(() => {
    if (!pack) return null;
    return resolveProviderRegistrationReadiness({
      packId: pack.packId,
      packStatus: pack.status,
      basicInfoReady: hasBasicInfo && hasLanguage,
      sourceMaterialsReady,
      structurePassed,
      searchFoundationPassed,
      allPreparationChannelsPassed: serviceValidationPassed,
      distributionMetadataReady: distributionReadyForProgress,
      pipelineCurrent,
      structureStale: sourceMaterialsReady && !pipelineCurrent,
      searchValidationStale: structurePassed && !pipelineCurrent,
      latestRejectionReason: pack.latestRejectionReason,
    });
  }, [
    pack,
    hasBasicInfo,
    hasLanguage,
    sourceMaterialsReady,
    structurePassed,
    searchFoundationPassed,
    serviceValidationPassed,
    distributionReadyForProgress,
    pipelineCurrent,
  ]);

  const packProgress = useMemo(() => {
    if (!pack) return null;
    const working = pack.versions[0] ?? null;

    return buildProviderPackProgress({
      packId: pack.packId,
      packStatus: pack.status,
      name: name || pack.name,
      categoryId: pack.categoryId,
      shortDescription: shortDescription || pack.shortDescription,
      description: description || pack.description,
      language: language ?? pack.versions[0]?.language ?? null,
      latestRejectionReason: pack.latestRejectionReason,
      adminGenerationHold,
      workerZipRequestStatus: workerZipStatus,
      providerReviewPhase,
      workingVersion: working
        ? {
            id: working.id,
            version: working.version,
            sourceDocumentCount,
            materialReady: sourceMaterialsReady,
            structureReady: structurePassed,
            searchFoundationReady: searchFoundationPassed,
            searchValidationReady: serviceValidationPassed,
            distributionReady: distributionReadyForProgress,
            pipelineCurrent,
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
    sourceMaterialsReady,
    structurePassed,
    searchFoundationPassed,
    serviceValidationPassed,
    distributionReadyForProgress,
    pipelineCurrent,
    adminGenerationHold,
    workerZipStatus,
    providerReviewPhase,
  ]);

  const defaultTab = useMemo(
    () =>
      resolveDefaultProviderPackTab({
        created: showCreatedBanner,
        status: pack?.status ?? "DRAFT",
        sourceDocumentCount,
        hasPayload:
          isDoclingPayloadPresent(doclingBundle?.status) || workerZipStatus === "COMPLETED",
        hasDistribution: distributionReady,
        providerConfirmed,
        structurePassed,
        knowledgePassed: structurePassed,
        serviceValidationPassed,
      }),
    [
      showCreatedBanner,
      pack?.status,
      sourceDocumentCount,
      distributionReady,
      doclingBundle,
      workerZipStatus,
      providerConfirmed,
      structurePassed,
      serviceValidationPassed,
    ],
  );

  const activeTab = resolveProviderPackTabFromLocation({
    tabParam: searchParams.get("tab"),
    hash: locationHash,
    fallback: defaultTab,
  });

  // §13 Single readiness source. Before load, keep everything except basic locked.
  const tabLocks = useMemo(() => {
    if (registrationReadiness) {
      const locks = tabLocksFromRegistrationReadiness(registrationReadiness);
      const channel = (name: "API" | "MCP" | "DOWNLOAD") => {
        const c = serviceValidation?.channels.find((x) => x.channel === name);
        return c
          ? {
              systemStatus: c.systemStatus,
              currentValidity: c.currentValidity,
              providerConfirmationStatus: c.providerConfirmationStatus,
            }
          : null;
      };
      const displayState = resolveSearchValidationStepDisplayState({
        searchDataState: searchDataUiState,
        rankingPolicyStale,
        api: channel("API"),
        mcp: channel("MCP"),
        download: channel("DOWNLOAD"),
      });
      if (locks.distributionReview.locked) {
        const reason = resolveDistributionStepLockMessage({
          displayState,
          structurePassed,
          // Prefer display-state copy for revalidation; only force foundation message when truly missing.
          searchFoundationPassed: searchFoundationPassed ? undefined : false,
          allPreparationChannelsPassed: serviceValidationPassed ? undefined : false,
        });
        return {
          ...locks,
          distributionReview: {
            locked: true,
            reason:
              reason ??
              locks.distributionReview.reason ??
              "자동 평가, API·MCP 검색검증, 제공자 품질 확인을 완료하면 열립니다.",
          },
        };
      }
      return locks;
    }
    const lockedReason = "지식팩을 불러오는 중입니다.";
    return {
      basic: { locked: false, reason: null },
      payload: { locked: true, reason: lockedReason },
      knowledge: { locked: true, reason: lockedReason },
      serviceValidation: { locked: true, reason: lockedReason },
      distributionReview: { locked: true, reason: lockedReason },
    } satisfies Record<ProviderPackTabId, { locked: boolean; reason: string | null }>;
  }, [
    registrationReadiness,
    searchDataUiState,
    rankingPolicyStale,
    serviceValidation,
    structurePassed,
    searchFoundationPassed,
    serviceValidationPassed,
  ]);

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
      selectTab("distributionReview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "검수 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const onAcknowledgeRejection = async () => {
    if (acknowledgingRejection) return;
    setAcknowledgingRejection(true);
    setError(null);
    try {
      const data = await acknowledgeProviderPackRejectionApi(packId);
      setPack(data.pack);
      selectTab("distributionReview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "반려 확인에 실패했습니다.");
    } finally {
      setAcknowledgingRejection(false);
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
      selectTab("distributionReview");
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

        {awaitingRejectionAck ? (
          <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-bold">{PROVIDER_REVIEW_REJECTED_TITLE}</p>
            <p className="text-xs">사유: {pack.latestRejectionReason}</p>
            <p className="text-xs">{PROVIDER_REVIEW_REJECTED_ACK_HINT}</p>
            <button
              type="button"
              disabled={acknowledgingRejection}
              onClick={() => void onAcknowledgeRejection()}
              className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
            >
              {acknowledgingRejection ? "확인 중…" : PROVIDER_REVIEW_REJECTED_ACK_CTA}
            </button>
          </div>
        ) : null}

        {isReviewing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {PROVIDER_PACK_LOCKED_REVIEWING}
          </div>
        ) : null}

        {!awaitingRejectionAck && !isReviewing && providerReviewPhase === "REQUESTED" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {PROVIDER_PACK_LOCKED_GENERATION_REVIEW}
          </div>
        ) : null}

        {!awaitingRejectionAck &&
        !isReviewing &&
        providerReviewPhase === "CONFIRMED" ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            {PROVIDER_PACK_LOCKED_WAITING_ADMIN_SERVICE}
          </div>
        ) : null}

        {!awaitingRejectionAck &&
        !isReviewing &&
        providerReviewPhase !== "REQUESTED" &&
        providerReviewPhase !== "CONFIRMED" &&
        lockedByAdminGeneration ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {PROVIDER_PACK_LOCKED_ADMIN_GENERATION}
          </div>
        ) : null}

        {!editable &&
        !isReviewing &&
        !awaitingRejectionAck &&
        !lockedByAdminGeneration &&
        providerReviewPhase !== "REQUESTED" &&
        providerReviewPhase !== "CONFIRMED" ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            {PROVIDER_PACK_LOCKED_REJECTION}
          </div>
        ) : null}

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

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div id="pack-wizard-main" className="scroll-mt-24">
          {/* Keep steps mounted (hidden) so Docling file selection / upload result survives switches. */}
          <div
            id="provider-pack-panel-basic"
            role="region"
            aria-label="기본정보"
            className={activeTab === "basic" ? undefined : "hidden"}
            aria-hidden={activeTab !== "basic"}
          >
          <ProviderPackBasicInfoTab
            editable={editable}
            lockHint={
              isReviewing
                ? PROVIDER_PACK_LOCKED_REVIEWING
                : providerReviewPhase === "REQUESTED"
                  ? PROVIDER_PACK_LOCKED_GENERATION_REVIEW
                  : providerReviewPhase === "CONFIRMED"
                    ? PROVIDER_PACK_LOCKED_WAITING_ADMIN_SERVICE
                    : lockedByAdminGeneration
                      ? PROVIDER_PACK_LOCKED_ADMIN_GENERATION
                      : awaitingRejectionAck
                        ? PROVIDER_PACK_LOCKED_REJECTION
                        : null
            }
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
          id="provider-pack-panel-payload"
          role="region"
          aria-label="자료등록"
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
            onWorkerZipStatusChange={setWorkerZipStatus}
            onPackUpdated={(next) => {
              setPack(next);
              setVersionOverview(next.versions[0]?.overview ?? "");
              setDoclingBundle(null);
              setDistribution(null);
            }}
          />
        </div>

        <div
          id="provider-pack-panel-knowledge"
          role="region"
          aria-label="데이터 구조화"
          className={activeTab === "knowledge" ? undefined : "hidden"}
          aria-hidden={activeTab !== "knowledge"}
        >
          <ProviderGenerationReviewPanel
            packId={packId}
            phase={
              providerReviewPhase === "REQUESTED" ||
              providerReviewPhase === "CONFIRMED" ||
              providerReviewPhase === "WITHDRAWN"
                ? providerReviewPhase
                : "NONE"
            }
            qualitySummary={{
              structure: pack.structureQuality?.knowledgeQuality?.status ?? null,
              chunk: pack.chunkQuality?.report?.status ?? null,
              retrieval: pack.retrievalEvaluation?.latestRun?.status ?? null,
            }}
            onChanged={load}
          />
          <ProviderKnowledgeGenerationTab
            packId={packId}
            editable={editable}
            onGoToSearchValidation={() => selectTab("serviceValidation")}
            onStatusChange={setKnowledgeStatus}
          />
        </div>

        <div
          id="provider-pack-panel-serviceValidation"
          role="region"
          aria-label="검색데이터 생성·검증"
          className={activeTab === "serviceValidation" ? undefined : "hidden"}
          aria-hidden={activeTab !== "serviceValidation"}
        >
          {tabLocks.serviceValidation.locked ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {tabLocks.serviceValidation.reason}
            </p>
          ) : (
            <ProviderServiceValidationTab
              packId={packId}
              editable={editable}
              knowledgeStatus={knowledgeStatus}
              onGoToDistributionReview={() => selectTab("distributionReview")}
              onGoToKnowledge={() => selectTab("knowledge")}
              onStatusChange={setServiceValidation}
              onSearchDataStateChange={(state) => setSearchDataUiState(state)}
              onSearchDataMetaChange={(meta) => {
                setRankingPolicyStale(Boolean(meta.rankingPolicyStale));
              }}
            />
          )}
        </div>

        <div
          id="provider-pack-panel-distributionReview"
          role="region"
          aria-label="유통정보·검수"
          className={activeTab === "distributionReview" ? undefined : "hidden"}
          aria-hidden={activeTab !== "distributionReview"}
        >
          {tabLocks.distributionReview.locked ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {tabLocks.distributionReview.reason}
            </p>
          ) : (
            <div className="space-y-4">
              <ProviderDistributionTab
                packId={packId}
                editable={editable}
                onDistributionChanged={setDistribution}
                onGoToServiceValidation={() => {
                  const el = document.getElementById("pack-review");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
              <ProviderPackReviewTab
                pack={pack}
                editable={editable}
                submitting={submitting}
                withdrawing={withdrawing}
                sourceDocumentCount={sourceDocumentCount}
                distributionMode={distributionMode}
                distributionReadiness={distributionReadiness}
                serviceValidationPassed={serviceValidationPassed}
                onSubmitReview={() => void onSubmitReview()}
                onWithdrawReview={() => void onWithdrawReview()}
                onAcknowledgeRejection={() => void onAcknowledgeRejection()}
                acknowledgingRejection={acknowledgingRejection}
                onGoToPayloadTab={() => selectTab("payload")}
                onGoToDistributionTab={() => {
                  const el = document.getElementById("pack-distribution");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onGoToKnowledgeTab={() => selectTab("knowledge")}
                onGoToServiceValidationTab={() => selectTab("serviceValidation")}
                onGoToBasicTab={() => selectTab("basic")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
