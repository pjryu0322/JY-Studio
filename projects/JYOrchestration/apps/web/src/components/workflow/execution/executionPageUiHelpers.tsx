import type { ExecutionPrimaryActionKey, ExecutionProgressRow, ExecutionTone } from "@/lib/workflow/executionViewState";
import type { ExecutionPageContentActions } from "./executionPageTypes";

export function inlineKpi(label: string, value: string, tone: "neutral" | "good" | "warn" | "bad" = "neutral") {
  const color =
    tone === "good" ? "#166534" : tone === "warn" ? "#b45309" : tone === "bad" ? "#b91c1c" : "#111827";
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

export function dispatchPrimaryExecutionAction(key: ExecutionPrimaryActionKey, pageActions: ExecutionPageContentActions) {
  if (key === "openTasks") pageActions.openTasks();
  else if (key === "selectActiveInput") pageActions.selectActiveInput();
  else if (key === "prepareHandoffPrepared") pageActions.prepareHandoffPrepared();
  else if (key === "createExecutionRequestDraft") pageActions.createExecutionRequestDraft();
  else if (key === "approveExecutionDraft") pageActions.approveExecutionDraft();
  else if (key === "recordBusinessExecutionRequest") pageActions.recordBusinessExecutionRequest();
  else if (key === "approveBusinessExecution") pageActions.approveBusinessExecution();
  else if (key === "createBusinessExecutionPackage") pageActions.createBusinessExecutionPackage();
  else if (key === "prepareExecutorHandoffPayload") pageActions.prepareExecutorHandoffPayload();
  else if (key === "prepareExecutorIntakeContract") pageActions.prepareExecutorIntakeContract();
  else if (key === "prepareExecutorWorkOrder") pageActions.prepareExecutorWorkOrder();
  else if (key === "declareLaunchIntent") pageActions.declareLaunchIntent();
  else if (key === "prepareLaunchHandoffRecord") pageActions.prepareLaunchHandoffRecord();
  else if (key === "prepareExecutionBridge") pageActions.prepareExecutionBridge();
  else if (key === "prepareExecutorLaunchContract") pageActions.prepareExecutorLaunchContract();
  else if (key === "markExecutionTriggerIntent") pageActions.markExecutionTriggerIntent();
  else if (key === "prepareActualExecutionAdapter") pageActions.prepareActualExecutionAdapter();
  else if (key === "prepareActualLaunchCommand") pageActions.prepareActualLaunchCommand();
  else if (key === "startBusinessExecution") pageActions.startBusinessExecution();
  else if (key === "prepareExecutorIntegrationAdapter") pageActions.prepareExecutorIntegrationAdapter();
  else if (key === "runExecutorConnector") pageActions.runExecutorConnector();
  else if (key === "retryExecutorConnector") pageActions.retryExecutorConnector();
}

export function progressRowView(row: ExecutionProgressRow) {
  const color =
    row.tone === "good" ? "#166534" : row.tone === "warn" ? "#b45309" : row.tone === "bad" ? "#b91c1c" : "#111827";
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "10px 12px",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{row.title}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color }}>{row.statusLabel}</div>
      {row.detail ? <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{row.detail}</div> : null}
    </div>
  );
}

export function toneOrNeutral(tone: ExecutionTone | undefined): ExecutionTone {
  return tone ?? "neutral";
}
