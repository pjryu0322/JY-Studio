"use client";

import { useEffect, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { RequirementsServiceFlowStepV1 } from "@/lib/requirements/requirementsStateJson";
import {
  applyFeatureDetailEditDraft,
  canConfirmFeatureDetailSlot,
  countFeatureDetailStructuredSections,
  featureDetailSlotToEditDraft,
  type FeatureDetailSlot,
  type FeatureDetailSlotEditDraft,
} from "@/lib/requirements/featureDetailSlots";

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  background: "rgba(15, 23, 42, 0.4)",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  zIndex: 1210,
  width: "min(460px, 100vw)",
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
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 72, resize: "vertical", fontFamily: "inherit" };

const primaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const secondaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const dangerBtn: CSSProperties = {
  ...secondaryBtn,
  color: "#b91c1c",
  borderColor: "#fecaca",
};

const STATUS_KO: Record<string, string> = {
  candidate: "후보",
  partial: "부분 확정",
  confirmed: "확정",
  obsolete: "폐기",
};

export function FeatureDetailEditDrawer({
  open,
  slot,
  steps,
  busy,
  confirmError,
  onClose,
  onPartialSave,
  onConfirm,
  onObsolete,
}: {
  readonly open: boolean;
  readonly slot: FeatureDetailSlot | null;
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly busy?: boolean;
  readonly confirmError?: string | null;
  readonly onClose: () => void;
  readonly onPartialSave: (draft: FeatureDetailSlotEditDraft) => void | Promise<void>;
  readonly onConfirm: (draft: FeatureDetailSlotEditDraft) => void | Promise<void>;
  readonly onObsolete: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<FeatureDetailSlotEditDraft>({
    title: "",
    description: "",
    inputData: "",
    processRules: "",
    outputData: "",
    exceptionCases: "",
    relatedActors: "",
    linkedStepId: "",
  });

  useEffect(() => {
    if (open && slot) setDraft(featureDetailSlotToEditDraft(slot));
  }, [open, slot]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !slot) return null;

  const preview = applyFeatureDetailEditDraft(slot, draft, new Date().toISOString());
  const sections = countFeatureDetailStructuredSections(preview);
  const confirmReady = canConfirmFeatureDetailSlot(preview);
  const saving = Boolean(busy);

  return (
    <>
      <DrawerBackdrop onClose={onClose} />
      <aside style={panelStyle} aria-label="기능 상세 편집">
        <header style={{ padding: "16px 18px", borderBottom: "1px solid #e2e8f0" }}>
          <DrawerHeader onClose={onClose} saving={saving} statusLabel={STATUS_KO[slot.status] ?? slot.status} sections={sections} />
        </header>
        <DrawerFormBody
          draft={draft}
          setDraft={setDraft}
          steps={steps}
          saving={saving}
          confirmError={confirmError}
          confirmReady={confirmReady}
        />
        <footer
          style={{
            padding: "12px 18px 18px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <button type="button" style={secondaryBtn} disabled={saving} onClick={() => void onPartialSave(draft)}>
            부분 저장
          </button>
          <button
            type="button"
            style={primaryBtn}
            disabled={saving || !confirmReady}
            onClick={() => void onConfirm(draft)}
          >
            기능 확정
          </button>
          <button type="button" style={dangerBtn} disabled={saving} onClick={() => void onObsolete()}>
            폐기
          </button>
        </footer>
      </aside>
    </>
  );
}

function DrawerBackdrop({ onClose }: { readonly onClose: () => void }) {
  return <div style={backdropStyle} role="presentation" onClick={onClose} />;
}

function DrawerHeader({
  onClose,
  saving,
  statusLabel,
  sections,
}: {
  readonly onClose: () => void;
  readonly saving: boolean;
  readonly statusLabel: string;
  readonly sections: number;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>기능 상세 편집</h2>
        <button type="button" onClick={onClose} style={secondaryBtn} disabled={saving}>
          닫기
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
        상태: {statusLabel} · 구조화 필드 {sections}/4
      </div>
    </>
  );
}

function DrawerFormBody({
  draft,
  setDraft,
  steps,
  saving,
  confirmError,
  confirmReady,
}: {
  readonly draft: FeatureDetailSlotEditDraft;
  readonly setDraft: Dispatch<SetStateAction<FeatureDetailSlotEditDraft>>;
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly saving: boolean;
  readonly confirmError?: string | null;
  readonly confirmReady: boolean;
}) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="기능명 *">
        <input
          style={inputStyle}
          value={draft.title}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
      </Field>
      <Field label="설명">
        <textarea
          style={textareaStyle}
          value={draft.description}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
      </Field>
      <Field label="연결 서비스 흐름 단계">
        <select
          style={inputStyle}
          value={draft.linkedStepId}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, linkedStepId: e.target.value }))}
        >
          {steps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="관련 액터 (쉼표 구분)">
        <input
          style={inputStyle}
          value={draft.relatedActors}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, relatedActors: e.target.value }))}
        />
      </Field>
      <Field label="입력 데이터 (줄바꿈으로 항목 구분)">
        <textarea
          style={textareaStyle}
          value={draft.inputData}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, inputData: e.target.value }))}
        />
      </Field>
      <Field label="처리 규칙">
        <textarea
          style={textareaStyle}
          value={draft.processRules}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, processRules: e.target.value }))}
        />
      </Field>
      <Field label="출력 결과">
        <textarea
          style={textareaStyle}
          value={draft.outputData}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, outputData: e.target.value }))}
        />
      </Field>
      <Field label="예외 상황">
        <textarea
          style={textareaStyle}
          value={draft.exceptionCases}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, exceptionCases: e.target.value }))}
        />
      </Field>
      {confirmError ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }} role="alert">
          {confirmError}
        </p>
      ) : null}
      {!confirmReady ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          확정하려면 입력·처리·출력·예외 중 2개 이상을 작성해 주세요.
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label>
      <div style={labelStyle}>{label}</div>
      {children}
    </label>
  );
}
