"use client";

import { useCallback, useState, type CSSProperties } from "react";
import type { SampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";
import { parseSampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";

export function FeaturePlanningSampleDataSpecSection({
  spec,
  onSave,
}: {
  readonly spec: SampleDataSpecV1 | null | undefined;
  readonly onSave?: (next: SampleDataSpecV1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftPurpose, setDraftPurpose] = useState("");

  const startEdit = useCallback(() => {
    setDraftPurpose(spec?.purpose ?? "");
    setEditing(true);
  }, [spec?.purpose]);

  const cancelEdit = useCallback(() => setEditing(false), []);

  const savePurpose = useCallback(() => {
    if (!spec || !onSave) return;
    const next = { ...spec, purpose: draftPurpose.trim().slice(0, 4000) || spec.purpose };
    onSave(next);
    setEditing(false);
  }, [draftPurpose, onSave, spec]);

  if (!spec) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
        Preview 샘플데이터 기준이 아직 없습니다. 기능 정리 저장 시 자동 생성됩니다.
      </p>
    );
  }

  return (
    <section style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>샘플데이터 기준</h4>
        {onSave && !editing ? (
          <button type="button" onClick={startEdit} style={linkBtnStyle}>
            목적 수정
          </button>
        ) : null}
      </div>
      {editing ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={draftPurpose}
            onChange={(e) => setDraftPurpose(e.target.value)}
            rows={3}
            style={textareaStyle}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={savePurpose} style={primaryBtnStyle}>
              저장
            </button>
            <button type="button" onClick={cancelEdit} style={linkBtnStyle}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "#334155" }}>{spec.purpose}</p>
      )}
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.5, color: "#475569" }}>
        {spec.entities.map((e) => (
          <li key={e.key}>
            {e.name}: 최소 {e.minimumCount}건 ({e.requiredFields.slice(0, 5).join(", ")})
          </li>
        ))}
        {spec.requiredStatuses.length ? (
          <li>필수 상태: {spec.requiredStatuses.map((s) => s.label).join(" · ")}</li>
        ) : null}
        {spec.requiredScenarios.length ? (
          <li>시나리오: {spec.requiredScenarios.map((s) => s.name).join(" · ")}</li>
        ) : null}
        {spec.previewValidationCriteria.slice(0, 4).map((c, i) => (
          <li key={`pv-${i}`}>Preview: {c}</li>
        ))}
      </ul>
    </section>
  );
}

/** JSON 편집(고급) — parse 검증용 */
export function parseSampleDataSpecDraftJson(raw: string): SampleDataSpecV1 | null {
  try {
    return parseSampleDataSpecV1(JSON.parse(raw));
  } catch {
    return null;
  }
}

const linkBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
};

const primaryBtnStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 13,
  lineHeight: 1.5,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  padding: 8,
};
