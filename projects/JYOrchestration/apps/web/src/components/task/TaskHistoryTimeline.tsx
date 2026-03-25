"use client";

import { useCallback, useMemo, useState } from "react";
import { formatTestedAt } from "@/components/project-spec/format";
import {
  taskHistoryActorLabel,
  taskHistoryBadgeColors,
  taskHistoryEventLabel,
} from "@/lib/ui/taskHistoryPresentation";

export type TaskHistoryItem = {
  id: string;
  projectId: string;
  taskId: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  summary: string | null;
  detailJson: unknown;
  createdAt: string;
};

type TaskHistoryTimelineProps = {
  taskId: string | null;
  taskName: string | null;
  items: TaskHistoryItem[];
  loading: boolean;
  errorMessage: string | null;
  onClose: () => void;
};

function detailText(detailJson: unknown): string {
  if (detailJson === null || detailJson === undefined) {
    return "";
  }
  try {
    return JSON.stringify(detailJson, null, 2);
  } catch {
    return String(detailJson);
  }
}

function hasDetail(detailJson: unknown): boolean {
  const t = detailText(detailJson).trim();
  return t.length > 0;
}

function rowFullText(row: TaskHistoryItem): string {
  const lines = [
    `[${row.createdAt}] ${row.eventType} (${taskHistoryEventLabel(row.eventType)})`,
    `actor: ${taskHistoryActorLabel(row.actorType, row.actorId)}`,
  ];
  if (row.summary?.trim()) {
    lines.push(`summary: ${row.summary.trim()}`);
  }
  const d = detailText(row.detailJson).trim();
  if (d) {
    lines.push("detailJson:", d);
  }
  return lines.join("\n");
}

export function TaskHistoryTimeline({
  taskId,
  taskName,
  items,
  loading,
  errorMessage,
  onClose,
}: TaskHistoryTimelineProps) {
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [expandedDetailIds, setExpandedDetailIds] = useState<Set<string>>(new Set());

  const showHint = useCallback((msg: string, ms: number) => {
    setCopyHint(msg);
    window.setTimeout(() => setCopyHint(null), ms);
  }, []);

  const toggleDetail = useCallback((id: string) => {
    setExpandedDetailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const copyText = useCallback(
    async (label: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showHint(`${label}: 클립보드에 복사했습니다.`, 2200);
      } catch {
        showHint(`${label}: 복사에 실패했습니다. 영역을 직접 선택해 주세요.`, 3500);
      }
    },
    [showHint]
  );

  const allTimelineText = useMemo(() => {
    if (items.length === 0) return "";
    const header = `Task 감사 이력 (읽기 전용)\nTask: ${taskName || taskId}\n항목 수: ${items.length}\n${"=".repeat(48)}\n\n`;
    return header + items.map((row, i) => `--- #${i + 1} ---\n${rowFullText(row)}`).join("\n\n");
  }, [items, taskId, taskName]);

  const copyAllTimeline = useCallback(async () => {
    if (!allTimelineText) return;
    await copyText("전체 이력", allTimelineText);
  }, [allTimelineText, copyText]);

  if (!taskId) {
    return null;
  }

  return (
    <section
      data-ui-label="[F-4-1] Function — Task Audit Timeline"
      style={{
        marginTop: 16,
        border: "1px solid #b0bec5",
        borderRadius: 12,
        padding: 18,
        background: "linear-gradient(180deg, #f8fafc 0%, #eceff1 100%)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#263238" }}>Task 감사 이력</h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                padding: "3px 8px",
                borderRadius: 4,
                background: "#455a64",
                color: "#fff",
              }}
            >
              AUDIT LOG
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                background: "#eceff1",
                color: "#546e7a",
                border: "1px solid #cfd8dc",
              }}
            >
              읽기 전용 · 수정·삭제 불가
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#455a64", lineHeight: 1.55 }}>
            프로젝트 참여자는 역할과 관계없이 동일한 이력을 열람합니다. 아래는 시간순(오래된 것부터) 타임라인입니다.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginLeft: "auto", alignItems: "center" }}>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={() => void copyAllTimeline()}
              disabled={!allTimelineText}
              title="요약·상세 JSON을 순서대로 모두 복사합니다."
              style={{
                padding: "6px 12px",
                border: "1px solid #1976d2",
                borderRadius: 6,
                background: "#fff",
                color: "#1565c0",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              전체 이력 복사
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 12px",
              border: "1px solid #90a4ae",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            닫기
          </button>
        </div>
      </div>

      <p style={{ margin: "0 0 14px 0", fontSize: 14, color: "#37474f" }}>
        <strong>선택 Task:</strong> {taskName || taskId}
      </p>

      <div
        style={{
          fontSize: 12,
          color: "#607d8b",
          marginBottom: 12,
          padding: "8px 10px",
          background: "#fff",
          borderRadius: 8,
          border: "1px dashed #b0bec5",
        }}
      >
        <strong style={{ color: "#455a64" }}>복사 안내:</strong> 각 항목에서「JSON만 복사」는 상세 데이터만,「항목 전체 복사」는
        시간·이벤트·요약·JSON을 묶어 복사합니다. 상세 영역은 텍스트를 드래그해 선택할 수도 있습니다.
      </div>

      {copyHint ? (
        <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#1565c0", fontWeight: 500 }}>{copyHint}</p>
      ) : null}
      {errorMessage ? (
        <p style={{ margin: "0 0 10px 0", color: "#b00020", fontSize: 14 }}>{errorMessage}</p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, color: "#546e7a" }}>이력을 불러오는 중...</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, color: "#546e7a" }}>저장된 이력이 없습니다.</p>
      ) : (
        <div style={{ position: "relative", paddingLeft: 22 }}>
          <div
            style={{
              position: "absolute",
              left: 7,
              top: 10,
              bottom: 10,
              width: 2,
              background: "#b0bec5",
              borderRadius: 1,
            }}
            aria-hidden
          />
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 18 }}>
            {items.map((row) => {
              const badge = taskHistoryBadgeColors(row.eventType);
              const expanded = expandedDetailIds.has(row.id);
              const detail = detailText(row.detailJson);
              const showDetail = hasDetail(row.detailJson);

              return (
                <li key={row.id} style={{ position: "relative", paddingLeft: 18 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: -15,
                      top: 14,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#fff",
                      border: `3px solid ${badge.border}`,
                      boxSizing: "border-box",
                    }}
                    aria-hidden
                  />
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #cfd8dc",
                      borderRadius: 10,
                      padding: "12px 14px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, rowGap: 6 }}>
                      <time
                        dateTime={row.createdAt}
                        style={{
                          fontSize: 12,
                          fontFamily: "ui-monospace, monospace",
                          color: "#607d8b",
                          fontWeight: 600,
                        }}
                      >
                        {formatTestedAt(row.createdAt)}
                      </time>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                        title={row.eventType}
                      >
                        {taskHistoryEventLabel(row.eventType)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#78909c",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "#f5f5f5",
                          border: "1px solid #e0e0e0",
                        }}
                      >
                        {taskHistoryActorLabel(row.actorType, row.actorId)}
                      </span>
                      <code
                        style={{
                          fontSize: 10,
                          color: "#90a4ae",
                          marginLeft: "auto",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {row.eventType}
                      </code>
                    </div>
                    {row.summary ? (
                      <p style={{ margin: "10px 0 0 0", fontSize: 14, lineHeight: 1.5, color: "#263238" }}>
                        {row.summary}
                      </p>
                    ) : null}

                    {showDetail ? (
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => toggleDetail(row.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 0",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#1565c0",
                            fontWeight: 600,
                          }}
                          aria-expanded={expanded}
                        >
                          <span aria-hidden>{expanded ? "▼" : "▶"}</span>
                          상세 JSON {expanded ? "숨기기" : "보기"}
                        </button>
                        {expanded ? (
                          <pre
                            style={{
                              marginTop: 8,
                              maxHeight: 240,
                              overflow: "auto",
                              background: "#fafafa",
                              border: "1px solid #e0e0e0",
                              borderRadius: 8,
                              padding: 10,
                              fontSize: 12,
                              lineHeight: 1.45,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              userSelect: "text",
                              fontFamily: "ui-monospace, Consolas, monospace",
                            }}
                          >
                            {detail || "—"}
                          </pre>
                        ) : null}
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() =>
                              void copyText("JSON만", detail || row.eventType)
                            }
                            style={{
                              padding: "5px 10px",
                              border: "1px solid #90a4ae",
                              borderRadius: 6,
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            JSON만 복사
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyText("항목 전체", rowFullText(row))}
                            style={{
                              padding: "5px 10px",
                              border: "1px solid #1976d2",
                              borderRadius: 6,
                              background: "#e3f2fd",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#0d47a1",
                            }}
                          >
                            항목 전체 복사
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#90a4ae" }}>저장된 상세(JSON) 없음</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
