"use client";

import { useMemo, useState } from "react";
import { sanitizeMarkdownForPreview } from "@/lib/adapters/docling/docling-markdown-validator";
import type {
  DoclingProcessingLogPublicDto,
  NormalizedDocumentSummaryDto,
} from "@/lib/docling-import/docling-import-dto";

const PREVIEW_TABS = [
  "overview",
  "sections",
  "paragraphs",
  "tables",
  "figures",
  "markdown",
  "logs",
] as const;

type PreviewTabId = (typeof PREVIEW_TABS)[number];

const PREVIEW_TAB_LABELS: Record<PreviewTabId, string> = {
  overview: "개요",
  sections: "Headings",
  paragraphs: "본문",
  tables: "Tables",
  figures: "Figures",
  markdown: "Markdown",
  logs: "처리 로그",
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function previewText(value: unknown, max = 240): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
  try {
    const text = JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return String(value);
  }
}

export function NormalizedDocumentPreview({
  document,
  structure,
  markdownText,
  processingLogs,
}: {
  readonly document: NormalizedDocumentSummaryDto | null;
  readonly structure: unknown;
  readonly markdownText?: string | null;
  readonly processingLogs?: readonly DoclingProcessingLogPublicDto[];
}) {
  const [tab, setTab] = useState<PreviewTabId>("overview");
  const structureObj =
    structure && typeof structure === "object" ? (structure as Record<string, unknown>) : null;
  const sections = asArray(structureObj?.sections);
  const tables = asArray(structureObj?.tables);
  const figures = asArray(structureObj?.figures);
  const warnings = asArray(structureObj?.warnings);
  const summary =
    structureObj?.summary && typeof structureObj.summary === "object"
      ? (structureObj.summary as Record<string, unknown>)
      : null;

  function isHeadingRow(row: Record<string, unknown>): boolean {
    const label = String(row.label ?? "").toLowerCase();
    return (
      label.includes("title") ||
      label.includes("heading") ||
      label.includes("section_header") ||
      label.includes("header")
    );
  }

  const headingRows = sections.filter((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return isHeadingRow(row) || Boolean(row.title);
  });
  const paragraphRows = sections.filter((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return !isHeadingRow(row) && !Boolean(row.title);
  });

  const sanitizedMarkdown = useMemo(
    () => sanitizeMarkdownForPreview(markdownText ?? ""),
    [markdownText],
  );

  if (!document) {
    return (
      <p className="text-sm text-store-muted">정규화 문서(NormalizedDocument)가 아직 없습니다.</p>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-store-border bg-slate-50/80 p-3">
      <p className="text-xs font-semibold text-slate-900">NormalizedDocument 미리보기</p>
      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-store-border bg-white p-1"
        role="tablist"
        aria-label="정규화 문서 미리보기"
      >
        {PREVIEW_TABS.map((id) => {
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
              {PREVIEW_TAB_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-store-border bg-white p-3 text-xs text-slate-800">
        {tab === "overview" ? (
          <ul className="space-y-1.5">
            <li>제목: {document.title ?? "—"}</li>
            <li>
              언어: {document.language ?? "미확인"}
              {document.languageSource ? ` (${document.languageSource}` : ""}
              {document.languageConfidence != null
                ? ` · ${Math.round(document.languageConfidence * 100)}%`
                : ""}
              {document.languageSource ? ")" : ""}
            </li>
            <li>
              Schema: {document.sourceSchemaName ?? "—"}{" "}
              {document.sourceSchemaVersion ? `v${document.sourceSchemaVersion}` : ""}
            </li>
            <li>
              Adapter: {document.adapterType} {document.adapterVersion}
            </li>
            <li className="break-all">
              Fingerprint:{" "}
              {document.fingerprint
                ? `${document.fingerprint.slice(0, 8)}…${document.fingerprint.slice(-6)}`
                : "—"}
            </li>
            <li>경고 수: {document.warningCount}</li>
            <li>Headings: {Number(summary?.headingCount ?? headingRows.length)}</li>
            <li>Paragraphs: {Number(summary?.paragraphCount ?? paragraphRows.length)}</li>
            <li>Lists: {Number(summary?.listCount ?? 0)}</li>
            <li>Tables: {Number(summary?.tableCount ?? tables.length)}</li>
            <li>Figures: {Number(summary?.figureCount ?? figures.length)}</li>
            <li>Reading Order: {Number(summary?.readingOrderCount ?? 0)}</li>
            {warnings.length > 0 ? (
              <li>
                경고 샘플:{" "}
                {warnings
                  .slice(0, 3)
                  .map((w) => previewText(w, 80))
                  .join(" · ")}
              </li>
            ) : null}
          </ul>
        ) : null}

        {tab === "sections" ? (
          headingRows.length === 0 ? (
            <p className="text-store-muted">Heading이 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {headingRows.slice(0, 60).map((item, index) => {
                const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return (
                  <li key={String(row.id ?? index)} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="font-semibold">
                      {String(row.title ?? row.label ?? `Heading ${index + 1}`)}
                    </p>
                    <p className="mt-1 text-store-muted">
                      Level {String(row.level ?? "—")} · {previewText(row.sourceRef)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "paragraphs" ? (
          paragraphRows.length === 0 ? (
            <p className="text-store-muted">본문 Paragraph가 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {paragraphRows.slice(0, 40).map((item, index) => {
                const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return (
                  <li key={String(row.id ?? index)} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="mt-1 text-store-muted">{previewText(row.text ?? row.sourceRef)}</p>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "tables" ? (
          tables.length === 0 ? (
            <p className="text-store-muted">테이블이 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {tables.slice(0, 20).map((item, index) => {
                const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return (
                  <li key={String(row.id ?? index)} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="font-semibold">{String(row.caption ?? row.label ?? `표 ${index + 1}`)}</p>
                    <p className="mt-1 break-all text-store-muted">
                      Source: {previewText(row.sourceRef)} · {previewText(row.data, 120)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "figures" ? (
          figures.length === 0 ? (
            <p className="text-store-muted">Figures가 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {figures.slice(0, 20).map((item, index) => {
                const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return (
                  <li key={String(row.id ?? index)} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="font-semibold">
                      {String(row.caption ?? row.label ?? `그림 ${index + 1}`)}
                    </p>
                    <p className="mt-1 text-store-muted">{previewText(row.sourceRef)}</p>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {tab === "markdown" ? (
          sanitizedMarkdown.trim() ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
              {sanitizedMarkdown}
            </pre>
          ) : (
            <p className="text-store-muted">Markdown 미리보기를 불러오지 못했습니다.</p>
          )
        ) : null}

        {tab === "logs" ? (
          !processingLogs || processingLogs.length === 0 ? (
            <p className="text-store-muted">처리 로그가 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {processingLogs.map((log) => (
                <li key={log.id} className="rounded-lg bg-slate-50 px-2 py-2">
                  <p className="font-semibold">
                    {log.stage} · {log.status}
                    {log.attempt > 1 ? ` (#${log.attempt})` : ""}
                  </p>
                  <p className="mt-1 text-store-muted">
                    {log.message ?? log.errorCode ?? "—"} ·{" "}
                    {log.startedAt.replace("T", " ").slice(0, 19)}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  );
}
