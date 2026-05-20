"use client";

import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import type { RequirementsServiceFlowActorV1, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  actorStatusDisplayLabel,
  assignmentDraftFromStep,
  isActorCandidate,
  normalizeActorStatus,
  type ServiceFlowAssignmentEditDraft,
} from "@/lib/requirements/serviceFlowActorAssignment";

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
  width: "min(440px, 100vw)",
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

function actorOptionLabel(actor: RequirementsServiceFlowActorV1): string {
  return `${actor.name} (${actorStatusDisplayLabel(normalizeActorStatus(actor))})`;
}

export function ServiceFlowActorAssignmentDrawer({
  open,
  flow,
  stepId,
  busy,
  onClose,
  onSave,
}: {
  readonly open: boolean;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly stepId: string | null;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onSave: (draft: ServiceFlowAssignmentEditDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<ServiceFlowAssignmentEditDraft | null>(null);
  const [replaceWarn, setReplaceWarn] = useState(false);

  const step = useMemo(() => {
    if (!flow || !stepId) return null;
    return (flow.steps ?? []).find((s) => s.id === stepId) ?? null;
  }, [flow, stepId]);

  const actors = flow?.actors ?? [];

  useEffect(() => {
    if (!open || !flow || !stepId) {
      setDraft(null);
      setReplaceWarn(false);
      return;
    }
    setDraft(assignmentDraftFromStep(flow, stepId));
    setReplaceWarn(false);
  }, [open, flow, stepId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !flow || !step || !draft) return null;

  const saving = Boolean(busy);
  const primaryChanged = draft.primaryActorId !== step.primaryActorId;
  const needsReplaceConfirm = primaryChanged && Boolean(step.primaryActorId) && !draft.replacePrimaryConfirmed;

  const linkedCandidates = actors.filter(
    (a) =>
      isActorCandidate(a) &&
      (step.secondaryActorIds.includes(a.id) || step.primaryActorId === a.id),
  );

  const secondaryChoices = actors.filter(
    (a) => a.id !== draft.primaryActorId && normalizeActorStatus(a) !== "obsolete",
  );

  const trySave = () => {
    if (needsReplaceConfirm) {
      setReplaceWarn(true);
      return;
    }
    void onSave(draft);
  };

  return (
    <>
      <div style={backdropStyle} role="presentation" onClick={onClose} />
      <aside style={panelStyle} aria-label="담당 배정 관리">
        <header style={{ padding: "16px 18px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>담당 배정 관리</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {step.order}. {step.title}
          </div>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <label>
            <div style={labelStyle}>주 담당 (primaryActorId)</div>
            <select
              style={inputStyle}
              disabled={saving}
              value={draft.primaryActorId}
              onChange={(e) => {
                const next = e.target.value;
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        primaryActorId: next,
                        secondaryActorIds: d.secondaryActorIds.filter((id) => id !== next),
                        replacePrimaryConfirmed: false,
                      }
                    : d,
                );
                setReplaceWarn(false);
              }}
            >
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {actorOptionLabel(a)}
                </option>
              ))}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
              주 담당 지정 시 해당 액터는 자동으로 확정(confirmed) 승격됩니다.
            </p>
          </label>

          {needsReplaceConfirm || replaceWarn ? (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                fontSize: 12,
                color: "#92400e",
              }}
            >
              기존 주 담당을 교체합니다. 「교체 확인」 후 저장해 주세요.
              <button
                type="button"
                disabled={saving}
                style={{ display: "block", marginTop: 8, fontWeight: 700, cursor: "pointer" }}
                onClick={() => {
                  setDraft((d) => (d ? { ...d, replacePrimaryConfirmed: true } : d));
                  setReplaceWarn(false);
                }}
              >
                교체 확인
              </button>
            </div>
          ) : null}

          <SecondaryActorPicker
            saving={saving}
            secondaryChoices={secondaryChoices}
            draft={draft}
            setDraft={setDraft}
          />

          {linkedCandidates.length > 0 ? (
            <CandidateConfirmList
              saving={saving}
              linkedCandidates={linkedCandidates}
              draft={draft}
              setDraft={setDraft}
            />
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
          <button type="button" disabled={saving || needsReplaceConfirm} style={primaryBtn} onClick={trySave}>
            {saving ? "저장 중…" : "담당 저장"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function SecondaryActorPicker({
  saving,
  secondaryChoices,
  draft,
  setDraft,
}: {
  readonly saving: boolean;
  readonly secondaryChoices: readonly RequirementsServiceFlowActorV1[];
  readonly draft: ServiceFlowAssignmentEditDraft;
  readonly setDraft: Dispatch<SetStateAction<ServiceFlowAssignmentEditDraft | null>>;
}) {
  return (
    <div>
      <div style={labelStyle}>보조 담당 (secondaryActorIds)</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {secondaryChoices.map((a) => (
          <li key={a.id}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: saving ? "default" : "pointer" }}>
              <input
                type="checkbox"
                checked={draft.secondaryActorIds.includes(a.id)}
                disabled={saving}
                onChange={() => {
                  setDraft((d) => {
                    if (!d) return d;
                    const set = new Set(d.secondaryActorIds);
                    if (set.has(a.id)) set.delete(a.id);
                    else set.add(a.id);
                    return { ...d, secondaryActorIds: [...set] };
                  });
                }}
              />
              {actorOptionLabel(a)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CandidateConfirmList({
  saving,
  linkedCandidates,
  draft,
  setDraft,
}: {
  readonly saving: boolean;
  readonly linkedCandidates: readonly RequirementsServiceFlowActorV1[];
  readonly draft: ServiceFlowAssignmentEditDraft;
  readonly setDraft: Dispatch<SetStateAction<ServiceFlowAssignmentEditDraft | null>>;
}) {
  return (
    <div>
      <div style={labelStyle}>후보 담당 승인</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {linkedCandidates.map((a) => (
          <li key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13 }}>{a.name}</span>
            <button
              type="button"
              disabled={saving || draft.confirmActorIds.includes(a.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #a7f3d0",
                background: "#ecfdf5",
                fontSize: 12,
                fontWeight: 700,
                cursor: saving ? "default" : "pointer",
              }}
              onClick={() =>
                setDraft((d) =>
                  d && !d.confirmActorIds.includes(a.id)
                    ? { ...d, confirmActorIds: [...d.confirmActorIds, a.id] }
                    : d,
                )
              }
            >
              {draft.confirmActorIds.includes(a.id) ? "승인 예정" : "확정하기"}
            </button>
          </li>
        ))}
      </ul>
    </div>
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
