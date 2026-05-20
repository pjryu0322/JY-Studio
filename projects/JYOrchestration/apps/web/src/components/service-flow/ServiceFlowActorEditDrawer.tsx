"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { RequirementsServiceFlowStepV1 } from "@/lib/requirements/requirementsStateJson";
import {
  emptyActorEditDraft,
  type ActorEditingPhase,
  type ServiceFlowActorEditDraft,
  type ServiceFlowActorType,
} from "@/lib/requirements/serviceFlowActorEditing";

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1180,
  background: "rgba(15, 23, 42, 0.4)",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  zIndex: 1190,
  width: "min(420px, 100vw)",
  height: "100%",
  background: "#fff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
  display: "flex",
  flexDirection: "column",
};

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 4 };
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 14,
};

export function ServiceFlowActorEditDrawer({
  open,
  phase,
  steps,
  busy,
  onClose,
  onSave,
}: {
  readonly open: boolean;
  readonly phase: ActorEditingPhase;
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSave: (draft: ServiceFlowActorEditDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<ServiceFlowActorEditDraft>(emptyActorEditDraft);

  useEffect(() => {
    if (open) setDraft(emptyActorEditDraft());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const saving = busy || phase === "SAVE_PENDING" || phase === "RECOMPUTE";

  return (
    <>
      <div style={backdropStyle} role="presentation" onClick={onClose} />
      <aside style={panelStyle} aria-label="액터 추가">
        <header style={{ padding: "16px 18px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>액터 추가</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            후보(candidate) 액터를 저장하면 서비스 흐름·오케스트레이션이 갱신됩니다.
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>상태: {phase}</div>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label>
            <div style={labelStyle}>액터명 *</div>
            <input
              style={inputStyle}
              value={draft.name}
              disabled={saving}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="예: 검토자"
            />
          </label>
          <label>
            <div style={labelStyle}>종류</div>
            <select
              style={inputStyle}
              value={draft.actorType}
              disabled={saving}
              onChange={(e) =>
                setDraft((d) => ({ ...d, actorType: e.target.value as ServiceFlowActorType }))
              }
            >
              <option value="human">사람</option>
              <option value="system">시스템</option>
              <option value="ai">AI</option>
              <option value="external">외부</option>
            </select>
          </label>
          <label>
            <div style={labelStyle}>역할</div>
            <input
              style={inputStyle}
              value={draft.role}
              disabled={saving}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              placeholder="예: 승인·검토"
            />
          </label>
          <label>
            <div style={labelStyle}>설명</div>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              value={draft.description}
              disabled={saving}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>
          <label>
            <div style={labelStyle}>자동/수동</div>
            <select
              style={inputStyle}
              value={draft.automation}
              disabled={saving}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  automation: e.target.value === "auto" ? "auto" : "manual",
                }))
              }
            >
              <option value="manual">수동</option>
              <option value="auto">자동</option>
            </select>
          </label>
          {steps.length > 0 ? (
            <div>
              <div style={labelStyle}>관련 단계</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {[...steps]
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <li key={s.id}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={draft.relatedStepIds.includes(s.id)}
                          disabled={saving}
                          onChange={() => {
                            setDraft((d) => {
                              const set = new Set(d.relatedStepIds);
                              if (set.has(s.id)) set.delete(s.id);
                              else set.add(s.id);
                              return { ...d, relatedStepIds: [...set] };
                            });
                          }}
                        />
                        {s.title}
                      </label>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
        <footer
          style={{
            padding: "12px 18px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button type="button" onClick={onClose} disabled={saving} style={secondaryBtn}>
            취소
          </button>
          <button
            type="button"
            disabled={saving || !draft.name.trim()}
            style={primaryBtn}
            onClick={() => void onSave(draft)}
          >
            {saving ? "저장 중…" : "후보 액터 저장"}
          </button>
        </footer>
      </aside>
    </>
  );
}

const primaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0d9488",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  cursor: "pointer",
};
