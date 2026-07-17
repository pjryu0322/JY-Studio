"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadProviderKnowledgePipelineStageApi,
  fetchProviderKnowledgePipelineApi,
  startProviderKnowledgePipelineApi,
  type DoclingKnowledgePipelineStatusDto,
} from "@/lib/provider-center-api";
import {
  filterStagesByIds,
  STRUCTURE_STAGE_IDS,
} from "@/lib/docling-knowledge/docling-knowledge-stage-pass";

function canDownloadStage(status: string): boolean {
  return status === "PASS" || status === "WARNING";
}

function statusLabel(status: string, details?: Record<string, unknown> | null): string {
  if (status === "PASS") {
    const advisoryCount =
      typeof details?.warningCount === "number"
        ? details.warningCount
        : Array.isArray(details?.warnings)
          ? details.warnings.length
          : 0;
    if (details?.advisory === true && advisoryCount > 0) {
      return `완료 · 확인사항 ${advisoryCount}건`;
    }
    return "완료";
  }
  switch (status) {
    case "WARNING":
      return "보완 권장";
    case "RUNNING":
      return "진행 중";
    case "FAIL":
      return "실패";
    case "STALE":
      return "다시 생성 필요";
    case "PENDING":
      return "대기";
    case "SKIPPED":
      return "취소됨";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  if (status === "PASS") return "text-emerald-700";
  if (status === "WARNING") return "text-amber-700";
  if (status === "RUNNING" || status === "PENDING") return "text-sky-700";
  if (status === "FAIL" || status === "STALE" || status === "SKIPPED") return "text-rose-700";
  return "text-slate-600";
}

function friendlyDetails(stageId: string, details: Record<string, unknown> | null): string[] {
  if (!details) return [];
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value == null || value === "") return;
    if (typeof value === "number") {
      lines.push(`${label}: ${Number.isInteger(value) ? value : value.toFixed(2)}`);
      return;
    }
    if (typeof value === "string" || typeof value === "boolean") {
      lines.push(`${label}: ${String(value)}`);
    }
  };

  if (stageId === "STRUCTURE") {
    push("제목 수", details.headingCount);
    push("본문 블록 수", details.paragraphCount);
    push("표 수", details.tableCount);
    push("그림 수", details.figureCount);
    push("확인사항 수", details.warningCount);
    push("치명적 오류 수", details.blockerCount);
    const warnings = details.warnings as Array<{ message?: string; code?: string }> | undefined;
    if (Array.isArray(warnings) && warnings.length > 0) {
      for (const w of warnings.slice(0, 8)) {
        if (w.message) lines.push(`확인사항: ${w.message}`);
      }
    }
  } else if (stageId === "KNOWLEDGE_UNIT") {
    push("Unit 수", details.unitCount);
    push("병합된 짧은 Section 수", details.shortSectionMergedCount);
    push("단독 유지된 짧은 Unit 수", details.shortValidUnitCount);
    const coverage = details.coverage as Record<string, unknown> | undefined;
    if (coverage) {
      push("지식화 대상 본문 문자 수", coverage.eligibleBodyChars);
      push("Unit 반영 문자 수", coverage.unitBodyChars);
      push("유효 본문 coverage", coverage.eligibleBodyCoverage ?? coverage.bodyCoverage);
      push("원문 기준 coverage", coverage.rawBodyCoverage);
      push("정상 제외 문자 수", coverage.normalExcludedBodyChars);
      push("검토 필요 누락 문자 수", coverage.criticalExcludedBodyChars);
      push("표 coverage", coverage.tableCoverage);
      push("그림 coverage", coverage.figureCoverage);
      push("출처 추적 누락 수", coverage.provenanceMissing);
      const reasons = coverage.exclusionReasons as
        | Record<string, { count?: number; charCount?: number; sampleTexts?: string[] }>
        | undefined;
      if (reasons) {
        for (const [code, detail] of Object.entries(reasons)) {
          if (!detail || typeof detail !== "object") continue;
          lines.push(
            `제외/${code}: ${detail.count ?? 0}건, ${detail.charCount ?? 0}자` +
              (detail.sampleTexts?.[0] ? ` (예: ${detail.sampleTexts[0]})` : ""),
          );
        }
      }
    }
  } else if (stageId === "RETRIEVAL_CHUNK") {
    push("Chunk 수", details.chunkCount);
    push("평균 길이", details.averageLength);
    push("최소 길이", details.minLength);
    push("최대 길이", details.maxLength);
    push("짧은 Chunk", details.shortCount);
    push("긴 Chunk", details.longCount);
  } else if (stageId === "SEARCH_INDEX") {
    push("Index Generation", details.indexGenerationId);
    push("Draft 상태", details.indexScope ?? details.draft);
    push("처리 Chunk", details.processedCount);
    push("성공 생성", details.createdCount);
    push("실패/스킵", details.skippedCount);
  } else if (stageId === "RETRIEVAL_EVALUATION") {
    push("평가 질문 수", details.questionCount);
    push("통과 수", details.passedCount);
    push("실패 수", details.failedCount);
    push("Recall@5", details.recallAt5);
    push("Hit@3", details.hitAt3);
    push("MRR", details.mrr);
    push("출처 일치율", details.sourceDocumentMatchRate);
    push("출처 완전성", details.provenanceCompletenessRate);
    const failures = details.failures as Array<{ query?: string }> | undefined;
    if (Array.isArray(failures) && failures[0]?.query) {
      lines.push(`대표 실패 질문: ${failures[0].query}`);
    }
  }
  return lines;
}

export function ProviderKnowledgeGenerationTab({
  packId,
  editable,
  onGoToSearchValidation,
  onGoToDistribution,
  onStatusChange,
}: {
  readonly packId: string;
  readonly editable: boolean;
  /** Preferred: navigate to search-validation tab after structure passes. */
  readonly onGoToSearchValidation?: () => void;
  /** @deprecated Prefer onGoToSearchValidation */
  readonly onGoToDistribution?: () => void;
  readonly onStatusChange?: (status: DoclingKnowledgePipelineStatusDto) => void;
}) {
  const [status, setStatus] = useState<DoclingKnowledgePipelineStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [downloadingStage, setDownloadingStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchProviderKnowledgePipelineApi(packId);
      setStatus(data);
      onStatusChange?.(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const runStatus = status?.runStatus;
    if (!runStatus || (runStatus !== "RUNNING" && runStatus !== "PENDING")) return;
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [status?.runStatus, load]);

  async function handleStart(forceRestart = false) {
    setStarting(true);
    setError(null);
    try {
      await startProviderKnowledgePipelineApi(packId, { forceRestart });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 구조화를 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  async function handleDownload(stageId: string) {
    setDownloadingStage(stageId);
    setError(null);
    try {
      await downloadProviderKnowledgePipelineStageApi(packId, stageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
    } finally {
      setDownloadingStage(null);
    }
  }

  const primary = status?.primaryCta ?? "none";
  const running =
    status?.runStatus === "RUNNING" || status?.runStatus === "PENDING";
  const structureStages = useMemo(
    () => filterStagesByIds(status?.stages ?? [], STRUCTURE_STAGE_IDS),
    [status?.stages],
  );
  const goToSearchValidation = onGoToSearchValidation ?? onGoToDistribution;
  const structureComplete = Boolean(status?.structurePassed);

  if (loading) {
    return <p className="text-sm text-store-muted">데이터 구조화 상태를 불러오는 중…</p>;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-base font-bold text-slate-900">데이터 구조화</h2>
        <p className="mt-1 text-sm text-store-muted">
          등록한 문서를 NormalizedDocument·Knowledge Unit·Retrieval Chunk로 구조화합니다. 원문·페이지·출처
          연결을 확인한 뒤 다음 단계에서 검색 경로를 검증합니다.
        </p>
        <p className="mt-2 text-xs text-store-muted">
          Draft 검색 인덱스는 이 파이프라인에서 함께 준비되며, 상태는 다음 단계(검색데이터 생성·검증)에서
          확인합니다. 운영용 Search Generation 도입 후 별도 생성·승격됩니다.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {!status?.providerConfirmed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {status?.lockReason ??
            "자료 등록을 먼저 완료해 주세요."}
        </p>
      ) : null}

      {running ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          데이터 구조화가 진행 중입니다. 단계별 상태를 확인해 주세요.
        </p>
      ) : null}

      <ol className="space-y-2">
        {structureStages.map((stage) => (
          <li
            key={stage.id}
            className="rounded-xl border border-store-border bg-slate-50 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{stage.label}</p>
                <p className="text-xs text-store-muted">{stage.description}</p>
              </div>
              <span className={`text-xs font-bold ${statusClass(stage.status)}`}>
                {statusLabel(stage.status, stage.details)}
              </span>
              {stage.status === "PASS" &&
              stage.details?.advisory === true &&
              Number(stage.details.warningCount ?? 0) > 0 ? (
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  확인사항 {String(stage.details.warningCount)}건
                </span>
              ) : null}
            </div>
            {stage.message ? (
              <p className="mt-1 text-xs text-slate-700">{stage.message}</p>
            ) : null}
            {stage.nextAction ? (
              <p className="mt-1 text-xs text-amber-800">다음 행동: {stage.nextAction}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-xs font-semibold text-store-accent"
                onClick={() => setExpanded(expanded === stage.id ? null : stage.id)}
              >
                {expanded === stage.id ? "상세 접기" : "상세 보기"}
              </button>
              {canDownloadStage(stage.status) ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline disabled:opacity-60"
                  disabled={downloadingStage === stage.id}
                  onClick={() => void handleDownload(stage.id)}
                >
                  {downloadingStage === stage.id ? "다운로드 중…" : "데이터 다운로드"}
                </button>
              ) : null}
            </div>
            {expanded === stage.id ? (
              <div className="mt-2 space-y-1 rounded-lg bg-white p-2 text-xs text-slate-700">
                {friendlyDetails(stage.id, stage.details).length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {friendlyDetails(stage.id, stage.details).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-store-muted">표시할 요약 지표가 없습니다.</p>
                )}
                <button
                  type="button"
                  className="text-[11px] font-semibold text-slate-500"
                  onClick={() => setShowRaw((v) => !v)}
                >
                  {showRaw ? "운영 상세 숨기기" : "운영 상세(JSON)"}
                </button>
                {showRaw ? (
                  <pre className="max-h-40 overflow-auto text-[11px] text-slate-600">
                    {JSON.stringify(
                      {
                        startedAt: stage.startedAt,
                        finishedAt: stage.finishedAt,
                        details: stage.details,
                      },
                      null,
                      2,
                    )}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {editable && primary === "start" ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => void handleStart(false)}
            className="rounded-xl bg-store-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {starting ? "시작 중…" : "데이터 구조화 시작"}
          </button>
        ) : null}
        {editable && (primary === "retry" || primary === "warning_retry") ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => void handleStart(true)}
            className="rounded-xl border border-store-border bg-white px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-60"
          >
            {starting
              ? "재시작 중…"
              : primary === "warning_retry"
                ? "보완 및 다시 검증"
                : "다시 생성"}
          </button>
        ) : null}
        {structureComplete ? (
          <button
            type="button"
            onClick={() => goToSearchValidation?.()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          >
            검색데이터 생성·검증으로 이동
          </button>
        ) : null}
      </div>

      {structureComplete ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          데이터 구조화가 완료되었습니다. 다음 단계에서 Draft 검색 인덱스·검색 평가와 API·MCP·DOWNLOAD를
          확인하세요.
        </p>
      ) : null}
    </section>
  );
}
