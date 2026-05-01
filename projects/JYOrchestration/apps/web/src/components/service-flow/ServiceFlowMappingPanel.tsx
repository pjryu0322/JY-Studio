"use client";

import type { RequirementsServiceFlowActorV1, RequirementsServiceFlowStepV1 } from "@/lib/requirements/requirementsStateJson";
import {
  serviceFlowCautionCalloutStyle,
  serviceFlowChipRowStyle,
  serviceFlowInfoHeaderPanelStyle,
  serviceFlowPanelCardStyle,
  serviceFlowListMutedLabelStyle,
} from "@/components/service-flow/serviceFlowStageLayout";
import { Button } from "@/components/ui/Button";
import { uiTokens as t } from "@/components/ui/tokens";

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
        <div style={serviceFlowCautionCalloutStyle}>
          <div style={{ fontSize: 13, fontWeight: 900, color: t.textCautionStrong, lineHeight: 1.55 }}>
            구조를 확정한 뒤 단계별 담당을 한 화면에서 지정합니다. 먼저 채팅에서 흐름을 다듬은 뒤 상단 탭으로 이동해 주세요.
          </div>
        </div>
      ) : (
        <>
          <div style={serviceFlowInfoHeaderPanelStyle}>
            <div style={{ fontSize: 14, fontWeight: 900, color: t.textPrimary }}>구조 편집 · 담당 지정</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
              단계별 주 담당을 선택하면 초안에 바로 반영됩니다. 하단에서 한 번에 확정할 수 있습니다.
            </div>
            <div style={{ ...serviceFlowChipRowStyle, marginTop: 10 }}>
              <Button size="sm" variant="secondary" onClick={onReapplyRecommended}>
                추천 다시 적용
              </Button>
            </div>
          </div>
          {steps.map((step) => {
            const badge = step.approved
              ? { t: "확정됨", bg: t.accentTealSurface, fg: t.accentTealFg, bd: "#bbf7d0" }
              : !step.primaryActorId
                ? { t: "미지정", bg: "#fef9c3", fg: "#854d0e", bd: "#fde047" }
                : { t: "검토 필요", bg: "#fff7ed", fg: "#9a3412", bd: "#fed7aa" };
            return (
              <div key={step.id} style={serviceFlowPanelCardStyle}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: t.textPrimary }}>
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
                <div style={{ marginTop: 6, fontSize: 12.5, color: t.textMuted, lineHeight: 1.45 }}>{step.purpose}</div>
                <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: t.textSecondary }}>
                  현재 담당: {step.primaryActorId ? actorName(step.primaryActorId) : "—"}
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <label htmlFor={`jyo-sf-primary-${step.id}`} style={serviceFlowListMutedLabelStyle}>
                    주 담당 변경
                  </label>
                  <select
                    id={`jyo-sf-primary-${step.id}`}
                    value={step.primaryActorId}
                    onChange={(e) => onUpdateStepPrimary(step.id, e.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: t.radiusLg,
                      border: `1px solid ${t.borderStrong}`,
                      fontWeight: 800,
                      color: t.textPrimary,
                      background: t.bgCard,
                    }}
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
