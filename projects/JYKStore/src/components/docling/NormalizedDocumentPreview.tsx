"use client";

import { useMemo, useState } from "react";
import { sanitizeMarkdownForPreview } from "@/lib/adapters/docling/docling-markdown-validator";
import type {
  DoclingProcessingLogPublicDto,
  NormalizedDocumentSummaryDto,
} from "@/lib/docling-import/docling-import-dto";
import type { DoclingQualityGateResult, QualityIssue } from "@/lib/docling-import/docling-quality-gate";
import {
  collectAdvancedFigureSamples,
  collectBodySamples,
  collectContentTableSamples,
  collectFigureSamples,
  collectHeadingSamples,
} from "@/lib/docling-import/structure-summary";
import type { NormalizedFigure, NormalizedSection, NormalizedTable } from "@/lib/adapters/docling/docling-types";
import { figureRefToRouteParam } from "@/lib/adapters/docling/docling-figure-ids";
import { providerDoclingFigurePreviewUrl } from "@/lib/provider-center-api";

const PRIMARY_TABS = ["summary", "headings", "body", "tables", "figures"] as const;
type PrimaryTabId = (typeof PRIMARY_TABS)[number];

const PRIMARY_TAB_LABELS: Record<PrimaryTabId, string> = {
  summary: "확인 요약",
  headings: "목차 샘플",
  body: "본문 샘플",
  tables: "표 샘플",
  figures: "그림 샘플",
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function severityLabel(severity: QualityIssue["severity"]): string {
  if (severity === "blocker") return "차단 문제";
  if (severity === "warning") return "확인 권장";
  return "참고";
}

function humanLogLabel(stage: string, status: string): string {
  if (stage === "UPLOAD" && status === "SUCCEEDED") return "파일 등록 완료";
  if (stage === "VALIDATION" && status === "SUCCEEDED") return "검증 완료";
  if (stage === "NORMALIZATION" && status === "SUCCEEDED") return "정규화 완료";
  if (stage === "NORMALIZATION" && status === "STARTED") return "정규화 중";
  return "제공자 확인 대기";
}

function formatLanguage(language: string | null | undefined): string {
  if (language === "ko" || language === "KO") return "한국어";
  if (language === "en" || language === "EN") return "영어";
  return language?.trim() ? language : "미선택";
}

function statusWord(ok: boolean, emptyLabel: string): string {
  return ok ? "정상" : emptyLabel;
}

function tableDims(data: {
  rowCount?: number;
  columnCount?: number;
  rows?: number;
  cols?: number;
}): { rows: number; cols: number } {
  return {
    rows: data.rowCount ?? data.rows ?? 0,
    cols: data.columnCount ?? data.cols ?? 0,
  };
}

export function NormalizedDocumentPreview({
  document,
  structure,
  markdownText,
  processingLogs,
  qualityGate: qualityGateProp,
  packId,
  bundleId,
}: {
  readonly document: NormalizedDocumentSummaryDto | null;
  readonly structure: unknown;
  readonly markdownText?: string | null;
  readonly processingLogs?: readonly DoclingProcessingLogPublicDto[];
  readonly qualityGate?: DoclingQualityGateResult | null;
  readonly packId?: string | null;
  readonly bundleId?: string | null;
}) {
  const [tab, setTab] = useState<PrimaryTabId>("summary");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const structureObj =
    structure && typeof structure === "object" ? (structure as Record<string, unknown>) : null;
  const sections = asArray(structureObj?.sections) as NormalizedSection[];
  const tables = asArray(structureObj?.tables) as NormalizedTable[];
  const figures = asArray(structureObj?.figures) as NormalizedFigure[];
  const summary =
    structureObj?.summary && typeof structureObj.summary === "object"
      ? (structureObj.summary as Record<string, unknown>)
      : null;

  const qualityGate: DoclingQualityGateResult | null =
    qualityGateProp ??
    (structureObj?.qualityGate && typeof structureObj.qualityGate === "object"
      ? (structureObj.qualityGate as DoclingQualityGateResult)
      : null);

  const headingSamples = useMemo(() => collectHeadingSamples(sections, 20), [sections]);
  const bodySamples = useMemo(() => collectBodySamples(sections), [sections]);
  const tableSamples = useMemo(() => collectContentTableSamples(tables, 5), [tables]);
  const figureSamples = useMemo(() => collectFigureSamples(figures, 5), [figures]);
  const advancedFigures = useMemo(() => collectAdvancedFigureSamples(figures, 8), [figures]);
  const headingCount = Number(summary?.headingCount ?? headingSamples.length);
  const paragraphCount = Number(summary?.paragraphCount ?? bodySamples.length);
  const readingOrderCount = Number(summary?.readingOrderCount ?? 0);
  const contentTableCount = Number(summary?.contentTableCount ?? tableSamples.length);
  const tocTableCount = Number(summary?.tocTableCount ?? 0);
  const contentFigureCount = Number(
    summary?.contentFigureCount ??
      figureSamples.filter((f) => !f.isFallbackCandidate).length,
  );
  const unknownFigureCount = Number(
    summary?.unknownFigureCount ??
      figures.filter((f) => (f.classification ?? "") === "UNKNOWN").length,
  );
  const decorativeFigureCount = Number(
    summary?.decorativeFigureCount ?? advancedFigures.length,
  );
  const figurePreviewSuccessCount = Number(
    summary?.figurePreviewSuccessCount ??
      figures.filter((f) => Boolean(f.previewObjectKey?.trim())).length,
  );
  const figureSampleFallback = figureSamples.some((f) => f.isFallbackCandidate);

  const sanitizedMarkdown = useMemo(
    () => sanitizeMarkdownForPreview(markdownText ?? ""),
    [markdownText],
  );

  const issues: QualityIssue[] = useMemo(() => {
    if (!qualityGate) return [];
    return [...qualityGate.blockers, ...qualityGate.warnings, ...qualityGate.info];
  }, [qualityGate]);

  if (!document) {
    return (
      <p className="text-sm text-store-muted">정규화 결과가 아직 없습니다.</p>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-store-border bg-slate-50/80 p-3">
      <div>
        <p className="text-xs font-semibold text-slate-900">정규화 결과 확인</p>
        <p className="mt-1 text-xs text-store-muted">
          문서의 목차, 본문, 표, 그림이 올바르게 추출됐는지 대표 샘플을 확인해 주세요. 문제가 있으면
          자료를 교체하거나 다시 처리할 수 있습니다.
        </p>
      </div>

      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-store-border bg-white p-1"
        role="tablist"
        aria-label="정규화 결과 확인"
      >
        {PRIMARY_TABS.map((id) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-bold ${
                active
                  ? "bg-store-accent text-white"
                  : "bg-transparent text-slate-700 hover:bg-slate-50"
              }`}
            >
              {PRIMARY_TAB_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-store-border bg-white p-3 text-xs text-slate-800">
        {tab === "summary" ? (
          <div className="space-y-3">
            <ul className="space-y-1.5">
              <li>
                문서 제목 <span className="font-semibold">{document.title ?? "—"}</span>
              </li>
              <li>
                언어 <span className="font-semibold">{formatLanguage(document.language)}</span>
              </li>
              <li>
                본문 추출{" "}
                <span className="font-semibold">
                  {statusWord(paragraphCount > 0, "실패")}
                  {paragraphCount > 0 ? ` (${paragraphCount}개)` : ""}
                </span>
              </li>
              <li>
                읽기 순서{" "}
                <span className="font-semibold">
                  {statusWord(readingOrderCount > 0, "생성되지 않음")}
                  {readingOrderCount > 0 ? ` (${readingOrderCount})` : ""}
                </span>
              </li>
              <li>
                실제 표{" "}
                <span className="font-semibold">{contentTableCount}개</span>
              </li>
              <li>
                목차용 표{" "}
                <span className="font-semibold">{tocTableCount}개</span>
              </li>
              <li>
                전체 그림{" "}
                <span className="font-semibold">{figures.length}개</span>
              </li>
              <li>
                실제 그림{" "}
                <span className="font-semibold">{contentFigureCount}개</span>
              </li>
              <li>
                확인 필요 그림{" "}
                <span className="font-semibold">{unknownFigureCount}개</span>
              </li>
              <li>
                표지·장식 이미지{" "}
                <span className="font-semibold">{decorativeFigureCount}개</span>
              </li>
              <li>
                미리보기 생성 성공{" "}
                <span className="font-semibold">{figurePreviewSuccessCount}개</span>
              </li>
              <li>
                품질 차단 문제{" "}
                <span className="font-semibold">{qualityGate?.blockers.length ?? 0}개</span>
              </li>
              <li>
                품질 경고{" "}
                <span className="font-semibold">{qualityGate?.warnings.length ?? document.warningCount}개</span>
              </li>
            </ul>

            {issues.length > 0 ? (
              <div>
                <h3 className="text-xs font-bold text-slate-900">확인이 필요한 항목</h3>
                <ul className="mt-2 space-y-2">
                  {issues.map((issue) => (
                    <li
                      key={issue.code}
                      className={`rounded-lg px-3 py-2 ${
                        issue.severity === "blocker"
                          ? "border border-red-200 bg-red-50 text-red-950"
                          : "border border-amber-200 bg-amber-50 text-amber-950"
                      }`}
                    >
                      <p className="font-semibold">
                        ⚠ {severityLabel(issue.severity)} · {issue.message}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-950">
                ✓ 차단 문제 없이 대표 샘플을 확인할 수 있습니다.
              </p>
            )}
          </div>
        ) : null}

        {tab === "headings" ? (
          headingSamples.length === 0 ? (
            <p className="text-store-muted">표시할 목차 샘플이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-store-muted">전체 {headingCount}개 중 대표 {headingSamples.length}개</p>
              <ol className="max-h-72 list-decimal space-y-2 overflow-y-auto pl-5">
                {headingSamples.map((row, index) => (
                  <li key={`${row.title}-${index}`}>
                    <p className="font-semibold">{row.title}</p>
                    <p className="text-store-muted">
                      {row.page != null ? `${row.page}페이지` : "페이지 —"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )
        ) : null}

        {tab === "body" ? (
          bodySamples.length === 0 ? (
            <p className="text-store-muted">본문 텍스트가 추출되지 않았습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {bodySamples.map((row, index) => (
                <li key={`${row.position}-${index}`} className="rounded-lg bg-slate-50 px-2 py-2">
                  <p className="text-store-muted">
                    {row.position}
                    {row.page != null ? ` · ${row.page}페이지` : ""}
                  </p>
                  <p className="mt-1 leading-relaxed">{row.text.slice(0, 400)}{row.text.length > 400 ? "…" : ""}</p>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "tables" ? (
          tableSamples.length === 0 ? (
            <p className="text-store-muted">표시할 표 샘플이 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-3 overflow-y-auto">
              {tableSamples.map((table, index) => {
                const data =
                  table.data && typeof table.data === "object"
                    ? (table.data as {
                        rowCount?: number;
                        columnCount?: number;
                        rows?: number;
                        cols?: number;
                        previewRows?: string[][];
                        page?: number | null;
                        pageNumber?: number | null;
                        cellTextCount?: number;
                        hasOnlyCoords?: boolean;
                        cells?: Array<{
                          row: number;
                          column: number;
                          rowSpan?: number;
                          columnSpan?: number;
                          isColumnHeader?: boolean;
                        }>;
                      })
                    : {};
                const dims = tableDims(data);
                const page = data.pageNumber ?? data.page;
                return (
                  <li key={table.id ?? index} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="font-semibold">{table.caption?.trim() || `표 ${index + 1}`}</p>
                    <p className="text-store-muted">
                      {page != null ? `${page}페이지 · ` : ""}
                      {dims.rows}행 × {dims.cols}열
                    </p>
                    {data.hasOnlyCoords || (dims.rows > 0 && (data.cellTextCount ?? 0) === 0) ? (
                      <p className="mt-1 text-amber-800">표 내용 해석 실패</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full border-collapse text-[11px]">
                          <tbody>
                            {(data.previewRows ?? []).map((r, ri) => (
                              <tr key={ri}>
                                {r.map((cell, ci) => {
                                  const meta = (data.cells ?? []).find(
                                    (c) => c.row === ri && c.column === ci,
                                  );
                                  const spanHint =
                                    meta &&
                                    ((meta.rowSpan ?? 1) > 1 || (meta.columnSpan ?? 1) > 1)
                                      ? ` (${meta.rowSpan ?? 1}×${meta.columnSpan ?? 1})`
                                      : "";
                                  return (
                                    <td
                                      key={ci}
                                      className={`border border-slate-200 px-1 py-0.5 ${
                                        meta?.isColumnHeader ? "font-semibold bg-slate-100" : ""
                                      }`}
                                    >
                                      {(cell || "—") + spanHint}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "figures" ? (
          figureSamples.length === 0 ? (
            <p className="text-store-muted">표시할 그림 샘플이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {figureSampleFallback ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-amber-900">
                  자동 분류 결과 실제 그림 후보를 찾지 못했습니다. 아래 이미지는 제공자
                  확인이 필요한 후보입니다.
                </p>
              ) : null}
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {figureSamples.map((fig, index) => {
                  const previewUrl =
                    packId && bundleId
                      ? providerDoclingFigurePreviewUrl(
                          packId,
                          bundleId,
                          figureRefToRouteParam(fig.id),
                        )
                      : null;
                  return (
                    <li key={`${fig.id}-${index}`} className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="font-semibold">{fig.title}</p>
                      <p className="text-store-muted">
                        {fig.page != null ? `${fig.page}페이지` : "페이지 —"}
                        {fig.classification ? ` · ${fig.classification}` : ""}
                        {fig.isFallbackCandidate ? " · 확인 필요" : ""}
                        {fig.caption ? ` · ${fig.caption.slice(0, 120)}` : ""}
                      </p>
                      {fig.altText ? <p className="mt-1">대체 텍스트: {fig.altText}</p> : null}
                      {previewUrl && fig.previewObjectKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt={fig.altText || fig.title}
                          className="mt-2 max-h-40 max-w-full rounded border border-slate-200 object-contain"
                        />
                      ) : (
                        <p className="mt-1 text-amber-800">
                          그림 데이터는 확인되었으나 미리보기를 생성하지 못했습니다.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : null}
      </div>

      <details
        className="rounded-xl border border-store-border bg-white p-3 text-xs"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer font-semibold text-slate-800">고급 정보</summary>
        <div className="mt-3 space-y-3 text-slate-700">
          <ul className="space-y-1">
            <li>
              Schema: {document.sourceSchemaName ?? "—"}{" "}
              {document.sourceSchemaVersion ? `v${document.sourceSchemaVersion}` : ""}
            </li>
            <li>
              Adapter: {document.adapterType} {document.adapterVersion}
            </li>
            <li className="break-all">
              Fingerprint: {document.fingerprint ?? "—"}
            </li>
          </ul>

          {advancedFigures.length > 0 ? (
            <div>
              <p className="font-semibold">표지·로고·장식 이미지</p>
              <ul className="mt-1 space-y-1">
                {advancedFigures.map((fig, i) => (
                  <li key={fig.id ?? i}>
                    {fig.caption?.trim() || `이미지 ${i + 1}`}
                    {fig.classification ? ` · ${fig.classification}` : ""}
                    {fig.page != null ? ` · ${fig.page}페이지` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="font-semibold">Markdown 일부 보기</p>
            {sanitizedMarkdown.trim() ? (
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                {sanitizedMarkdown}
              </pre>
            ) : (
              <p className="mt-1 text-store-muted">미리볼 Markdown이 없습니다.</p>
            )}
          </div>

          <div>
            <p className="font-semibold">처리 로그</p>
            {!processingLogs || processingLogs.length === 0 ? (
              <p className="mt-1 text-store-muted">처리 로그가 없습니다.</p>
            ) : (
              <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                {processingLogs.map((log) => (
                  <li key={log.id}>
                    {humanLogLabel(log.stage, log.status)}
                    <span className="text-store-muted">
                      {" "}
                      · {log.stage}/{log.status}
                      {log.message ? ` · ${log.message}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-semibold">내부 warning code</p>
            <ul className="mt-1 space-y-1">
              {(structureObj?.warnings ? asArray(structureObj.warnings) : []).slice(0, 8).map((w, i) => (
                <li key={i} className="break-all font-mono text-[10px] text-store-muted">
                  {typeof w === "string" ? w : JSON.stringify(w)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
