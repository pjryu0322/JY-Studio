"use client";

import type { RequirementsServiceFlowActorV1, RequirementsServiceFlowStepV1 } from "@/lib/requirements/requirementsStateJson";
import { serviceFlowStageBtnStyle } from "@/components/service-flow/serviceFlowStageUi";

export function ServiceFlowMappingPanel({
  structureLocked,
  steps,
  actors,
  onReapplyRecommended,
  onUpdateStepPrimary,
}: {
  readonly structureLocked: boolean;
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly actors: readonly RequirementsServiceFlowActorV1[];
  readonly onReapplyRecommended: () => void;
  readonly onUpdateStepPrimary: (stepId: string, primaryActorId: string) => void;
}) {
  const actorName = (id: string) => actors.find((a) => a.id === id)?.name ?? id;

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", width: "100%", display: "grid", gap: 12 }}>
      {!structureLocked ? (
        <div style={{ border: "1px solid #fde68a", borderRadius: 14, padding: 12, background: "#fffbeb" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e", lineHeight: 1.55 }}>
            구조를 확정한 뒤 단계별 담당을 한 화면에서 지정합니다. 먼저 채팅에서 흐름을 다듬은 뒤 상단 탭으로 이동해 주세요.
          </div>
        </div>
      ) : (
        <>
          <div style={{ border: "1px solid #bfdbfe", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>구조 편집 · 담당 지정</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
              단계별 주 담당을 선택하면 초안에 바로 반영됩니다. 하단에서 한 번에 확정할 수 있습니다.
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={onReapplyRecommended} style={{ ...serviceFlowStageBtnStyle }}>
                추천 다시 적용
              </button>
            </div>
          </div>
          {steps.map((step) => {
            const badge = step.approved
              ? { t: "확정됨", bg: "#ecfdf5", fg: "#065f46", bd: "#bbf7d0" }
              : !step.primaryActorId
                ? { t: "미지정", bg: "#fef9c3", fg: "#854d0e", bd: "#fde047" }
                : { t: "검토 필요", bg: "#fff7ed", fg: "#9a3412", bd: "#fed7aa" };
            return (
              <div key={step.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
                    {step.order}. {step.title}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: badge.bg,
                      color: badge.fg,
                      border: `1px solid ${badge.bd}`,
                    }}
                  >
                    {badge.t}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>{step.purpose}</div>
                <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: "#475569" }}>
                  현재 담당: {step.primaryActorId ? actorName(step.primaryActorId) : "—"}
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <label htmlFor={`jyo-sf-primary-${step.id}`} style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                    주 담당 변경
                  </label>
                  <select
                    id={`jyo-sf-primary-${step.id}`}
                    value={step.primaryActorId}
                    onChange={(e) => onUpdateStepPrimary(step.id, e.target.value)}
                    style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", fontWeight: 800 }}
                  >
                    <option value="">선택</option>
                    {actors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
