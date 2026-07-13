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
  "tables",
  "figures",
  "markdown",
  "logs",
] as const;

type PreviewTabId = (typeof PREVIEW_TABS)[number];

const PREVIEW_TAB_LABELS: Record<PreviewTabId, string> = {
  overview: "개요",
  sections: "Sections",
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
            <li>언어: {document.language ?? "—"}</li>
            <li>
              Schema: {document.sourceSchemaName ?? "—"}{" "}
              {document.sourceSchemaVersion ? `v${document.sourceSchemaVersion}` : ""}
            </li>
            <li>
              Adapter: {document.adapterType} {document.adapterVersion}
            </li>
            <li className="break-all">Fingerprint: {document.fingerprint ?? "—"}</li>
            <li>경고 수: {document.warningCount}</li>
            <li>Sections: {sections.length}</li>
            <li>Tables: {tables.length}</li>
            <li>Figures: {figures.length}</li>
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
          sections.length === 0 ? (
            <p className="text-store-muted">섹션이 없습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {sections.slice(0, 40).map((item, index) => {
                const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return (
                  <li key={String(row.id ?? index)} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="font-semibold">{String(row.title ?? row.label ?? `섹션 ${index + 1}`)}</p>
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
                    <p className="mt-1 break-all text-store-muted">{previewText(row.data)}</p>
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
