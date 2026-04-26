"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PROTOTYPE_TEMPLATES,
  recommendPrototypeTemplate,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";

type FlowStep = { title: string; owner?: string };
type Actor = { name: string; role?: string };

export function PrototypePreviewPanel({
  projectName,
  projectDescription,
  flowSteps,
  actors,
}: {
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly flowSteps?: Array<FlowStep>;
  readonly actors?: Array<Actor>;
}) {
  const text = `${String(projectName ?? "").trim()} ${String(projectDescription ?? "").trim()}`.trim();
  const rec = useMemo(() => recommendPrototypeTemplate(text), [text]);

  const [templateId, setTemplateId] = useState<PrototypeTemplateType>(rec.templateId);
  const [device, setDevice] = useState<"web" | "mobile">("web");

  useEffect(() => {
    const t = window.setTimeout(() => setTemplateId(rec.templateId), 0);
    return () => window.clearTimeout(t);
  }, [rec.templateId]);

  const template = useMemo(
    () => PROTOTYPE_TEMPLATES.find((t) => t.id === templateId) ?? PROTOTYPE_TEMPLATES[0],
    [templateId]
  );

  const safeActors = useMemo(() => (Array.isArray(actors) ? actors : []).slice(0, 6), [actors]);
  const safeSteps = useMemo(() => (Array.isArray(flowSteps) ? flowSteps : []).slice(0, 10), [flowSteps]);

  const readinessMessage = useMemo(() => {
    const issues: string[] = [];
    if (safeSteps.length < 3) issues.push("서비스 흐름 3단계 이상");
    if (safeActors.length < 2) issues.push("주요 액터 2개 이상");
    if (safeSteps.some((s) => !String(s.owner ?? "").trim())) issues.push("각 단계 담당 지정");
    if (!issues.length) return null;
    return `프로토타입 미리보기를 더 정확히 생성하려면 ${issues.join(", ")}이 필요합니다.`;
  }, [safeSteps, safeActors]);

  const frameWidth = device === "mobile" ? 360 : 760;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {readinessMessage ? (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#92400e", lineHeight: 1.45 }}>{readinessMessage}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 900, borderRadius: 999, padding: "6px 10px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af" }}>
          추천 템플릿: {PROTOTYPE_TEMPLATES.find((t) => t.id === rec.templateId)?.nameKo ?? rec.templateId} ({rec.score}%)
        </span>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
          템플릿
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value as PrototypeTemplateType)} style={selectStyle}>
            {PROTOTYPE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameKo} · {t.nameEn}
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setDevice((d) => (d === "web" ? "mobile" : "web"))} style={btnStyle}>
            {device === "web" ? "Mobile" : "Web"} 보기
          </button>
          <button type="button" disabled style={{ ...btnStyle, opacity: 0.55, cursor: "not-allowed" }}>
            고도화 생성 (프로토타입 생성 단계에서 지원)
          </button>
        </div>
      </div>

      <div
        style={{
          width: frameWidth,
          maxWidth: "100%",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
        }}
      >
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {template.nameKo} · 미리보기
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: device === "mobile" ? "1fr" : "200px 1fr", minHeight: 420 }}>
          {device === "mobile" ? null : (
            <aside style={{ borderRight: "1px solid #e2e8f0", background: "#fbfdff", padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>메뉴</div>
              <div style={{ display: "grid", gap: 6 }}>
                {template.navigationItems.map((it) => (
                  <div key={it} style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "8px 10px", fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                    {it}
                  </div>
                ))}
              </div>
            </aside>
          )}
          <main style={{ padding: 12, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>요약 카드</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {template.summaryCards.map((c) => (
                  <div key={c} style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>{c}</div>
                    <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>—</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>핵심 섹션</div>
              <div style={{ display: "grid", gap: 10 }}>
                {template.primarySections.map((s) => (
                  <div key={s} style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#f8fafc", padding: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{s}</div>
                    <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>{template.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>사용자 흐름 요약</div>
              <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                {safeSteps.slice(0, 6).map((s, idx) => (
                  <div key={`${s.title}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, color: "#0f172a" }}>
                    <span style={{ fontWeight: 900, color: "#1e40af" }}>{idx + 1}</span>
                    <span style={{ fontWeight: 800 }}>{s.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>{s.owner ? `담당: ${s.owner}` : "담당 미정"}</span>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>

      {safeActors.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>액터</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {safeActors.map((a) => (
              <span key={a.name} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", padding: "6px 10px", fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                {a.name}{a.role ? ` · ${a.role}` : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12.5,
};

