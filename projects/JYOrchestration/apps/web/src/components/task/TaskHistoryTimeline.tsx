"use client";

import { useState } from "react";
import { formatTestedAt } from "@/components/project-spec/format";

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

export function TaskHistoryTimeline({
  taskId,
  taskName,
  items,
  loading,
  errorMessage,
  onClose,
}: TaskHistoryTimelineProps) {
  const [copyHint, setCopyHint] = useState<string | null>(null);

  if (!taskId) {
    return null;
  }

  async function copyDetail(row: TaskHistoryItem) {
    const text = [row.summary || row.eventType, "", detailText(row.detailJson)].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text || row.eventType);
      setCopyHint("복사했습니다.");
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("복사에 실패했습니다. 텍스트를 직접 선택해 주세요.");
      setTimeout(() => setCopyHint(null), 3000);
    }
  }

  return (
    <section
      style={{
        marginTop: 16,
        border: "1px solid #c5cae9",
        borderRadius: 12,
        padding: 16,
        background: "#fafbff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Task 감사 이력 (읽기 전용)</h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          닫기
        </button>
      </div>
      <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#555", lineHeight: 1.5 }}>
        이력은 감사 로그이며 수정·삭제할 수 없습니다. 프로젝트 참여자는 누구나 열람할 수 있습니다.
      </p>
      <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#333" }}>
        <strong>선택 Task:</strong> {taskName || taskId}
      </p>
      {copyHint ? (
        <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#1976d2" }}>{copyHint}</p>
      ) : null}
      {errorMessage ? (
        <p style={{ margin: "0 0 8px 0", color: "#b00020", fontSize: 14 }}>{errorMessage}</p>
      ) : null}
      {loading ? (
        <p style={{ margin: 0, color: "#555" }}>이력을 불러오는 중...</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, color: "#555" }}>저장된 이력이 없습니다.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 12 }}>
          {items.map((row) => (
            <li key={row.id} style={{ borderLeft: "3px solid #90caf9", paddingLeft: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#666" }}>{formatTestedAt(row.createdAt)}</p>
              <p style={{ margin: "4px 0 0 0", fontWeight: 600 }}>
                {row.eventType}
                <span style={{ fontWeight: 400, color: "#555", marginLeft: 8 }}>
                  ({row.actorType}
                  {row.actorId ? ` / ${row.actorId}` : ""})
                </span>
              </p>
              {row.summary ? (
                <p style={{ margin: "4px 0 0 0", fontSize: 14 }}>{row.summary}</p>
              ) : null}
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <details style={{ flex: "1 1 280px", minWidth: 0 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13 }}>detailJson</summary>
                  <pre
                    style={{
                      marginTop: 6,
                      maxHeight: 220,
                      overflow: "auto",
                      background: "#fff",
                      border: "1px solid #e0e0e0",
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      userSelect: "text",
                    }}
                  >
                    {detailText(row.detailJson) || "—"}
                  </pre>
                </details>
                <button
                  type="button"
                  onClick={() => void copyDetail(row)}
                  style={{
                    padding: "4px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    alignSelf: "flex-start",
                  }}
                >
                  복사
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
