"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchProviderKnowledgePipelineApi,
  startProviderKnowledgePipelineApi,
  type DoclingKnowledgePipelineStatusDto,
} from "@/lib/provider-center-api";

function statusLabel(status: string): string {
  switch (status) {
    case "PASS":
      return "완료";
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
    push("경고 수", details.warningCount);
    push("치명적 오류 수", details.blockerCount);
  } else if (stageId === "KNOWLEDGE_UNIT") {
    push("Unit 수", details.unitCount);
    push("제외 수", details.excludedCount);
    const coverage = details.coverage as Record<string, unknown> | undefined;
    if (coverage) {
      push("본문 coverage", coverage.bodyCoverage);
      push("표 coverage", coverage.tableCoverage);
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
  onGoToDistribution,
  onStatusChange,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToDistribution?: () => void;
  readonly onStatusChange?: (status: DoclingKnowledgePipelineStatusDto) => void;
}) {
  const [status, setStatus] = useState<DoclingKnowledgePipelineStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

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
      setError(err instanceof Error ? err.message : "지식 데이터 생성을 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-store-muted">지식 데이터 생성 상태를 불러오는 중…</p>;
  }

  const primary = status?.primaryCta ?? "none";
  const running =
    status?.runStatus === "RUNNING" || status?.runStatus === "PENDING";

  return (
    <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-base font-bold text-slate-900">지식 데이터 생성</h2>
        <p className="mt-1 text-sm text-store-muted">
          등록한 문서를 AI가 검색하고 활용할 수 있는 지식 데이터로 변환합니다. 문서 구조, 지식
          단위, 검색 데이터와 검색 결과를 순서대로 확인합니다.
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
            "자료 등록에서 대표 샘플 확인을 완료해야 이 단계를 시작할 수 있습니다."}
        </p>
      ) : null}

      {running ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          지식 데이터 생성이 진행 중입니다. 단계별 상태를 확인해 주세요.
        </p>
      ) : null}

      <ol className="space-y-2">
        {(status?.stages ?? []).map((stage) => (
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
                {statusLabel(stage.status)}
              </span>
            </div>
            {stage.message ? (
              <p className="mt-1 text-xs text-slate-700">{stage.message}</p>
            ) : null}
            {stage.nextAction ? (
              <p className="mt-1 text-xs text-amber-800">다음 행동: {stage.nextAction}</p>
            ) : null}
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-store-accent"
              onClick={() => setExpanded(expanded === stage.id ? null : stage.id)}
            >
              {expanded === stage.id ? "상세 접기" : "상세 보기"}
            </button>
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
            {starting ? "시작 중…" : "지식 데이터 생성 시작"}
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
        {primary === "distribution" && status?.passed ? (
          <button
            type="button"
            onClick={() => onGoToDistribution?.()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          >
            유통정보 입력
          </button>
        ) : null}
      </div>

      {status?.passed ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          지식 데이터 생성 완료. 유통정보를 입력한 뒤 검수요청을 진행할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}
