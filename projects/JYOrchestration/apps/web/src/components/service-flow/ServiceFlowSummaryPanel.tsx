"use client";

import type { RequirementsServiceFlowActorV1, RequirementsServiceFlowStepV1 } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsServiceFlowChecklistDeferralKind } from "@/lib/requirements/requirementsStateJson";
import {
  SERVICE_FLOW_STAGE_SLOT_LABELS,
  type ServiceFlowDecisionResolution,
  type ServiceFlowStageApprovalState,
  type ServiceFlowStageSlotKey,
} from "@/components/service-flow/serviceFlowStageDerived";
import { serviceFlowChipRowStyle, serviceFlowPanelCardStyle, serviceFlowListMutedLabelStyle } from "@/components/service-flow/serviceFlowStageLayout";
import { Button } from "@/components/ui/Button";
import { uiTokens as t } from "@/components/ui/tokens";

export function ServiceFlowSummaryPanel({
  actors,
  steps,
  derivedApproval,
  decision,
  hint,
  onPatchDeferral,
}: {
  readonly actors: readonly RequirementsServiceFlowActorV1[];
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly derivedApproval: ServiceFlowStageApprovalState;
  readonly decision: ServiceFlowDecisionResolution;
  readonly hint: string | null;
  readonly onPatchDeferral: (key: ServiceFlowStageSlotKey, kind: RequirementsServiceFlowChecklistDeferralKind | null) => void;
}) {
  const actorName = (id: string) => actors.find((a) => a.id === id)?.name ?? id;

  const optionalDecisionQuickActions = (
    <div style={serviceFlowChipRowStyle}>
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.includes("approvalStep") ? (
        <Button size="sm" variant="secondary" onClick={() => onPatchDeferral("approvalStep", "pending")}>
          승인 단계 없음
        </Button>
      ) : null}
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.includes("exceptionFlow") ? (
        <Button size="sm" variant="secondary" onClick={() => onPatchDeferral("exceptionFlow", "pending")}>
          예외 흐름 없음
        </Button>
      ) : null}
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.length ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            for (const k of decision.optionalUnresolved) onPatchDeferral(k, "deferred_next");
          }}
        >
          다음 단계에서 검토
        </Button>
      ) : null}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "grid", gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary }}>요약</div>
      <div style={serviceFlowPanelCardStyle}>
        <div style={{ ...serviceFlowListMutedLabelStyle, marginBottom: 8 }}>[액터]</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: t.textPrimary, lineHeight: 1.55 }}>
          {actors.map((a) => (
            <li key={a.id}>
              {a.name} ({a.kind === "human" ? "사람" : "시스템"})
            </li>
          ))}
        </ul>
      </div>
      <div style={serviceFlowPanelCardStyle}>
        <div style={{ ...serviceFlowListMutedLabelStyle, marginBottom: 8 }}>[서비스 흐름 {steps.length}단계]</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: t.textPrimary, lineHeight: 1.55 }}>
          {steps.map((s) => (
            <li key={s.id}>
              {s.order}. {s.title}
            </li>
          ))}
        </ol>
      </div>
      <div style={serviceFlowPanelCardStyle}>
        <div style={{ ...serviceFlowListMutedLabelStyle, marginBottom: 8 }}>[담당자]</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: t.textPrimary, lineHeight: 1.55 }}>
          {steps.map((s) => (
            <li key={s.id}>
              {s.title} → {s.primaryActorId ? actorName(s.primaryActorId) : "미지정"}
            </li>
          ))}
        </ul>
      </div>
      <div style={serviceFlowPanelCardStyle}>
        <div style={{ ...serviceFlowListMutedLabelStyle, marginBottom: 8 }}>[준비 상태]</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: derivedApproval.ready ? t.accentTealFg : t.warning }}>
          {derivedApproval.ready ? "필수 체크리스트 충족" : hint ?? "보완이 필요합니다"}
        </div>
      </div>
      <div style={serviceFlowPanelCardStyle}>
        <div style={{ ...serviceFlowListMutedLabelStyle, marginBottom: 8 }}>[결정사항]</div>
        {decision.requiredUnresolved.length === 0 && decision.optionalUnresolved.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textMuted }}>남은 결정사항 없음</div>
        ) : decision.requiredUnresolved.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textMuted }}>
            {decision.helperLine ?? "남은 결정사항 0개 (권장 항목 미정)"}
            <div style={{ marginTop: 10 }}>{optionalDecisionQuickActions}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary, marginBottom: 8 }}>남은 결정사항은 다음과 같습니다.</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: t.textPrimary, lineHeight: 1.55 }}>
              {decision.requiredUnresolved.map((k) => (
                <li key={k}>{SERVICE_FLOW_STAGE_SLOT_LABELS[k]}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
