"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  confirmProviderStoreReviewApi,
  fetchProviderChunkReviewBatchApi,
  fetchProviderChunkReviewDetailApi,
  withdrawProviderStoreReviewApi,
} from "@/lib/provider-center-api";
import {
  buildProviderChunkReviewItems,
  countProviderChunkReviewByStatus,
  filterProviderChunkReviewItems,
  PROVIDER_CHUNK_PDF_EXPORT_MAX,
  PROVIDER_CHUNK_REVIEW_CHECKLIST,
  seedChangesRequestFromChunkReviewItem,
  type ProviderChunkReviewFilter,
  type ProviderChunkReviewItem,
} from "@/lib/provider-chunk-review";
import { downloadProviderChunkReviewPdf } from "@/lib/provider-chunk-review-pdf";
import type { ProviderChunkReviewDetailDto } from "@/lib/provider-pack/provider-chunk-review-detail-service";
import {
  buildChunkIssueEvidence,
  buildProviderReviewAreaGuidance,
  buildRetrievalIssueEvidence,
  buildStructureIssueEvidence,
  countProviderReviewIssueSeverity,
  issuesForSourceDocument,
  providerReviewHasBlockingFail,
  providerReviewHasWarning,
  sourceDocumentIdsWithIssues,
  type ProviderReviewIssueEvidence,
} from "@/lib/provider-review-evidence";
import {
  buildProviderGenerationReviewMarkdown,
  downloadTextFile,
} from "@/lib/provider-review-markdown";
import {
  formatProviderReviewQualityLabel,
  overallProviderReviewQualityLabel,
  PROVIDER_CHANGES_REQUEST_TARGETS,
  PROVIDER_CHANGES_REQUEST_TYPES,
  type ProviderChangesRequestPayload,
  type ProviderChangesRequestTarget,
  type ProviderChangesRequestType,
} from "@/lib/provider-review-workbench";

function IconButton({
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  readonly label: string;
  readonly title: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function ChevronIcon({
  expanded,
  className = "h-4 w-4",
}: {
  readonly expanded: boolean;
  readonly className?: string;
}) {
  return (
    <svg
      className={`${className} transition ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IssueAlertIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function DetailReviewIcon({ className = "h-4 w-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SortMark({
  active,
  dir,
}: {
  readonly active: boolean;
  readonly dir: "asc" | "desc";
}) {
  if (!active) {
    return <span className="ml-1 text-[9px] text-slate-300">↕</span>;
  }
  return (
    <span className="ml-1 text-[9px] font-bold text-store-accent">
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

/**
 * Provider generation-result review workbench (detail only).
 * List cards must not expose 확인 완료 — only "검토하기" entry.
 */
export function ProviderGenerationReviewPanel({
  packId,
  pack,
  phase,
  onChanged,
}: {
  readonly packId: string;
  readonly pack: ProviderPackDetailDto | null;
  readonly phase: "REQUESTED" | "CONFIRMED" | "WITHDRAWN" | "NONE";
  readonly onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<"confirm" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [changeType, setChangeType] = useState<ProviderChangesRequestType>("OTHER");
  const [targetKind, setTargetKind] = useState<ProviderChangesRequestTarget>("OTHER");
  const [targetLabel, setTargetLabel] = useState("");
  const [details, setDetails] = useState("");
  const [selectedSourceDocId, setSelectedSourceDocId] = useState<string | null>(null);
  const [issueModalDocId, setIssueModalDocId] = useState<string | null>(null);
  const [modalSelectedIssueId, setModalSelectedIssueId] = useState<string | null>(null);
  const [issuesReviewed, setIssuesReviewed] = useState(false);
  const [chunkAttentionReviewed, setChunkAttentionReviewed] = useState(false);
  const [markedOkChunkIds, setMarkedOkChunkIds] = useState<Set<string>>(() => new Set());
  const [sourceDocsExpanded, setSourceDocsExpanded] = useState(true);
  const [chunkReviewExpanded, setChunkReviewExpanded] = useState(true);
  const [chunkFilter, setChunkFilter] = useState<ProviderChunkReviewFilter>("all");
  const [chunkSortKey, setChunkSortKey] = useState<
    "index" | "title" | "location" | "preview" | "status"
  >("index");
  const [chunkSortDir, setChunkSortDir] = useState<"asc" | "desc">("asc");
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(() => new Set());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [chunkDetailItem, setChunkDetailItem] = useState<ProviderChunkReviewItem | null>(null);
  const [chunkDetail, setChunkDetail] = useState<ProviderChunkReviewDetailDto | null>(null);
  const [chunkDetailBusy, setChunkDetailBusy] = useState(false);
  const [chunkDetailError, setChunkDetailError] = useState<string | null>(null);
  const [sourceSortKey, setSourceSortKey] = useState<
    "index" | "title" | "issue" | "format"
  >("index");
  const [sourceSortDir, setSourceSortDir] = useState<"asc" | "desc">("asc");

  const quality = useMemo(() => {
    const structure = pack?.structureQuality?.knowledgeQuality?.status ?? null;
    const chunk = pack?.chunkQuality?.report?.status ?? null;
    const retrieval = pack?.retrievalEvaluation?.latestRun?.status ?? null;
    return {
      structure,
      chunk,
      retrieval,
      overall: overallProviderReviewQualityLabel({ structure, chunk, retrieval }),
    };
  }, [pack]);

  const sourceDocs = useMemo(
    () => pack?.versions[0]?.sourceDocuments ?? [],
    [pack],
  );
  const chunkSamples = pack?.chunkQuality?.report?.metrics?.slice(0, 8) ?? [];
  const chunkReviewItems = useMemo(
    () =>
      buildProviderChunkReviewItems({
        metrics: pack?.chunkQuality?.report?.metrics ?? [],
        issues: pack?.chunkQuality?.report?.issues ?? [],
        sourceDocuments: sourceDocs,
      }),
    [pack, sourceDocs],
  );
  const chunkStatusCounts = useMemo(
    () => countProviderChunkReviewByStatus(chunkReviewItems),
    [chunkReviewItems],
  );
  const filteredChunkItems = useMemo(
    () => filterProviderChunkReviewItems(chunkReviewItems, chunkFilter),
    [chunkReviewItems, chunkFilter],
  );
  const sortedChunkItems = useMemo(() => {
    const statusRank = (status: ProviderChunkReviewItem["status"]) =>
      status === "needs_action" ? 0 : status === "warning" ? 1 : 2;
    const rows = filteredChunkItems.map((item, index) => ({
      item,
      index,
      title: item.title,
      location: [item.sourceFileName, ...item.sourceSectionPath].filter(Boolean).join(" › "),
      preview: item.contentPreview,
      status: item.status,
      statusLabel: item.statusLabel,
    }));
    const dir = chunkSortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (chunkSortKey === "index") cmp = a.index - b.index;
      else if (chunkSortKey === "title") cmp = a.title.localeCompare(b.title, "ko");
      else if (chunkSortKey === "location") cmp = a.location.localeCompare(b.location, "ko");
      else if (chunkSortKey === "preview") cmp = a.preview.localeCompare(b.preview, "ko");
      else cmp = statusRank(a.status) - statusRank(b.status);
      return cmp * dir;
    });
    return rows;
  }, [filteredChunkItems, chunkSortKey, chunkSortDir]);
  const attentionChunkCount =
    chunkStatusCounts.warning + chunkStatusCounts.needs_action;
  const chunkFilterCounts = {
    all: chunkReviewItems.length,
    warning: attentionChunkCount,
    needs_action: chunkStatusCounts.needs_action,
  } as const;
  const visibleChunkIds = useMemo(
    () => sortedChunkItems.map(({ item }) => item.chunkId),
    [sortedChunkItems],
  );
  const selectedVisibleCount = useMemo(
    () => visibleChunkIds.filter((id) => selectedChunkIds.has(id)).length,
    [visibleChunkIds, selectedChunkIds],
  );
  const allVisibleSelected =
    visibleChunkIds.length > 0 && selectedVisibleCount === visibleChunkIds.length;
  const selectedCount = selectedChunkIds.size;
  const retrievalFails = useMemo(
    () => pack?.retrievalEvaluation?.latestRun?.failedResults ?? [],
    [pack],
  );

  const structureEvidence = useMemo(
    () =>
      buildStructureIssueEvidence({
        issues: pack?.structureQuality?.knowledgeQuality?.issues ?? [],
        sourceDocuments: sourceDocs,
        limit: 20,
      }),
    [pack, sourceDocs],
  );
  const chunkEvidence = useMemo(
    () =>
      buildChunkIssueEvidence({
        issues: pack?.chunkQuality?.report?.issues ?? [],
        metrics: pack?.chunkQuality?.report?.metrics ?? [],
        sourceDocuments: sourceDocs,
        limit: 20,
      }),
    [pack, sourceDocs],
  );
  const retrievalEvidence = useMemo(
    () => buildRetrievalIssueEvidence({ failedResults: retrievalFails, limit: 10 }),
    [retrievalFails],
  );

  const allIssues = useMemo(
    () => [...structureEvidence, ...chunkEvidence, ...retrievalEvidence],
    [structureEvidence, chunkEvidence, retrievalEvidence],
  );
  const severityCounts = useMemo(
    () => countProviderReviewIssueSeverity(allIssues),
    [allIssues],
  );
  const guidance = useMemo(
    () =>
      buildProviderReviewAreaGuidance({
        structureStatus: quality.structure,
        chunkStatus: quality.chunk,
        retrievalStatus: quality.retrieval,
        structureIssueCount: structureEvidence.length,
        chunkIssueCount: chunkEvidence.length,
        retrievalFailCount: retrievalEvidence.length,
      }),
    [quality, structureEvidence.length, chunkEvidence.length, retrievalEvidence.length],
  );

  const blockingFail = providerReviewHasBlockingFail({
    structureStatus: quality.structure,
    chunkStatus: quality.chunk,
  });
  const hasWarning = providerReviewHasWarning({
    structureStatus: quality.structure,
    chunkStatus: quality.chunk,
    retrievalStatus: quality.retrieval,
  });
  const docsWithIssues = useMemo(() => sourceDocumentIdsWithIssues(allIssues), [allIssues]);
  const sortedSourceDocs = useMemo(() => {
    const rows = sourceDocs.map((doc, index) => ({
      doc,
      index,
      issueCount: docsWithIssues.has(doc.id)
        ? issuesForSourceDocument(allIssues, doc.id).length
        : 0,
      format: (doc.sourceFormat || doc.sourceType || "").toString(),
      title: doc.title ?? "",
    }));
    const dir = sourceSortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sourceSortKey === "index") cmp = a.index - b.index;
      else if (sourceSortKey === "title") {
        cmp = a.title.localeCompare(b.title, "ko");
      } else if (sourceSortKey === "issue") {
        cmp = a.issueCount - b.issueCount;
      } else {
        cmp = a.format.localeCompare(b.format, "ko");
      }
      return cmp * dir;
    });
    return rows;
  }, [sourceDocs, docsWithIssues, allIssues, sourceSortKey, sourceSortDir]);

  const toggleSourceSort = (key: typeof sourceSortKey) => {
    if (sourceSortKey === key) {
      setSourceSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSourceSortKey(key);
    setSourceSortDir("asc");
  };

  const toggleChunkSort = (key: typeof chunkSortKey) => {
    if (chunkSortKey === key) {
      setChunkSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setChunkSortKey(key);
    setChunkSortDir("asc");
  };

  const toggleChunkSelected = (chunkId: string) => {
    setSelectedChunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedChunkIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleChunkIds) next.delete(id);
      } else {
        for (const id of visibleChunkIds) next.add(id);
      }
      return next;
    });
  };

  const downloadSelectedChunksPdf = async () => {
    if (selectedCount === 0) {
      setError("PDF로 저장할 지식 단위를 선택해 주세요.");
      return;
    }
    if (selectedCount > PROVIDER_CHUNK_PDF_EXPORT_MAX) {
      setError(`한 번에 최대 ${PROVIDER_CHUNK_PDF_EXPORT_MAX}건까지 PDF로 저장할 수 있습니다.`);
      return;
    }
    setPdfBusy(true);
    setError(null);
    setMessage(null);
    try {
      const orderedIds = [
        ...sortedChunkItems
          .map(({ item }) => item.chunkId)
          .filter((id) => selectedChunkIds.has(id)),
        ...[...selectedChunkIds].filter(
          (id) => !sortedChunkItems.some(({ item }) => item.chunkId === id),
        ),
      ];
      const itemById = new Map(chunkReviewItems.map((item) => [item.chunkId, item]));
      const batch = await fetchProviderChunkReviewBatchApi(packId, orderedIds);
      const detailById = new Map(batch.chunks.map((c) => [c.chunkId, c]));
      const rows = orderedIds
        .map((id) => {
          const item = itemById.get(id);
          if (!item) return null;
          return { item, detail: detailById.get(id) ?? null };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
      if (rows.length === 0) {
        throw new Error("선택한 지식 단위 본문을 불러오지 못했습니다.");
      }
      const packName = pack?.name ?? packId;
      const safeName = packName.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 50);
      await downloadProviderChunkReviewPdf({
        packName,
        fileName: `${safeName}-지식단위-${rows.length}건.pdf`,
        rows,
      });
      setMessage(`선택한 지식 단위 ${rows.length}건을 PDF로 저장했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 저장에 실패했습니다.");
    } finally {
      setPdfBusy(false);
    }
  };

  const modalIssues = useMemo(
    () => (issueModalDocId ? issuesForSourceDocument(allIssues, issueModalDocId) : []),
    [allIssues, issueModalDocId],
  );
  const selectedIssue =
    modalIssues.find((issue) => issue.id === modalSelectedIssueId) ?? modalIssues[0] ?? null;
  const modalDocTitle =
    sourceDocs.find((d) => d.id === issueModalDocId)?.title ?? "원본 파일";

  const checkedAt =
    pack?.chunkQuality?.report?.checkedAt ??
    pack?.structureQuality?.knowledgeQuality?.checkedAt ??
    pack?.updatedAt ??
    null;

  if (phase !== "REQUESTED" && phase !== "CONFIRMED") {
    return null;
  }

  const openChangesForm = (
    seed?: ProviderReviewIssueEvidence | null,
    chunkSeed?: ProviderChunkReviewItem | null,
  ) => {
    if (chunkSeed) {
      const seeded = seedChangesRequestFromChunkReviewItem(chunkSeed);
      setChangeType(seeded.changeType);
      setTargetKind(seeded.targetKind);
      setTargetLabel(seeded.targetLabel);
      setDetails(seeded.details);
    } else if (seed) {
      setChangeType(seed.suggestedChangeType);
      setTargetKind(seed.suggestedTargetKind);
      setTargetLabel(seed.suggestedTargetLabel);
      setDetails(
        [
          `[${seed.issueTypeLabel}] ${seed.message}`,
          seed.locationLabel ? `위치: ${seed.locationLabel}` : null,
          seed.targetId ? `대상 ID: ${seed.targetId}` : null,
          seed.providerAction,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    setFormOpen(true);
    setError(null);
  };

  const markIssuesReviewed = () => {
    setIssuesReviewed(true);
  };

  const markChunkAttentionReviewed = () => {
    setChunkAttentionReviewed(true);
  };

  const runConfirm = async (opts?: { attentionReviewed?: boolean }) => {
    if (blockingFail) {
      setError("실패 상태인 품질 항목이 있어 확인 완료할 수 없습니다. 보완 요청을 작성해 주세요.");
      return;
    }
    if (allIssues.length > 0 && !issuesReviewed) {
      setError("이슈가 있는 원본 파일의 경고 아이콘을 눌러 이슈 상세를 확인한 뒤 확인 완료해 주세요.");
      return;
    }
    const attentionOk = Boolean(opts?.attentionReviewed) || chunkAttentionReviewed;
    if (attentionChunkCount > 0 && !attentionOk) {
      setError(
        "주의·보완이 필요한 검색 지식 단위를 상세 검토한 뒤 확인 완료해 주세요.",
      );
      return;
    }
    if (formOpen && details.trim()) {
      setError("작성 중인 보완 요청이 있습니다. 제출하거나 취소한 뒤 확인 완료해 주세요.");
      return;
    }
    const confirmMessage = hasWarning
      ? "주의 필요 항목이 남아 있습니다. 원문과 생성 데이터를 확인한 뒤 승인하거나 보완요청을 제출해 주세요.\n그래도 현재 생성 결과를 확인 완료하시겠습니까?"
      : "생성 결과를 검토했고 확인 완료할까요?\n확인 후에는 관리자 서비스 검증 단계로 넘어갑니다.";
    const ok = window.confirm(confirmMessage);
    if (!ok) return;
    setBusy("confirm");
    setError(null);
    setMessage(null);
    try {
      await confirmProviderStoreReviewApi(packId);
      setMessage("확인 완료했습니다. 관리자 서비스 검증을 기다립니다.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const runChangesRequest = async () => {
    const trimmed = details.trim();
    if (!trimmed) {
      setError("보완 요청 내용을 입력해 주세요.");
      return;
    }
    const payload: ProviderChangesRequestPayload = {
      changeType,
      targetKind,
      targetLabel: targetLabel.trim() || undefined,
      details: trimmed,
    };
    setBusy("withdraw");
    setError(null);
    setMessage(null);
    try {
      await withdrawProviderStoreReviewApi(packId, payload);
      setMessage("보완 요청을 제출했습니다. 자료를 다시 등록할 수 있습니다.");
      setFormOpen(false);
      setDetails("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const openIssueModal = (docId: string) => {
    setIssueModalDocId(docId);
    setModalSelectedIssueId(null);
    markIssuesReviewed();
  };

  const closeIssueModal = () => {
    setIssueModalDocId(null);
    setModalSelectedIssueId(null);
  };

  const openChunkDetail = (item: ProviderChunkReviewItem) => {
    setChunkDetailItem(item);
    setChunkDetail(null);
    setChunkDetailError(null);
    if (item.status !== "ok") {
      markChunkAttentionReviewed();
    }
  };

  const closeChunkDetail = () => {
    setChunkDetailItem(null);
    setChunkDetail(null);
    setChunkDetailError(null);
    setChunkDetailBusy(false);
  };

  useEffect(() => {
    if (!chunkDetailItem) return;
    let cancelled = false;
    setChunkDetailBusy(true);
    setChunkDetailError(null);
    void fetchProviderChunkReviewDetailApi(packId, chunkDetailItem.chunkId)
      .then((res) => {
        if (cancelled) return;
        setChunkDetail(res.chunk);
      })
      .catch((err) => {
        if (cancelled) return;
        setChunkDetailError(
          err instanceof Error ? err.message : "지식 단위 본문을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!cancelled) setChunkDetailBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chunkDetailItem, packId]);

  const markChunkOk = (chunkId: string) => {
    setMarkedOkChunkIds((prev) => {
      const next = new Set(prev);
      next.add(chunkId);
      return next;
    });
    markChunkAttentionReviewed();
    setMessage("해당 지식 단위를 문제 없음으로 표시했습니다.");
  };

  const areaLabel = (area: ProviderReviewIssueEvidence["area"]) => {
    if (area === "structure") return "구조화";
    if (area === "chunk") return "청킹";
    return "검색 평가";
  };

  const downloadMarkdown = () => {
    const md = buildProviderGenerationReviewMarkdown({
      packId,
      packName: pack?.name ?? packId,
      structureStatus: quality.structure,
      chunkStatus: quality.chunk,
      retrievalStatus: quality.retrieval,
      warningCount: severityCounts.warning,
      failCount: severityCounts.fail,
      checkedAt,
      sourceDocuments: sourceDocs,
      chunkSamples,
      guidance,
      issues: allIssues,
    });
    const safeName = (pack?.name ?? packId).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);
    downloadTextFile(`${safeName}-생성결과내역.md`, md);
  };

  return (
    <section
      id="provider-generation-review"
      className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm font-bold text-slate-900">생성결과 내역</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {phase === "REQUESTED" ? (
            <>
              <button
                type="button"
                title={
                  blockingFail
                    ? "실패 상태에서는 확인 완료할 수 없습니다."
                    : attentionChunkCount > 0 && !chunkAttentionReviewed
                      ? "주의·보완이 필요한 검색 지식 단위를 상세 검토한 뒤 확인할 수 있습니다."
                      : undefined
                }
                disabled={busy != null || blockingFail}
                onClick={() => void runConfirm()}
                className="inline-flex min-h-[36px] items-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy === "confirm" ? "처리 중…" : "확인 완료"}
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => openChangesForm(selectedIssue)}
                className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 disabled:opacity-50"
              >
                보완 요청 작성
              </button>
            </>
          ) : null}
          <IconButton
            label="다운로드"
            title="생성결과 내역 MD 다운로드"
            disabled={busy != null}
            onClick={downloadMarkdown}
          >
            <DownloadIcon />
          </IconButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-[11px] text-slate-700">
          <caption className="sr-only">품질 요약</caption>
          <tbody>
            <tr className="border-b border-slate-100">
              <th className="w-28 bg-slate-50 px-3 py-2 font-semibold text-store-muted">지식팩</th>
              <td className="px-3 py-2 font-semibold text-slate-900">{pack?.name ?? packId}</td>
              <th className="w-28 bg-slate-50 px-3 py-2 font-semibold text-store-muted">품질 요약</th>
              <td className="px-3 py-2 font-semibold">{quality.overall}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">구조화</th>
              <td className="px-3 py-2 font-semibold">
                {formatProviderReviewQualityLabel(quality.structure)}
              </td>
              <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">청킹</th>
              <td className="px-3 py-2 font-semibold">
                {formatProviderReviewQualityLabel(quality.chunk)}
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">검색 평가</th>
              <td className="px-3 py-2 font-semibold">
                {formatProviderReviewQualityLabel(quality.retrieval)}
              </td>
              <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">주요 이슈</th>
              <td className="px-3 py-2 font-semibold">
                주의 {severityCounts.warning}건 · 실패 {severityCounts.fail}건
              </td>
            </tr>
            <tr>
              <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">점검 시각</th>
              <td className="px-3 py-2 font-semibold" colSpan={3}>
                {checkedAt ? new Date(checkedAt).toLocaleString("ko-KR") : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setSourceDocsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900"
            aria-expanded={sourceDocsExpanded}
            title={sourceDocsExpanded ? "원본 파일 표 접기" : "원본 파일 표 펼치기"}
          >
            원본 파일
            <ChevronIcon expanded={sourceDocsExpanded} />
          </button>
          <span className="text-[10px] text-store-muted">{sourceDocs.length}건</span>
        </div>
        {sourceDocsExpanded ? (
          <table className="min-w-full text-left text-[11px] text-slate-700">
            <thead className="border-y border-slate-100 bg-slate-50 text-store-muted">
              <tr>
                <th className="w-12 px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleSourceSort("index")}
                  >
                    순번
                    <SortMark active={sourceSortKey === "index"} dir={sourceSortDir} />
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleSourceSort("title")}
                  >
                    파일명
                    <SortMark active={sourceSortKey === "title"} dir={sourceSortDir} />
                  </button>
                </th>
                <th className="w-16 px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleSourceSort("issue")}
                  >
                    이슈
                    <SortMark active={sourceSortKey === "issue"} dir={sourceSortDir} />
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleSourceSort("format")}
                  >
                    형식
                    <SortMark active={sourceSortKey === "format"} dir={sourceSortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSourceDocs.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-store-muted" colSpan={4}>
                    등록된 원본 파일이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedSourceDocs.map(({ doc, index, issueCount }) => {
                  const selected = selectedSourceDocId === doc.id;
                  const hasIssues = issueCount > 0;
                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-slate-100 ${
                        selected ? "bg-amber-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 tabular-nums text-store-muted">{index + 1}</td>
                      <td
                        className={`cursor-pointer px-3 py-2 ${
                          selected
                            ? "break-all whitespace-pre-wrap font-semibold text-slate-900"
                            : "max-w-[280px] truncate"
                        }`}
                        onClick={() =>
                          setSelectedSourceDocId((prev) => (prev === doc.id ? null : doc.id))
                        }
                        title={selected ? "클릭하면 접습니다" : "클릭하면 전체 파일명을 봅니다"}
                      >
                        {doc.title}
                      </td>
                      <td className="px-3 py-2">
                        {hasIssues ? (
                          <button
                            type="button"
                            title={`이슈 ${issueCount}건 보기`}
                            aria-label={`${doc.title} 이슈 ${issueCount}건 보기`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openIssueModal(doc.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-700 transition hover:bg-amber-100"
                          >
                            <IssueAlertIcon />
                          </button>
                        ) : (
                          <span className="text-store-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{doc.sourceFormat || doc.sourceType}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setChunkReviewExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900"
            aria-expanded={chunkReviewExpanded}
            title={
              chunkReviewExpanded
                ? "검색 지식 단위 검토 접기"
                : "검색 지식 단위 검토 펼치기"
            }
          >
            검색 지식 단위 검토
            <ChevronIcon expanded={chunkReviewExpanded} />
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCount > 0 ? (
              <button
                type="button"
                disabled={pdfBusy || busy != null}
                onClick={() => void downloadSelectedChunksPdf()}
                title={`선택한 지식 단위를 PDF로 저장 (최대 ${PROVIDER_CHUNK_PDF_EXPORT_MAX}건)`}
                className="inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {pdfBusy ? "PDF 저장 중…" : `PDF 저장 ${selectedCount}`}
              </button>
            ) : null}
            {(
              [
                { value: "all", label: "전체" },
                { value: "warning", label: "주의·보완" },
                { value: "needs_action", label: "보완 필요" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setChunkFilter(opt.value)}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2 text-[10px] font-semibold ${
                  chunkFilter === opt.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
                <span
                  className={
                    chunkFilter === opt.value ? "text-white/80" : "text-store-muted"
                  }
                >
                  {chunkFilterCounts[opt.value]}
                </span>
              </button>
            ))}
          </div>
        </div>
        {chunkReviewExpanded ? (
          <table className="min-w-full text-left text-[11px] text-slate-700">
            <thead className="border-y border-slate-100 bg-slate-50 text-store-muted">
              <tr>
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visibleChunkIds.length === 0}
                    onChange={toggleSelectAllVisible}
                    aria-label="현재 목록 전체 선택"
                    className="h-3.5 w-3.5 accent-slate-900"
                  />
                </th>
                <th className="w-12 px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleChunkSort("index")}
                  >
                    순번
                    <SortMark active={chunkSortKey === "index"} dir={chunkSortDir} />
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleChunkSort("title")}
                  >
                    제목
                    <SortMark active={chunkSortKey === "title"} dir={chunkSortDir} />
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleChunkSort("location")}
                  >
                    원본 위치
                    <SortMark active={chunkSortKey === "location"} dir={chunkSortDir} />
                  </button>
                </th>
                <th className="min-w-[140px] px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleChunkSort("preview")}
                  >
                    본문 미리보기
                    <SortMark active={chunkSortKey === "preview"} dir={chunkSortDir} />
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center font-semibold"
                    onClick={() => toggleChunkSort("status")}
                  >
                    상태
                    <SortMark active={chunkSortKey === "status"} dir={chunkSortDir} />
                  </button>
                </th>
                <th className="w-12 px-3 py-2 font-semibold">
                  <span className="sr-only">상세 검토</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedChunkItems.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-store-muted" colSpan={7}>
                    {chunkReviewItems.length === 0
                      ? "표시할 검색 지식 단위가 없습니다."
                      : "선택한 필터에 해당하는 항목이 없습니다."}
                  </td>
                </tr>
              ) : (
                sortedChunkItems.map(({ item, index }) => {
                  const markedOk = markedOkChunkIds.has(item.chunkId);
                  const selected = selectedChunkIds.has(item.chunkId);
                  const location = [item.sourceFileName, ...item.sourceSectionPath]
                    .filter(Boolean)
                    .join(" › ");
                  return (
                    <tr
                      key={item.chunkId}
                      className={`border-b border-slate-100 align-top ${
                        selected ? "bg-slate-50" : ""
                      }`}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleChunkSelected(item.chunkId)}
                          aria-label={`${item.title} 선택`}
                          className="h-3.5 w-3.5 accent-slate-900"
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-store-muted">
                        {index + 1}
                      </td>
                      <td className="max-w-[160px] px-3 py-2 font-semibold text-slate-900">
                        <div className="line-clamp-2">{item.title}</div>
                        {item.issueTypeLabels.length > 0 ? (
                          <div className="mt-0.5 text-[10px] font-normal text-amber-800">
                            {item.issueTypeLabels.slice(0, 2).join(" · ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-[180px] px-3 py-2">
                        <div className="line-clamp-2" title={location}>
                          {location || "원본 위치 정보 없음"}
                        </div>
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-slate-600">
                        <div className="line-clamp-3 whitespace-pre-wrap">
                          {item.contentPreview}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            item.status === "needs_action"
                              ? "bg-red-100 text-red-800"
                              : item.status === "warning"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {markedOk ? "문제 없음" : item.statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          title="상세 검토"
                          aria-label={`${item.title} 상세 검토`}
                          onClick={() => openChunkDetail(item)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100"
                        >
                          <DetailReviewIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : null}
      </div>

      {issueModalDocId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provider-issue-modal-title"
          onClick={closeIssueModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-store-border bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  id="provider-issue-modal-title"
                  className="text-sm font-bold text-slate-900"
                >
                  이슈 상세
                </h3>
                <p className="mt-0.5 break-all text-[11px] text-store-muted">{modalDocTitle}</p>
              </div>
              <button
                type="button"
                onClick={closeIssueModal}
                className="inline-flex min-h-[32px] items-center rounded-lg border border-store-border px-2 text-[11px] font-semibold text-slate-700"
              >
                닫기
              </button>
            </div>

            {modalIssues.length === 0 ? (
              <p className="mt-3 text-xs text-store-muted">이 파일에 연결된 이슈가 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {modalIssues.map((issue) => {
                  const active = (modalSelectedIssueId ?? modalIssues[0]?.id) === issue.id;
                  return (
                    <li key={issue.id}>
                      <button
                        type="button"
                        onClick={() => setModalSelectedIssueId(issue.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] ${
                          active
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-900">
                            {areaLabel(issue.area)} · {issue.issueTypeLabel}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              issue.severityLabel === "실패"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {issue.severityLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-700">{issue.message}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selectedIssue ? (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-[11px] text-slate-700">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <th className="w-28 bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                        발생 위치
                      </th>
                      <td className="px-3 py-2">
                        {selectedIssue.locationLabel || "위치 정보 없음"}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                        대상 ID
                      </th>
                      <td className="px-3 py-2 font-mono text-[10px]">
                        {selectedIssue.targetId || "—"}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                        문제 데이터
                      </th>
                      <td className="px-3 py-2">
                        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-800">
                          {selectedIssue.problemPreview ||
                            selectedIssue.evidenceGapReason ||
                            "상세 근거 데이터 없음"}
                        </pre>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                        판단 기준
                      </th>
                      <td className="px-3 py-2">{selectedIssue.expectation}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                        서비스 영향
                      </th>
                      <td className="px-3 py-2">{selectedIssue.serviceImpact}</td>
                    </tr>
                    <tr>
                      <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                        제공자 조치
                      </th>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{selectedIssue.providerAction}</span>
                          {phase === "REQUESTED" ? (
                            <button
                              type="button"
                              disabled={busy != null}
                              onClick={() => {
                                openChangesForm(selectedIssue);
                                closeIssueModal();
                              }}
                              className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-800 disabled:opacity-60"
                            >
                              이 이슈로 보완 요청 작성
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {chunkDetailItem ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provider-chunk-detail-title"
          onClick={closeChunkDetail}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-store-border bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  id="provider-chunk-detail-title"
                  className="text-sm font-bold text-slate-900"
                >
                  상세 검토
                </h3>
                <p className="mt-0.5 break-words text-[11px] text-store-muted">
                  {chunkDetailItem.title}
                </p>
              </div>
              <button
                type="button"
                onClick={closeChunkDetail}
                className="inline-flex min-h-[32px] items-center rounded-lg border border-store-border px-2 text-[11px] font-semibold text-slate-700"
              >
                닫기
              </button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-[11px] text-slate-700">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <th className="w-28 bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      원본 추적
                    </th>
                    <td className="px-3 py-2">
                      {[chunkDetailItem.sourceFileName, ...chunkDetailItem.sourceSectionPath]
                        .filter(Boolean)
                        .join(" › ") || "원본 위치 정보 없음"}
                      {chunkDetail?.section ? (
                        <div className="mt-0.5 text-store-muted">
                          섹션: {chunkDetail.section}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      품질 상태
                    </th>
                    <td className="px-3 py-2">
                      <span className="font-semibold">{chunkDetailItem.statusLabel}</span>
                      {chunkDetailItem.issueTypeLabels.length > 0 ? (
                        <span className="text-store-muted">
                          {" "}
                          · {chunkDetailItem.issueTypeLabels.join(", ")}
                        </span>
                      ) : null}
                      <div className="mt-1">{chunkDetailItem.issueReason}</div>
                      <div className="mt-1 text-store-muted">
                        {chunkDetailItem.providerActionHint}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      지식 단위 본문
                    </th>
                    <td className="px-3 py-2">
                      {chunkDetailBusy ? (
                        <p className="text-store-muted">본문을 불러오는 중…</p>
                      ) : chunkDetailError ? (
                        <p className="text-amber-800">
                          {chunkDetailError}
                          <span className="mt-1 block text-store-muted">
                            목록 미리보기: {chunkDetailItem.contentPreview}
                          </span>
                        </p>
                      ) : (
                        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-800">
                          {chunkDetail?.content || chunkDetailItem.contentPreview}
                          {chunkDetail?.contentTruncated ? "\n…(이후 생략)" : ""}
                        </pre>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      원문
                    </th>
                    <td className="px-3 py-2">
                      <p className="break-all text-store-muted">
                        {chunkDetail?.sourceFileName || chunkDetailItem.sourceFileName}
                      </p>
                      {chunkDetailBusy ? (
                        <p className="mt-2 text-store-muted">원문을 불러오는 중…</p>
                      ) : chunkDetail?.sourceContentPreview ? (
                        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-800">
                          {chunkDetail.sourceContentPreview}
                          {chunkDetail.sourceContentTruncated ? "\n…(이후 생략)" : ""}
                        </pre>
                      ) : (
                        <p className="mt-2 text-amber-800">
                          저장된 원문 본문이 없습니다. 원본 파일명과 섹션 경로를 복사해
                          자료를 대조하세요.
                        </p>
                      )}
                      <button
                        type="button"
                        className="mt-2 min-h-[32px] rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800"
                        onClick={() => {
                          const text = [
                            chunkDetail?.sourceFileName || chunkDetailItem.sourceFileName,
                            ...chunkDetailItem.sourceSectionPath,
                            chunkDetail?.section,
                          ]
                            .filter(Boolean)
                            .join(" › ");
                          void navigator.clipboard?.writeText(text).then(() => {
                            setMessage("원본 위치를 클립보드에 복사했습니다.");
                          });
                        }}
                      >
                        원본 위치 복사
                      </button>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      주변 문맥
                    </th>
                    <td className="px-3 py-2">
                      <div>이전: {chunkDetail?.prevChunkTitle || "—"}</div>
                      <div>다음: {chunkDetail?.nextChunkTitle || "—"}</div>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      확인 가이드
                    </th>
                    <td className="px-3 py-2">
                      <ul className="list-disc space-y-1 pl-4">
                        {PROVIDER_CHUNK_REVIEW_CHECKLIST.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-slate-50 px-3 py-2 font-semibold text-store-muted">
                      고급 정보
                    </th>
                    <td className="space-y-0.5 px-3 py-2 font-mono text-[10px] text-store-muted">
                      <div>지식 단위 ID: {chunkDetailItem.chunkId}</div>
                      <div>
                        원본 문서 ID:{" "}
                        {chunkDetail?.sourceDocumentId ||
                          chunkDetailItem.sourceDocumentId ||
                          "—"}
                      </div>
                      <div>knowledgeUnitId: {chunkDetail?.knowledgeUnitId || "—"}</div>
                      {chunkDetailItem.charCount > 0 ? (
                        <div>본문 길이: {chunkDetailItem.charCount}자</div>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {phase === "REQUESTED" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => {
                    markChunkOk(chunkDetailItem.chunkId);
                    closeChunkDetail();
                  }}
                  className="min-h-[36px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 disabled:opacity-50"
                >
                  문제 없음
                </button>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => {
                    openChangesForm(null, chunkDetailItem);
                    closeChunkDetail();
                  }}
                  className="min-h-[36px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  보완 요청에 추가
                </button>
                <button
                  type="button"
                  title={
                    blockingFail
                      ? "실패 상태에서는 확인 완료할 수 없습니다."
                      : attentionChunkCount > 0 && !chunkAttentionReviewed
                        ? "주의·보완 항목을 확인한 뒤 가능합니다."
                        : undefined
                  }
                  disabled={busy != null || blockingFail}
                  onClick={() => {
                    markChunkAttentionReviewed();
                    closeChunkDetail();
                    void runConfirm({ attentionReviewed: true });
                  }}
                  className="min-h-[36px] rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  확인 완료
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}

      {blockingFail && phase === "REQUESTED" ? (
        <p className="text-[11px] text-red-700">
          실패 상태인 필수 품질 항목이 있어 확인 완료가 막혀 있습니다. 보완 요청을 제출해 주세요.
        </p>
      ) : null}

      {formOpen && phase === "REQUESTED" ? (
        <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
          <h3 className="text-sm font-bold text-slate-900">보완 요청 작성</h3>
          <label className="block text-xs font-semibold text-slate-700">
            보완 유형
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as ProviderChangesRequestType)}
              className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
            >
              {PROVIDER_CHANGES_REQUEST_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            보완 대상
            <select
              value={targetKind}
              onChange={(e) => setTargetKind(e.target.value as ProviderChangesRequestTarget)}
              className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
            >
              {PROVIDER_CHANGES_REQUEST_TARGETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            대상 식별
            <input
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder="파일명, 섹션, Chunk ID, 검색 질문 등"
              className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            상세 요청 내용
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              required
              placeholder="예: rMate Grid 사용 설명서의 셀 병합 섹션이 여러 개의 짧은 chunk로 분리되어 검색 근거가 약합니다. 해당 섹션을 하나의 의미 단위로 재청킹해 주세요."
              className="mt-1 w-full rounded-lg border border-store-border px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null || !details.trim()}
              onClick={() => void runChangesRequest()}
              className="min-h-[40px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy === "withdraw" ? "제출 중…" : "보완 요청 제출"}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => setFormOpen(false)}
              className="min-h-[40px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-700"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
