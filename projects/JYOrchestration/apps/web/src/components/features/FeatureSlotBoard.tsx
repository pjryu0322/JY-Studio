"use client";

import { Button } from "@/components/ui/Button";
import type { FeatureWorkspaceItemV1, FeatureWorkspaceStageV1 } from "@/lib/requirements/requirementsStateJson";

const priLabel = (p: number) => (p <= 1 ? "높음" : p >= 3 ? "낮음" : "보통");

function statusColor(st: string | null | undefined): string {
  if (st === "APPROVED") return "#15803d";
  if (st === "REVIEWING") return "#b45309";
  return "#475569";
}

export function FeatureSlotBoard({
  stages,
  selectedStageKey,
  onSelectStage,
  onPatchItem,
  onRemoveItem,
  onAddItem,
  onCycleStatus,
  onCyclePriority,
}: {
  readonly stages: readonly FeatureWorkspaceStageV1[];
  readonly selectedStageKey: string | null;
  readonly onSelectStage: (key: string) => void;
  readonly onPatchItem: (stageKey: string, itemId: string, title: string, detail: string) => void;
  readonly onRemoveItem: (stageKey: string, itemId: string) => void;
  readonly onAddItem: (stageKey: string) => void;
  readonly onCycleStatus: (stageKey: string, itemId: string) => void;
  readonly onCyclePriority: (stageKey: string, itemId: string) => void;
}) {
  const stage = stages.find((s) => s.stageKey === selectedStageKey) ?? stages[0] ?? null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        flex: 1,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
        overflow: "hidden",
      }}
      aria-label="기능 슬롯 보드"
    >
      <div
        style={{
          flexShrink: 0,
          padding: "10px 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        {stages.map((s) => {
          const on = s.stageKey === (selectedStageKey ?? stages[0]?.stageKey);
          return (
            <button
              key={s.stageKey}
              type="button"
              onClick={() => onSelectStage(s.stageKey)}
              style={{
                borderRadius: 999,
                border: on ? "1px solid #0f766e" : "1px solid #cbd5e1",
                background: on ? "#ecfdf5" : "#fff",
                color: "#0f172a",
                fontSize: 11.5,
                fontWeight: 800,
                padding: "5px 10px",
                cursor: "pointer",
                maxWidth: "100%",
              }}
              title={s.title}
            >
              {s.title.length > 18 ? `${s.title.slice(0, 17)}…` : s.title}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 12px 16px" }}>
        {!stage ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>단계가 없습니다.</div>
        ) : (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{stage.title}</div>
              {stage.actorMappings?.length ? (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>관련 액터: {stage.actorMappings.join(", ")}</div>
              ) : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stage.features.map((f) => (
                <FeatureItemCard
                  key={f.id}
                  stageKey={stage.stageKey}
                  item={f}
                  onPatchItem={onPatchItem}
                  onRemoveItem={onRemoveItem}
                  onCycleStatus={onCycleStatus}
                  onCyclePriority={onCyclePriority}
                />
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <Button size="sm" variant="secondary" type="button" onClick={() => onAddItem(stage.stageKey)}>
                기능 추가
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeatureItemCard({
  stageKey,
  item,
  onPatchItem,
  onRemoveItem,
  onCycleStatus,
  onCyclePriority,
}: {
  stageKey: string;
  item: FeatureWorkspaceItemV1;
  readonly onPatchItem: (stageKey: string, itemId: string, title: string, detail: string) => void;
  readonly onRemoveItem: (stageKey: string, itemId: string) => void;
  readonly onCycleStatus: (stageKey: string, itemId: string) => void;
  readonly onCyclePriority: (stageKey: string, itemId: string) => void;
}) {
  const st = item.status ?? "DRAFT";
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        padding: "10px 12px",
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input
            value={item.title}
            onChange={(e) => onPatchItem(stageKey, item.id, e.target.value, item.detail ?? "")}
            style={{
              width: "100%",
              fontWeight: 900,
              fontSize: 13,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 8px",
              marginBottom: 6,
            }}
          />
          <textarea
            value={item.detail ?? ""}
            onChange={(e) => onPatchItem(stageKey, item.id, item.title, e.target.value)}
            placeholder="상세 설명"
            rows={2}
            style={{
              width: "100%",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 8px",
              resize: "vertical" as const,
              minHeight: 44,
            }}
          />
          {item.reason ? (
            <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>근거: {item.reason}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: statusColor(st) }}>{st}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>우선 {priLabel(item.priority)}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <Button size="sm" variant="ghost" type="button" onClick={() => onCyclePriority(stageKey, item.id)}>
          우선순위
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => onCycleStatus(stageKey, item.id)}>
          상태
        </Button>
        <Button size="sm" variant="danger" type="button" onClick={() => onRemoveItem(stageKey, item.id)}>
          삭제
        </Button>
      </div>
    </div>
  );
}
