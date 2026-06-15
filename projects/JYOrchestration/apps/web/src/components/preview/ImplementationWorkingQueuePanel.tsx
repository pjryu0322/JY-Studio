"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  riskLevelLabelKo,
  workingQueueStatusLabelKo,
} from "@/lib/prototype/implementationWorkingQueueClassifier";
import { downloadWorkingQueueItemAssets } from "@/lib/prototype/implementationWorkingQueueItemDownload";
import {
  filterWorkingQueueItems,
  shouldShowWorkingQueueCardTitle,
  sortWorkingQueueItemsForDisplay,
  workingQueueItemRequestText,
} from "@/lib/prototype/implementationWorkingQueuePanelDisplay";
import { workingQueueItemWorkflowLabel } from "@/lib/prototype/implementationWorkingQueueRoleLabels";
import type {
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueStatus,
  ImplementationWorkingQueueV1,
} from "@/lib/prototype/implementationWorkingQueueTypes";

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 18px",
  borderBottom: "1px solid #e2e8f0",
  background: "#fff",
};

const filterRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  flex: 1,
  minWidth: 0,
};

const fieldStyle: CSSProperties = {
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  minHeight: 36,
};

const listWrap: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const card: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
};

const metaLine: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 6,
  lineHeight: 1.45,
};

const actionRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const STATUS_FILTER_OPTIONS: readonly Readonly<{ readonly value: "all" | ImplementationWorkingQueueStatus; readonly label: string }>[] =
  [
    { value: "all", label: "상태: 전체" },
    { value: "pending", label: "승인 대기" },
    { value: "approved", label: "승인됨" },
    { value: "running", label: "진행 중" },
    { value: "completed", label: "완료" },
    { value: "deferred", label: "보류" },
    { value: "rejected", label: "거절" },
  ];

function actionButton(tone: "primary" | "muted" | "danger"): CSSProperties {
  const base: CSSProperties = {
    fontSize: 13,
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    cursor: "pointer",
    background: "#fff",
  };
  if (tone === "primary") {
    return { ...base, background: "#0f172a", color: "#fff", borderColor: "#0f172a" };
  }
  if (tone === "danger") {
    return { ...base, borderColor: "#fecaca", color: "#b91c1c" };
  }
  return base;
}

function WorkingQueueItemCard(props: {
  readonly item: ImplementationWorkingQueueItem;
  readonly previewImageUrl?: string | null;
  readonly onApprove: () => void;
  readonly onDefer: () => void;
  readonly onReject: () => void;
}): ReactNode {
  const pending = props.item.status === "pending";
  const previewSrc = props.previewImageUrl?.trim() || null;
  const requestText = workingQueueItemRequestText(props.item);
  const showTitle = shouldShowWorkingQueueCardTitle(props.item);

  return (
    <article style={card} data-testid={`working-queue-item-${props.item.id}`}>
      {showTitle ? (
        <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{props.item.title}</div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          marginTop: showTitle ? 8 : 0,
        }}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt="Preview 캡처 미리보기"
            data-testid="working-queue-item-preview-thumb"
            style={{
              width: 104,
              maxWidth: "32vw",
              height: 72,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              flexShrink: 0,
            }}
          />
        ) : null}
        <p
          style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, color: "#334155", lineHeight: 1.45 }}
          data-testid="working-queue-item-request"
        >
          요청: {requestText}
        </p>
      </div>
      <div style={metaLine} data-testid="working-queue-item-meta">
        <div>담당: {workingQueueItemWorkflowLabel(props.item)}</div>
        <div style={{ marginTop: 4 }}>
          위험도: {riskLevelLabelKo(props.item.riskLevel)} · 상태:{" "}
          {workingQueueStatusLabelKo(props.item.status)}
        </div>
      </div>
      <div style={actionRow}>
        <button
          type="button"
          data-testid="working-queue-item-download"
          style={actionButton("muted")}
          onClick={() => void downloadWorkingQueueItemAssets(props.item, previewSrc)}
        >
          다운로드
        </button>
        {pending ? (
          <>
            <button type="button" style={actionButton("primary")} onClick={props.onApprove}>
              승인
            </button>
            <button type="button" style={actionButton("muted")} onClick={props.onDefer}>
              보류
            </button>
            <button type="button" style={actionButton("danger")} onClick={props.onReject}>
              거절
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export function ImplementationWorkingQueuePanel(props: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly onClose: () => void;
  readonly onApproveItem: (itemId: string) => void;
  readonly onDeferItem: (itemId: string) => void;
  readonly onRejectItem: (itemId: string) => void;
  readonly resolvePreviewImageUrl?: (item: ImplementationWorkingQueueItem) => string | null;
}): ReactNode {
  const [statusFilter, setStatusFilter] = useState<"all" | ImplementationWorkingQueueStatus>("all");
  const [contentQuery, setContentQuery] = useState("");

  const sorted = useMemo(() => sortWorkingQueueItemsForDisplay(props.queue.items), [props.queue.items]);

  const filtered = useMemo(
    () => filterWorkingQueueItems(sorted, { status: statusFilter, contentQuery }),
    [sorted, statusFilter, contentQuery],
  );

  const downloadFiltered = () => {
    void (async () => {
      for (const item of filtered) {
        const previewImageUrl = props.resolvePreviewImageUrl?.(item) ?? null;
        await downloadWorkingQueueItemAssets(item, previewImageUrl);
        await new Promise((r) => window.setTimeout(r, 120));
      }
    })();
  };

  return (
    <>
      <header style={headerRow}>
        <div style={filterRow} data-testid="working-queue-list-filters">
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#64748b" }}>
            상태
            <select
              data-testid="working-queue-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{ ...fieldStyle, minWidth: 120 }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 11,
              color: "#64748b",
              flex: 1,
              minWidth: 160,
            }}
          >
            보완요청 내용
            <input
              type="search"
              data-testid="working-queue-filter-content"
              value={contentQuery}
              onChange={(e) => setContentQuery(e.target.value)}
              placeholder="내용 검색"
              style={{ ...fieldStyle, width: "100%" }}
            />
          </label>
          <button
            type="button"
            data-testid="working-queue-download-filtered"
            style={{ ...actionButton("muted"), marginTop: 18 }}
            disabled={filtered.length === 0}
            onClick={downloadFiltered}
          >
            조회 결과 다운로드 ({filtered.length})
          </button>
        </div>
        <button
          type="button"
          aria-label="작업대기 닫기"
          onClick={props.onClose}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            color: "#64748b",
            padding: 4,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </header>
      <div style={listWrap} data-testid="implementation-working-queue-panel">
        {props.queue.items.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            등록된 작업대기 항목이 없습니다. SingleChat에서 보완요청을 입력해 주세요.
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }} data-testid="working-queue-empty-filter">
            조건에 맞는 보완요청이 없습니다.
          </p>
        ) : (
          filtered.map((item) => (
            <WorkingQueueItemCard
              key={item.id}
              item={item}
              previewImageUrl={props.resolvePreviewImageUrl?.(item) ?? null}
              onApprove={() => props.onApproveItem(item.id)}
              onDefer={() => props.onDeferItem(item.id)}
              onReject={() => props.onRejectItem(item.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
