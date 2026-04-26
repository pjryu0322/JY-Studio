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
  initialTemplateId,
}: {
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly flowSteps?: Array<FlowStep>;
  readonly actors?: Array<Actor>;
  readonly initialTemplateId?: PrototypeTemplateType;
}) {
  const inputText = `${String(projectName ?? "").trim()} ${String(projectDescription ?? "").trim()}`.trim();
  const rec = useMemo(() => recommendPrototypeTemplate(inputText), [inputText]);

  const [templateId, setTemplateId] = useState<PrototypeTemplateType>(initialTemplateId ?? rec.templateId);
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setTemplateId(initialTemplateId ?? rec.templateId), 0);
    return () => window.clearTimeout(t);
  }, [initialTemplateId, rec.templateId]);

  const template = useMemo(
    () => PROTOTYPE_TEMPLATES.find((t) => t.id === templateId) ?? PROTOTYPE_TEMPLATES[0],
    [templateId]
  );

  const safeActors = useMemo(() => {
    const a = Array.isArray(actors) ? actors : [];
    if (a.length) return a.slice(0, 6);
    return [
      { name: "사용자", role: "요청/확인" },
      { name: "AI 기획자", role: "정리/추천" },
      { name: "시스템", role: "자동 처리" },
      { name: "관리자", role: "권한/승인" },
    ] satisfies Actor[];
  }, [actors]);

  const safeSteps = useMemo(() => {
    const s = Array.isArray(flowSteps) ? flowSteps : [];
    if (s.length) return s.slice(0, 10);
    return [
      { title: "아이디어 입력", owner: "사용자" },
      { title: "서비스 흐름 정의", owner: "AI 기획자" },
      { title: "화면 구조 확인", owner: "사용자" },
      { title: "기능 정리", owner: "AI 기획자" },
      { title: "프로토타입 생성", owner: "시스템" },
    ] satisfies FlowStep[];
  }, [flowSteps]);

  const readiness = useMemo(() => {
    const warnings: string[] = [];
    if ((safeSteps?.length ?? 0) < 3) warnings.push("서비스 흐름 단계가 3개 미만입니다.");
    if ((safeActors?.length ?? 0) < 2) warnings.push("액터가 2명 미만입니다.");
    const missingOwners = safeSteps.some((s) => !String(s.owner ?? "").trim());
    if (missingOwners) warnings.push("흐름 단계 담당자가 일부 비어 있습니다.");
    return warnings;
  }, [safeSteps, safeActors]);

  const shellWidth = device === "mobile" ? 360 : 860;

  return (
    <section
      aria-label="Mock Prototype Preview"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#fff",
        padding: 14,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Mock Prototype Preview</div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>
            실제 생성/배포 없이, 템플릿 기반으로 화면 구조를 미리 확인합니다.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              borderRadius: 999,
              padding: "6px 10px",
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1e40af",
            }}
          >
            추천: {PROTOTYPE_TEMPLATES.find((t) => t.id === rec.templateId)?.nameKo ?? rec.templateId} ({rec.score}%)
          </span>
          <button type="button" onClick={() => setDevice((d) => (d === "web" ? "mobile" : "web"))} style={btn}>
            {device === "web" ? "Mobile 보기" : "Web 보기"}
          </button>
        </div>
      </div>

      {readiness.length ? (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>준비도 안내</div>
          <ul style={{ margin: "8px 0 0 18px", padding: 0, color: "#92400e", fontSize: 12.5, lineHeight: 1.5 }}>
            {readiness.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>그래도 데모 데이터로 Preview는 계속 표시됩니다.</div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "#0f172a", fontWeight: 800 }}>
          템플릿
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as PrototypeTemplateType)}
            style={{ ...input, minWidth: 220 }}
          >
            {PROTOTYPE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameKo} · {t.nameEn}
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setToast("Mock Preview를 새로 고쳤습니다. (실제 생성은 후속 단계)");
              window.setTimeout(() => setToast(null), 2000);
            }}
            style={btn}
          >
            다시 생성
          </button>
          <button type="button" onClick={() => setToast("템플릿을 변경했습니다.")} style={btn}>
            템플릿 변경
          </button>
          <button type="button" disabled style={{ ...btn, opacity: 0.55, cursor: "not-allowed" }}>
            고도화 생성
          </button>
        </div>
      </div>

      {toast ? <div style={{ fontSize: 12, color: "#334155" }}>{toast}</div> : null}

      <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <div
          aria-label="Mock UI Shell"
          style={{
            width: shellWidth,
            maxWidth: "100%",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.10)",
            background: "#fff",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} />
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e" }} />
            <div style={{ marginLeft: 10, fontSize: 12.5, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {template.nameKo} · {String(projectName ?? "").trim() || "프로젝트"}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: device === "mobile" ? "1fr" : "220px 1fr", minHeight: 420 }}>
            {device === "mobile" ? null : (
              <aside style={{ borderRight: "1px solid #e2e8f0", padding: 12, background: "#fbfdff" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>Navigation</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {template.navigationItems.map((it) => (
                    <div key={it} style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                      {it}
                    </div>
                  ))}
                </div>
              </aside>
            )}
            <main style={{ padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>요약 카드</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  {template.summaryCards.map((c) => (
                    <div key={c} style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12, background: "#fff" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>{c}</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>—</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>주요 섹션</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {template.primarySections.map((s) => (
                    <div key={s} style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{s}</div>
                      <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>
                        {template.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>User flow (요약)</div>
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

        <div style={{ width: shellWidth, maxWidth: "100%", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>액터</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {safeActors.map((a) => (
              <span key={a.name} style={{ borderRadius: 999, border: "1px solid #cbd5e1", padding: "6px 10px", background: "#fff", fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                {a.name}{a.role ? ` · ${a.role}` : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12.5,
};

