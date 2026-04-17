"use client";

import { useCallback, useState } from "react";
import { PlatformUserSearchCombobox, type PlatformUserRow } from "@/components/requirements/PlatformUserSearchCombobox";

export type PendingHumanInvite = { kind: "human"; user: PlatformUserRow; role: "EDITOR" | "REVIEWER" | "VIEWER" };
export type PendingAiInvite = {
  kind: "ai";
  displayName: string;
  role: "EDITOR" | "REVIEWER";
  aiOrchestrationRole: string;
  orchestrationStage: string;
};

export type PendingProjectInvite = PendingHumanInvite | PendingAiInvite;

const DEFAULT_AI: PendingAiInvite = {
  kind: "ai",
  displayName: "AI 기획자",
  role: "EDITOR",
  aiOrchestrationRole: "planner",
  orchestrationStage: "spec",
};

export function ProjectCreateMemberPicker({
  disabled,
  pending,
  onChangePending,
}: {
  readonly disabled?: boolean;
  readonly pending: readonly PendingProjectInvite[];
  readonly onChangePending: (next: PendingProjectInvite[]) => void;
}) {
  const [role, setRole] = useState<"EDITOR" | "REVIEWER" | "VIEWER">("EDITOR");

  const addHuman = useCallback(
    (u: PlatformUserRow) => {
      if (pending.some((p) => p.kind === "human" && p.user.id === u.id)) return;
      onChangePending([...pending, { kind: "human", user: u, role }]);
    },
    [pending, onChangePending, role]
  );

  const addDefaultAi = useCallback(() => {
    if (pending.some((p) => p.kind === "ai" && p.displayName === DEFAULT_AI.displayName)) return;
    onChangePending([...pending, DEFAULT_AI]);
  }, [pending, onChangePending]);

  const removeAt = useCallback(
    (idx: number) => {
      const next = pending.filter((_, i) => i !== idx);
      onChangePending(next);
    },
    [pending, onChangePending]
  );

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px dashed #cbd5e1", background: "#fafafa" }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>멤버 (선택)</div>
      <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        생성 직후 선택한 사람·AI 멤버를 프로젝트에 자동으로 붙입니다.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: "#475569" }}>
          사람 역할{" "}
          <select value={role} disabled={disabled} onChange={(e) => setRole(e.target.value as typeof role)} style={{ marginLeft: 6 }}>
            <option value="EDITOR">편집자</option>
            <option value="REVIEWER">검토</option>
            <option value="VIEWER">조회</option>
          </select>
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={addDefaultAi}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #a78bfa",
            background: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          + AI 기획자
        </button>
      </div>
      <PlatformUserSearchCombobox disabled={disabled} onPick={addHuman} />
      {pending.length > 0 ? (
        <ul style={{ margin: "10px 0 0 0", paddingLeft: 18, fontSize: 12 }}>
          {pending.map((p, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {p.kind === "human" ? (
                <span>
                  사람 · {p.user.name} ({p.user.email}) · {p.role}
                </span>
              ) : (
                <span>
                  AI · {p.displayName} ({p.aiOrchestrationRole}/{p.orchestrationStage})
                </span>
              )}
              <button type="button" disabled={disabled} onClick={() => removeAt(i)} style={{ marginLeft: 8, border: 0, background: "none", color: "#b91c1c", cursor: "pointer", textDecoration: "underline" }}>
                제거
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
