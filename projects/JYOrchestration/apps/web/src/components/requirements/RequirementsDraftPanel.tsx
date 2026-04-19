"use client";

import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";

function joinLines(xs: readonly string[]): string {
  return xs.join("\n");
}
function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function RequirementsDraftPanel({
  draft,
  onChange,
  onClose,
}: {
  readonly draft: RequirementsDraftDoc;
  readonly onChange: (next: RequirementsDraftDoc) => void;
  readonly onClose: () => void;
}) {
  return (
    <section style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, color: "#0f172a" }}>
          정리 초안 v{draft.version} · {draft.status}
        </div>
        <button type="button" onClick={onClose} style={{ border: 0, background: "none", color: "#2563eb", fontWeight: 800, cursor: "pointer" }}>
          닫기
        </button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>프로젝트 개요</span>
          <textarea
            value={draft.overview}
            onChange={(e) => onChange({ ...draft, overview: e.target.value })}
            style={{ width: "100%", minHeight: 64, resize: "vertical", borderRadius: 10, border: "1px solid #e5e7eb", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>대상 사용자(줄바꿈=항목)</span>
          <textarea
            value={joinLines(draft.users)}
            onChange={(e) => onChange({ ...draft, users: splitLines(e.target.value) })}
            style={{ width: "100%", minHeight: 72, resize: "vertical", borderRadius: 10, border: "1px solid #e5e7eb", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>핵심 기능(줄바꿈=항목)</span>
          <textarea
            value={joinLines(draft.features)}
            onChange={(e) => onChange({ ...draft, features: splitLines(e.target.value) })}
            style={{ width: "100%", minHeight: 86, resize: "vertical", borderRadius: 10, border: "1px solid #e5e7eb", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>비기능 요건(줄바꿈=항목)</span>
          <textarea
            value={joinLines(draft.nonFunctional)}
            onChange={(e) => onChange({ ...draft, nonFunctional: splitLines(e.target.value) })}
            style={{ width: "100%", minHeight: 72, resize: "vertical", borderRadius: 10, border: "1px solid #e5e7eb", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>성공 기준(줄바꿈=항목)</span>
          <textarea
            value={joinLines(draft.successCriteria)}
            onChange={(e) => onChange({ ...draft, successCriteria: splitLines(e.target.value) })}
            style={{ width: "100%", minHeight: 72, resize: "vertical", borderRadius: 10, border: "1px solid #e5e7eb", padding: "8px 10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>미결정 이슈(줄바꿈=항목)</span>
          <textarea
            value={joinLines(draft.openIssues)}
            onChange={(e) => onChange({ ...draft, openIssues: splitLines(e.target.value) })}
            style={{ width: "100%", minHeight: 72, resize: "vertical", borderRadius: 10, border: "1px solid #e5e7eb", padding: "8px 10px" }}
          />
        </label>
      </div>
    </section>
  );
}

