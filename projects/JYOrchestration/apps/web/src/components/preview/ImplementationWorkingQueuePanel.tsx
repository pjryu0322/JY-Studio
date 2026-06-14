"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  affectedAreaLabelKo,
  riskLevelLabelKo,
  workingQueueStatusLabelKo,
} from "@/lib/prototype/implementationWorkingQueueClassifier";
import type {
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueV1,
} from "@/lib/prototype/implementationWorkingQueueTypes";

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 18px",
  borderBottom: "1px solid #e2e8f0",
  background: "#fff",
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
  readonly onApprove: () => void;
  readonly onDefer: () => void;
  readonly onReject: () => void;
}): ReactNode {
  const pending = props.item.status === "pending";
  return (
    <article style={card} data-testid={`working-queue-item-${props.item.id}`}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{props.item.title}</div>
      {props.item.description !== props.item.title ? (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
          {props.item.description}
        </p>
      ) : null}
      <div style={metaLine}>
        영향 영역: {affectedAreaLabelKo(props.item.affectedArea)} · 위험도:{" "}
        {riskLevelLabelKo(props.item.riskLevel)} · 상태: {workingQueueStatusLabelKo(props.item.status)}
      </div>
      {pending ? (
        <div style={actionRow}>
          <button type="button" style={actionButton("primary")} onClick={props.onApprove}>
            승인
          </button>
          <button type="button" style={actionButton("muted")} onClick={props.onDefer}>
            보류
          </button>
          <button type="button" style={actionButton("danger")} onClick={props.onReject}>
            거절
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function ImplementationWorkingQueuePanel(props: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly onClose: () => void;
  readonly onApproveItem: (itemId: string) => void;
  readonly onDeferItem: (itemId: string) => void;
  readonly onRejectItem: (itemId: string) => void;
}): ReactNode {
  const items = props.queue.items;
  const sorted = [...items].sort((a, b) => {
    const order = (s: ImplementationWorkingQueueItem["status"]) => {
      if (s === "pending") return 0;
      if (s === "approved" || s === "running") return 1;
      if (s === "completed") return 2;
      return 3;
    };
    return order(a.status) - order(b.status) || b.updatedAt.localeCompare(a.updatedAt);
  });

  return (
    <>
      <header style={headerRow}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>작업대기</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
            보완요청을 승인하기 전까지 실행되지 않습니다.
          </p>
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
          }}
        >
          ×
        </button>
      </header>
      <div style={listWrap} data-testid="implementation-working-queue-panel">
        {sorted.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            등록된 작업대기 항목이 없습니다. SingleChat에서 보완요청을 입력해 주세요.
          </p>
        ) : (
          sorted.map((item) => (
            <WorkingQueueItemCard
              key={item.id}
              item={item}
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
