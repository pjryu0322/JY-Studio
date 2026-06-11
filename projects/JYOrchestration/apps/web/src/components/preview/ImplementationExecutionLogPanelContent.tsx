"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  buildExecutionLogEntryCopyText,
  buildExecutionLogTimelineMarkdown,
  formatExecutionLogEntryMetadataLines,
  formatExecutionLogTimelineLabel,
  parseExecutionLogResponseFields,
  pickExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";

const labelSm: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: "#64748b",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const bodyLg: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: "#0f172a",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
};

const actionBarBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  color: "#0f172a",
};

const docBlock: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  padding: "18px 22px",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

function sanitizeExportFileStem(name: string): string {
  const trimmed = name.trim().slice(0, 80);
  const base = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "");
  return base.length > 0 ? base : "project";
}

function localDateSlug(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function ClipboardIcon({ size = 20 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CopyIconButton({
  ariaLabel,
  title,
  disabled,
  onClick,
}: {
  readonly ariaLabel: string;
  readonly title: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#334155",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        flexShrink: 0,
      }}
    >
      <ClipboardIcon size={18} />
    </button>
  );
}

export function ImplementationExecutionLogPanelContent(props: {
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly exportBaseName?: string | null;
  readonly onClearExecutionLog?: () => void | Promise<void>;
  readonly onFeedback?: (message: string) => void;
}): ReactNode {
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);

  const executionLogTimeline = useMemo(
    () => pickExecutionLogTimelineEntries(props.promptTimeline),
    [props.promptTimeline],
  );

  const exportStem = useMemo(
    () => sanitizeExportFileStem(props.exportBaseName ?? ""),
    [props.exportBaseName],
  );

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
    };
  }, []);

  const showCopyFeedback = useCallback(
    (message: string) => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
      setCopyToastMessage(message);
      props.onFeedback?.(message);
      copyToastTimerRef.current = setTimeout(() => {
        setCopyToastMessage(null);
        copyToastTimerRef.current = null;
      }, 2000);
    },
    [props.onFeedback],
  );

  const onDownloadExecutionLogMarkdown = useCallback(() => {
    if (!executionLogTimeline.length) return;
    const md = buildExecutionLogTimelineMarkdown(executionLogTimeline);
    const date = localDateSlug();
    downloadTextFile(`${exportStem}-execution-log-${date}.md`, md, "text/markdown;charset=utf-8");
  }, [exportStem, executionLogTimeline]);

  const onClearExecutionLogClick = useCallback(() => {
    if (!executionLogTimeline.length || !props.onClearExecutionLog) return;
    const count = executionLogTimeline.length;
    const ok = window.confirm(
      `표시 중인 실행 로그 ${count}건을 삭제할까요?\n프롬프트·대화 기록 등 다른 타임라인은 유지됩니다.`,
    );
    if (!ok) return;
    void Promise.resolve(props.onClearExecutionLog()).then(() => {
      showCopyFeedback("실행 로그를 초기화했습니다.");
    });
  }, [executionLogTimeline.length, props.onClearExecutionLog, showCopyFeedback]);

  const onCopyExecutionLogEntry = useCallback(
    async (entry: RequirementsPromptTimelineEntry) => {
      const text = buildExecutionLogEntryCopyText(entry);
      if (!text.trim()) return;
      const ok = await writeClipboardText(text);
      showCopyFeedback(
        ok ? "실행 로그를 클립보드에 복사했습니다." : "복사에 실패했습니다. 브라우저 권한을 확인해 주세요.",
      );
    },
    [showCopyFeedback],
  );

  return (
    <div style={{ position: "relative" }} data-testid="prompt-timeline-execution-log-tab">
      {copyToastMessage ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            zIndex: 2,
            padding: "8px 14px",
            borderRadius: 10,
            background: "#0f172a",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
            maxWidth: "min(320px, 90vw)",
          }}
        >
          {copyToastMessage}
        </div>
      ) : null}
      <div style={docBlock}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={labelSm}>실행 로그</div>
          {executionLogTimeline.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {props.onClearExecutionLog ? (
                <button
                  type="button"
                  onClick={onClearExecutionLogClick}
                  data-testid="execution-log-clear-button"
                  style={{
                    ...actionBarBtn,
                    borderColor: "#fecaca",
                    color: "#b91c1c",
                  }}
                >
                  실행 로그 초기화
                </button>
              ) : null}
              <button type="button" onClick={onDownloadExecutionLogMarkdown} style={actionBarBtn}>
                실행 로그 MD 저장
              </button>
            </div>
          ) : null}
        </div>
        {!executionLogTimeline.length ? (
          <div style={{ ...bodyLg, color: "#64748b" }}>표시할 실행 로그가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {executionLogTimeline.map((entry, index) => {
              const parsedFields = parseExecutionLogResponseFields(entry.responseText);
              const metadataLines = formatExecutionLogEntryMetadataLines(entry);
              const fieldEntries = Object.entries(parsedFields).filter(([key]) => key !== "type");
              return (
                <div
                  key={`${entry.action}-${entry.createdAt}-${index}`}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>
                        {formatExecutionLogTimelineLabel(entry)}
                      </div>
                      <div style={{ color: "#64748b", marginTop: 4 }}>
                        {new Date(entry.createdAt).toLocaleString("ko-KR")}
                        {entry.action ? ` · ${entry.action}` : ""}
                      </div>
                    </div>
                    <CopyIconButton
                      ariaLabel="실행 로그 항목 복사"
                      title="이 실행 로그 복사"
                      disabled={!buildExecutionLogEntryCopyText(entry).trim()}
                      onClick={() => void onCopyExecutionLogEntry(entry)}
                    />
                  </div>
                  {metadataLines.length ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        color: "#475569",
                        fontSize: 11,
                      }}
                    >
                      {metadataLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  ) : null}
                  {fieldEntries.length ? (
                    <div
                      style={{
                        marginTop: 8,
                        display: "grid",
                        gridTemplateColumns: "minmax(96px, auto) 1fr",
                        gap: "4px 10px",
                        fontSize: 11,
                        color: "#334155",
                      }}
                    >
                      {fieldEntries.map(([key, value]) => (
                        <div key={`${entry.createdAt}-${key}`} style={{ display: "contents" }}>
                          <div style={{ fontWeight: 700, color: "#64748b" }}>{key}</div>
                          <div style={{ wordBreak: "break-word" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {entry.error?.trim() ? (
                    <pre
                      style={{
                        margin: "8px 0 0",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "#991b1b",
                      }}
                    >
                      {entry.error}
                    </pre>
                  ) : null}
                  {entry.responseText?.trim() && !fieldEntries.length ? (
                    <pre
                      style={{
                        margin: "8px 0 0",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "#334155",
                      }}
                    >
                      {entry.responseText}
                    </pre>
                  ) : null}
                  {entry.promptText?.trim() ? (
                    <>
                      <div style={{ ...labelSm, marginTop: 10, marginBottom: 4 }}>프롬프트</div>
                      <pre
                        style={{
                          margin: 0,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 11,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          color: "#334155",
                          maxHeight: 180,
                          overflow: "auto",
                        }}
                      >
                        {entry.promptText}
                      </pre>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
