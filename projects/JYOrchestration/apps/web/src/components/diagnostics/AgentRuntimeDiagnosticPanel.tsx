"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AgentRuntimeDiagnosticViewModel } from "@/lib/agents/agentRuntimeDiagnosticViewTypes";

const sectionStyle: CSSProperties = {
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 4,
};

const valueStyle: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  lineHeight: 1.5,
  wordBreak: "break-word",
};

function Field({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
  testId,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly testId: string;
}) {
  return (
    <section style={sectionStyle} data-testid={testId} aria-label={title}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#374151" }}>{title}</h3>
      {children}
    </section>
  );
}

export function AgentRuntimeDiagnosticPanel({
  viewModel,
}: {
  readonly viewModel: AgentRuntimeDiagnosticViewModel;
}) {
  const vm = viewModel;

  return (
    <div
      data-testid="agent-runtime-diagnostic-panel"
      role="region"
      aria-label={vm.title}
      style={{
        maxWidth: 720,
        padding: "4px 0 20px",
        fontFamily: "inherit",
      }}
    >
      <div
        role="note"
        data-testid="agent-runtime-diagnostic-banner"
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #93c5fd",
          background: "#eff6ff",
          fontSize: 13,
          color: "#1e3a8a",
          lineHeight: 1.55,
        }}
      >
        <strong>읽기 전용 · dry-run</strong>
        <span style={{ display: "block", marginTop: 6, fontWeight: 500 }}>
          실제 실행 없음 · 저장 없음 · Connector 호출 없음
        </span>
        <span style={{ display: "block", marginTop: 8, color: "#1e40af" }}>{vm.disclaimer}</span>
      </div>

      <h2 style={{ margin: "16px 0 4px", fontSize: 16, fontWeight: 700 }}>{vm.title}</h2>
      <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>mode: {vm.mode}</p>

      {vm.warnings.length > 0 ? (
        <div
          data-testid="agent-runtime-diagnostic-warnings"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            fontSize: 12,
            color: "#92400e",
          }}
        >
          <strong>경고</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {vm.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.harness ? (
        <Section title="Harness Plan (dry-run)" testId="agent-runtime-diagnostic-harness">
          <Field label="status" value={vm.harness.status} />
          <Field label="executable" value={String(vm.harness.executable)} />
          <Field label="agentId" value={vm.harness.agentId} />
          <Field label="agentType" value={vm.harness.agentType} />
          <Field label="capabilityId" value={vm.harness.capabilityId} />
          <Field label="reason" value={vm.harness.reason} />
          <Field
            label="requiredConnectors"
            value={
              vm.harness.requiredConnectors.length
                ? vm.harness.requiredConnectors.join(", ")
                : "(none)"
            }
          />
        </Section>
      ) : null}

      {vm.governance ? (
        <Section title="Governance Dry-run" testId="agent-runtime-diagnostic-governance">
          <Field label="status" value={vm.governance.status} />
          <Field
            label="requiredChecks"
            value={
              vm.governance.requiredChecks.length
                ? vm.governance.requiredChecks.join(", ")
                : "(none)"
            }
          />
          <Field
            label="evaluatedPolicyIds"
            value={
              vm.governance.evaluatedPolicyIds.length
                ? vm.governance.evaluatedPolicyIds.join(", ")
                : "(none)"
            }
          />
          <Field label="findingCount" value={String(vm.governance.findingCount)} />
          <Field label="warningCount" value={String(vm.governance.warningCount)} />
          <Field
            label="blockingCandidateCount"
            value={String(vm.governance.blockingCandidateCount)}
          />
        </Section>
      ) : null}

      {vm.persistenceDecision ? (
        <Section
          title="Persistence 적용 여부 (read-only 결정)"
          testId="agent-runtime-diagnostic-persistence-decision"
        >
          <Field label="decision" value={vm.persistenceDecision.decision} />
          <Field
            label="recommendedTargets"
            value={
              vm.persistenceDecision.recommendedTargets.length
                ? vm.persistenceDecision.recommendedTargets.join(", ")
                : "없음"
            }
          />
          <Field
            label="requiresSchemaChange"
            value={String(vm.persistenceDecision.requiresSchemaChange)}
          />
          <Field
            label="requiresMigration"
            value={String(vm.persistenceDecision.requiresMigration)}
          />
          <Field label="findingCount" value={String(vm.persistenceDecision.findingCount)} />
          <Field
            label="blockingFindingCount"
            value={String(vm.persistenceDecision.blockingFindingCount)}
          />
        </Section>
      ) : null}

      {vm.persistenceCandidate ? (
        <Section
          title="Persistence Candidate Preview (저장 아님)"
          testId="agent-runtime-diagnostic-persistence"
        >
          <Field label="schemaVersion" value={vm.persistenceCandidate.schemaVersion} />
          <Field label="registryVersion" value={vm.persistenceCandidate.registryVersion} />
          <Field label="kind" value={vm.persistenceCandidate.kind} />
          <Field label="valid" value={String(vm.persistenceCandidate.valid)} />
          <Field label="jsonSize" value={String(vm.persistenceCandidate.jsonSize)} />
          {vm.persistenceCandidate.validationWarnings.length > 0 ? (
            <Field
              label="validationWarnings"
              value={vm.persistenceCandidate.validationWarnings.join(", ")}
            />
          ) : null}
        </Section>
      ) : null}

      {vm.passThrough ? (
        <Section
          title="Pass-through Boundary / Record (record-only)"
          testId="agent-runtime-diagnostic-pass-through"
        >
          <Field label="registeredBoundaries" value={String(vm.passThrough.boundaryCount)} />
          {vm.passThrough.records.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>표시할 record 후보 없음</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
              {vm.passThrough.records.map((row) => (
                <li
                  key={`${row.boundaryId}-${row.connectorId}`}
                  style={{
                    marginBottom: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  <Field label="boundaryId" value={row.boundaryId} />
                  <Field label="connectorId" value={row.connectorId} />
                  <Field label="operation" value={row.operation} />
                  <Field label="mode" value={row.mode} />
                  <Field label="recordOnly" value={String(row.recordOnly)} />
                  <Field label="allowed" value={row.allowed === undefined ? undefined : String(row.allowed)} />
                  <Field label="reason" value={row.reason} />
                  <Field label="source" value={row.source} />
                  <Field label="createdAt" value={row.createdAt} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}
