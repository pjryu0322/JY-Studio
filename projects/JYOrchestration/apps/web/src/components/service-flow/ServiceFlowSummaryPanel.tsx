"use client";

import type { RequirementsServiceFlowActorV1, RequirementsServiceFlowStepV1 } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsServiceFlowChecklistDeferralKind } from "@/lib/requirements/requirementsStateJson";
import {
  SERVICE_FLOW_STAGE_SLOT_LABELS,
  type ServiceFlowDecisionResolution,
  type ServiceFlowStageApprovalState,
  type ServiceFlowStageSlotKey,
} from "@/components/service-flow/serviceFlowStageDerived";
import { serviceFlowStageBtnStyle } from "@/components/service-flow/serviceFlowStageUi";

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.includes("approvalStep") ? (
        <button type="button" onClick={() => onPatchDeferral("approvalStep", "pending")} style={serviceFlowStageBtnStyle}>
          승인 단계 없음
        </button>
      ) : null}
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.includes("exceptionFlow") ? (
        <button type="button" onClick={() => onPatchDeferral("exceptionFlow", "pending")} style={serviceFlowStageBtnStyle}>
          예외 흐름 없음
        </button>
      ) : null}
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.length ? (
        <button
          type="button"
          onClick={() => {
            for (const k of decision.optionalUnresolved) onPatchDeferral(k, "deferred_next");
          }}
          style={serviceFlowStageBtnStyle}
        >
          다음 단계에서 검토
        </button>
      ) : null}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "grid", gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>요약</div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[액터]</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
          {actors.map((a) => (
            <li key={a.id}>
              {a.name} ({a.kind === "human" ? "사람" : "시스템"})
            </li>
          ))}
        </ul>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[서비스 흐름 {steps.length}단계]</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
          {steps.map((s) => (
            <li key={s.id}>
              {s.order}. {s.title}
            </li>
          ))}
        </ol>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[담당자]</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
          {steps.map((s) => (
            <li key={s.id}>
              {s.title} → {s.primaryActorId ? actorName(s.primaryActorId) : "미지정"}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[준비 상태]</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: derivedApproval.ready ? "#065f46" : "#b45309" }}>
          {derivedApproval.ready ? "필수 체크리스트 충족" : hint ?? "보완이 필요합니다"}
        </div>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[결정사항]</div>
        {decision.requiredUnresolved.length === 0 && decision.optionalUnresolved.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>남은 결정사항 없음</div>
        ) : decision.requiredUnresolved.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {decision.helperLine ?? "남은 결정사항 0개 (권장 항목 미정)"}
            <div style={{ marginTop: 10 }}>{optionalDecisionQuickActions}</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>남은 결정사항은 다음과 같습니다.</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
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
