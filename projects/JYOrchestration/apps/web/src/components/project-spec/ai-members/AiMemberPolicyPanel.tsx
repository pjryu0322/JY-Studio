"use client";

import type { AiMemberRoleKey } from "@/lib/ai-member/aiMemberRoleDefinitions";
import { AI_MEMBER_ROLE_DEFINITIONS, AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL } from "@/lib/ai-member/aiMemberRoleDefinitions";

function JsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre
      style={{
        margin: "6px 0 0 0",
        padding: 8,
        borderRadius: 8,
        background: "#0f172a",
        color: "#e2e8f0",
        fontSize: 10,
        overflow: "auto",
        maxHeight: 160,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function AiMemberPolicyPanel(props: { roleKey: AiMemberRoleKey }) {
  const d = AI_MEMBER_ROLE_DEFINITIONS[props.roleKey];
  return (
    <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.55 }}>
      <div style={{ fontWeight: 800, marginBottom: 6, color: "#1e1b4b" }}>역할 경계</div>
      <ul style={{ margin: "0 0 10px 16px", padding: 0 }}>
        {d.roleBoundary.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>정규화 입력(예시)</div>
      <JsonBlock value={d.normalizedInputExample as Record<string, unknown>} />
      <div style={{ fontWeight: 800, margin: "10px 0 4px" }}>정규화 출력(예시)</div>
      <JsonBlock value={d.normalizedOutputExample as Record<string, unknown>} />
      <div style={{ fontWeight: 800, margin: "10px 0 4px" }}>판단 기준</div>
      <ul style={{ margin: "0 0 8px 16px", padding: 0 }}>
        {d.judgmentCriteria.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div>
        <span style={{ color: "#64748b" }}>Provider / 기본 모델:</span>{" "}
        <strong>
          {d.provider} / {AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL}
        </strong>
      </div>
    </div>
  );
}
