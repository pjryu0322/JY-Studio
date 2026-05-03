"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type {
  FeaturePlanningSlotItemV1,
  FeaturePlanningSlotType,
  FeaturePlanningSlotV1,
  FeaturePlanningSlotsArtifactV1,
} from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { isLegacyRolePlanningSlot, orderedSlotsForFeaturePlanningUi } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import { uiTokens as t } from "@/components/ui/tokens";

type ItemEditPatch = Partial<Pick<FeaturePlanningSlotItemV1, "name" | "description" | "roleTags">>;

const panelScroll: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "10px 10px 14px",
};

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly multiline?: boolean;
}) {
  const common = {
    width: "100%",
    boxSizing: "border-box" as const,
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    fontFamily: "inherit",
  };
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>{label}</div>
      {multiline ? (
        <textarea {...common} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function CoreSlotView({
  slot,
  onChangeItem,
}: {
  readonly slot: FeaturePlanningSlotV1;
  readonly onChangeItem: (itemId: string, patch: ItemEditPatch) => void;
}) {
  return (
    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: t.textPrimary, lineHeight: 1.55 }}>
      {slot.items.map((it) => (
        <li key={it.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>{it.name}</div>
          {it.roleTags?.length ? (
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>역할: {it.roleTags.join(", ")}</div>
          ) : null}
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, whiteSpace: "pre-wrap" }}>{it.description}</div>
          <div style={{ marginTop: 6 }}>
            <Field label="이름 수정" value={it.name} onChange={(v) => onChangeItem(it.id, { name: v })} />
            <Field
              label="역할 태그(쉼표 구분)"
              value={it.roleTags?.join(", ") ?? ""}
              onChange={(v) =>
                onChangeItem(it.id, {
                  roleTags: v
                    .split(/[,，]/)
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 6),
                })
              }
            />
            <Field label="설명 수정" value={it.description} onChange={(v) => onChangeItem(it.id, { description: v })} multiline />
          </div>
        </li>
      ))}
    </ol>
  );
}

function GenericSlotView({
  slot,
  onChangeItem,
}: {
  readonly slot: FeaturePlanningSlotV1;
  readonly onChangeItem: (itemId: string, patch: ItemEditPatch) => void;
}) {
  return (
    <div>
      {slot.items.map((it) => (
        <div
          key={it.id}
          style={{
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 10,
            background: t.bgPage,
          }}
        >
          <Field label="이름" value={it.name} onChange={(v) => onChangeItem(it.id, { name: v })} />
          <Field
            label="역할 태그(쉼표 구분)"
            value={it.roleTags?.join(", ") ?? ""}
            onChange={(v) =>
              onChangeItem(it.id, {
                roleTags: v
                  .split(/[,，]/)
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              })
            }
          />
          <Field label="설명" value={it.description} onChange={(v) => onChangeItem(it.id, { description: v })} multiline />
        </div>
      ))}
    </div>
  );
}

function FlowSlotView(props: Parameters<typeof GenericSlotView>[0]) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: t.textSecondary,
          marginBottom: 10,
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px dashed ${t.border}`,
          background: "#f8fafc",
        }}
      >
        화면 이동·단계 흐름을 항목으로 정리했습니다. 추후 그래프 뷰를 연결할 수 있습니다.
      </div>
      <GenericSlotView {...props} />
    </div>
  );
}

function TaskSlotView(props: Parameters<typeof GenericSlotView>[0]) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 8 }}>프로토타입 Task 초안</div>
      <GenericSlotView {...props} />
    </div>
  );
}

function DataSlotView(props: Parameters<typeof GenericSlotView>[0]) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", color: t.textMuted, fontSize: 10, fontWeight: 800 }}>
            <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>필드/항목</th>
            <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>설명</th>
          </tr>
        </thead>
        <tbody>
          {props.slot.items.map((it) => (
            <tr key={it.id}>
              <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, verticalAlign: "top", minWidth: 120 }}>
                <input
                  style={{ ...{ width: "100%", fontSize: 12, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 6px" } }}
                  value={it.name}
                  onChange={(e) => props.onChangeItem(it.id, { name: e.target.value })}
                />
              </td>
              <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, verticalAlign: "top" }}>
                <textarea
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: `1px solid ${t.border}`,
                    borderRadius: 6,
                    padding: "4px 6px",
                    minHeight: 48,
                    fontFamily: "inherit",
                  }}
                  value={it.description}
                  onChange={(e) => props.onChangeItem(it.id, { description: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuthSlotView(props: Parameters<typeof GenericSlotView>[0]) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", color: t.textMuted, fontSize: 10, fontWeight: 800 }}>
            <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>대상</th>
            <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>권한·노출</th>
          </tr>
        </thead>
        <tbody>
          {props.slot.items.map((it) => (
            <tr key={it.id}>
              <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, verticalAlign: "top", minWidth: 120 }}>
                <input
                  style={{ ...{ width: "100%", fontSize: 12, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 6px" } }}
                  value={it.name}
                  onChange={(e) => props.onChangeItem(it.id, { name: e.target.value })}
                />
              </td>
              <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, verticalAlign: "top" }}>
                <textarea
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: `1px solid ${t.border}`,
                    borderRadius: 6,
                    padding: "4px 6px",
                    minHeight: 48,
                    fontFamily: "inherit",
                  }}
                  value={it.description}
                  onChange={(e) => props.onChangeItem(it.id, { description: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UISlotView(props: Parameters<typeof GenericSlotView>[0]) {
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
      {props.slot.items.map((it) => (
        <div
          key={it.id}
          style={{
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: "10px 10px",
            background: t.bgPage,
            minHeight: 96,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <input
            style={{
              fontSize: 12,
              fontWeight: 800,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              padding: "4px 6px",
            }}
            value={it.name}
            onChange={(e) => props.onChangeItem(it.id, { name: e.target.value })}
          />
          <textarea
            style={{
              flex: 1,
              fontSize: 11,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              padding: "4px 6px",
              minHeight: 56,
              fontFamily: "inherit",
              resize: "vertical",
            }}
            value={it.description}
            onChange={(e) => props.onChangeItem(it.id, { description: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function SlotTypePanel({
  slot,
  onChangeItem,
}: {
  readonly slot: FeaturePlanningSlotV1;
  readonly onChangeItem: (itemId: string, patch: ItemEditPatch) => void;
}) {
  const st = slot.slotType as FeaturePlanningSlotType;
  const p = { slot, onChangeItem };
  switch (st) {
    case "CORE":
      return <CoreSlotView {...p} />;
    case "FLOW":
      return <FlowSlotView {...p} />;
    case "TASK":
      return <TaskSlotView {...p} />;
    case "DATA":
      return <DataSlotView {...p} />;
    case "AUTH":
      return <AuthSlotView {...p} />;
    case "UI":
      return <UISlotView {...p} />;
    case "DOMAIN":
    case "CUSTOM":
    default:
      return <GenericSlotView {...p} />;
  }
}

export function FeaturePlanningSlotsPanel({
  artifact,
  activeSlotId,
  onActiveSlotChange,
  onChangeItem,
  generating,
  saving,
  onRegenerateClick,
}: {
  readonly artifact: FeaturePlanningSlotsArtifactV1 | null;
  readonly activeSlotId: string;
  readonly onActiveSlotChange: (slotId: string) => void;
  readonly onChangeItem: (slotId: string, itemId: string, patch: ItemEditPatch) => void;
  readonly generating: boolean;
  readonly saving: boolean;
  readonly onRegenerateClick: () => void;
}) {
  const ordered = useMemo(() => (artifact ? orderedSlotsForFeaturePlanningUi(artifact) : []), [artifact]);
  const active = ordered.find((s) => s.slotId === activeSlotId) ?? ordered[0] ?? null;
  const [showSources, setShowSources] = useState(false);
  const showRolePriorStepNote = useMemo(
    () =>
      Boolean(
        artifact?.slots.some((s) => isLegacyRolePlanningSlot(s)) ||
          (artifact?.priorStepActorRoles && artifact.priorStepActorRoles.length > 0)
      ),
    [artifact]
  );

  if (generating && !artifact) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: t.textSecondary }}>
        기능 정리 초안을 준비하는 중입니다…
      </div>
    );
  }

  if (!artifact || ordered.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: t.textSecondary }}>
        {generating ? "초안을 다시 준비하는 중입니다…" : "표시할 내용이 없습니다. 잠시 후 다시 시도하거나 ‘초안 다시 만들기’를 눌러 주세요."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderBottom: `1px solid ${t.border}`,
          background: "#fff",
        }}
      >
        <button
          type="button"
          onClick={onRegenerateClick}
          disabled={generating}
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 800,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "#fff",
            cursor: generating ? "wait" : "pointer",
          }}
        >
          초안 다시 만들기
        </button>
        {saving ? <span style={{ fontSize: 10, color: t.textMuted }}>저장 중…</span> : null}
      </div>

      <div style={panelScroll}>
        {showRolePriorStepNote ? (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: "#f0fdf4",
              fontSize: 12,
              color: t.textSecondary,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: t.textPrimary }}>사용자 역할 정보는 이전 단계 결과를 참조합니다.</strong>
            {artifact?.priorStepActorRoles?.length ? (
              <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
                확정 역할: {artifact.priorStepActorRoles.join(", ")}
              </div>
            ) : null}
          </div>
        ) : null}
        <p style={{ margin: "0 0 10px", fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
          대화에서 확정되는 <strong>기능 카테고리</strong>와 동일한 순서의 정리 영역입니다. 항목을 누르면 아래에서 세부 항목을 편집할 수 있습니다.
        </p>
        <ol style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 13, color: t.textPrimary, lineHeight: 1.65 }}>
          {ordered.map((s, idx) => {
            const on = s.slotId === activeSlotId;
            return (
              <li key={s.slotId} style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => onActiveSlotChange(s.slotId)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    fontWeight: on ? 900 : 700,
                    color: on ? t.accentTealFg : t.textPrimary,
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  {idx + 1}. {s.slotName}
                </button>
                {s.slotDescription ? (
                  <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, whiteSpace: "pre-wrap" }}>{s.slotDescription}</div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {active ? (
          <div style={{ paddingTop: 10 }}>
            {active.slotDescription ? (
              <div
                style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  marginBottom: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: `1px solid ${t.border}`,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                <span style={{ fontWeight: 800, color: t.textPrimary }}>영역 설명</span>
                <div style={{ marginTop: 4 }}>{active.slotDescription}</div>
              </div>
            ) : null}
            <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 800, color: t.textPrimary }}>{active.slotType}</span>
              {active.reason ? <span> · {active.reason}</span> : null}
            </div>
            {active.sourceRefs.length ? (
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowSources((v) => !v)}
                  style={{ fontSize: 10, fontWeight: 800, border: "none", background: "transparent", color: t.accentTealFg, cursor: "pointer", padding: 0 }}
                >
                  생성 근거 (sourceRefs) {showSources ? "접기" : "펼치기"}
                </button>
                {showSources ? (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 11, color: t.textSecondary }}>
                    {active.sourceRefs.map((r, i) => (
                      <li key={`${r.sourceId}-${i}`}>
                        <strong>{r.sourceType}</strong> {r.sourceId ? `(${r.sourceId})` : ""}: {r.summary}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <SlotTypePanel slot={active} onChangeItem={(itemId, patch) => onChangeItem(active.slotId, itemId, patch)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
