"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  PROTOTYPE_TEMPLATES,
  recommendPrototypeTemplateFromContext,
  type PrototypeTemplateType,
} from "@/lib/templates/prototypeTemplates";

export type PrototypePreviewFlowStep = Readonly<{
  id: string;
  title: string;
  purpose: string;
  primaryActorId: string;
  secondaryActorIds: readonly string[];
}>;

export type PrototypePreviewActor = Readonly<{
  id: string;
  name: string;
  kind: "human" | "system";
  description?: string | null;
}>;

type IdeationAsset = Readonly<{ type?: string; title?: string; content?: string }>;

function truncate(s: string, max: number): string {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function collectHumanActionChips(stepTitles: readonly string[]): string[] {
  const blob = stepTitles.join(" ");
  const chips: string[] = [];
  const push = (c: string) => {
    if (!chips.includes(c)) chips.push(c);
  };
  if (/업로드|파일|등록|제출/.test(blob)) push("업로드");
  if (/검토|확인|초안|열람/.test(blob)) push("검토");
  if (/승인|확정/.test(blob)) push("승인 필요");
  if (/수정|요청|반려|재작업/.test(blob)) push("수정 요청");
  if (/공유|배포|알림|전달/.test(blob)) push("공유 확인");
  if (/의견|댓글|피드백/.test(blob)) push("의견 남기기");
  if (!chips.length) push("단계 진행");
  return chips.slice(0, 6);
}

function collectSystemActionChips(stepTitles: readonly string[]): string[] {
  const blob = stepTitles.join(" ");
  const chips: string[] = [];
  const push = (c: string) => {
    if (!chips.includes(c)) chips.push(c);
  };
  if (/변환|텍스트|추출|STT|음성/.test(blob)) push("자동 변환");
  if (/화자|분리|분류/.test(blob)) push("화자 분리");
  if (/초안|생성|요약|작성/.test(blob)) push("초안 생성");
  if (/알림|공유|배포|전송/.test(blob)) push("알림 발송");
  if (!chips.length) push("자동 처리");
  return chips.slice(0, 6);
}

export function PrototypePreviewPanel({
  projectName,
  projectDescription,
  ideationAssets,
  flowSteps,
  actors,
}: {
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly ideationAssets?: ReadonlyArray<IdeationAsset>;
  readonly flowSteps?: ReadonlyArray<PrototypePreviewFlowStep>;
  readonly actors?: ReadonlyArray<PrototypePreviewActor>;
}) {
  const safeActors = useMemo(() => (Array.isArray(actors) ? actors : []).slice(0, 12), [actors]);
  const safeSteps = useMemo(() => (Array.isArray(flowSteps) ? flowSteps : []).slice(0, 24), [flowSteps]);

  const hasFlowData = safeActors.length > 0 && safeSteps.length > 0;

  const [pickedActorId, setPickedActorId] = useState<string | null>(null);
  const effectiveActorId =
    pickedActorId && safeActors.some((a) => a.id === pickedActorId) ? pickedActorId : (safeActors[0]?.id ?? null);

  const rec = useMemo(
    () =>
      recommendPrototypeTemplateFromContext({
        projectName,
        projectDescription,
        ideationAssets,
        flowStepTitles: safeSteps.map((s) => s.title),
        actorNames: safeActors.map((a) => a.name),
      }),
    [projectName, projectDescription, ideationAssets, safeSteps, safeActors],
  );

  const [templateId, setTemplateId] = useState<PrototypeTemplateType>(rec.templateId);
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [othersExpanded, setOthersExpanded] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setTemplateId(rec.templateId), 0);
    return () => window.clearTimeout(t);
  }, [rec.templateId]);

  const template = useMemo(
    () => PROTOTYPE_TEMPLATES.find((t) => t.id === templateId) ?? PROTOTYPE_TEMPLATES[0],
    [templateId],
  );

  const selectedActor = useMemo(
    () => safeActors.find((a) => a.id === effectiveActorId) ?? null,
    [safeActors, effectiveActorId],
  );

  const myPrimary = useMemo(() => {
    if (!selectedActor) return [];
    return safeSteps.filter((s) => s.primaryActorId === selectedActor.id);
  }, [safeSteps, selectedActor]);

  const mySecondaryOnly = useMemo(() => {
    if (!selectedActor) return [];
    return safeSteps.filter(
      (s) => s.primaryActorId !== selectedActor.id && s.secondaryActorIds.includes(selectedActor.id),
    );
  }, [safeSteps, selectedActor]);

  const otherSteps = useMemo(() => {
    if (!selectedActor) return [];
    return safeSteps.filter(
      (s) => s.primaryActorId !== selectedActor.id && !s.secondaryActorIds.includes(selectedActor.id),
    );
  }, [safeSteps, selectedActor]);

  const actorLabel = (id: string) => safeActors.find((a) => a.id === id)?.name ?? id;

  const humanChips = useMemo(
    () => collectHumanActionChips([...myPrimary, ...mySecondaryOnly].map((s) => s.title)),
    [myPrimary, mySecondaryOnly],
  );
  const systemChips = useMemo(() => collectSystemActionChips(myPrimary.map((s) => s.title)), [myPrimary]);

  const frameWidth = device === "mobile" ? 360 : 760;

  const screenTitle = useMemo(() => {
    if (!hasFlowData || !selectedActor) return template.nameKo;
    if (selectedActor.kind === "system") return `${selectedActor.name} · 자동 처리`;
    if (myPrimary[0]?.title) return `${selectedActor.name} · ${myPrimary[0].title}`;
    return `${selectedActor.name} 화면`;
  }, [hasFlowData, selectedActor, myPrimary, template.nameKo]);

  const assignedCount = myPrimary.length + mySecondaryOnly.length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!hasFlowData ? (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#92400e" }}>
            서비스 흐름이 아직 없어 예시 화면을 표시합니다.
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11.5,
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
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
          템플릿
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value as PrototypeTemplateType)} style={selectStyle}>
            {PROTOTYPE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameKo}
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setDevice((d) => (d === "web" ? "mobile" : "web"))} style={btnStyle}>
            {device === "web" ? "Mobile" : "Web"} 보기
          </button>
        </div>
      </div>

      {hasFlowData && safeActors.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 900, color: "#64748b" }}>액터</span>
          {safeActors.map((a) => {
            const on = a.id === effectiveActorId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setPickedActorId(a.id)}
                style={{
                  borderRadius: 999,
                  border: on ? "2px solid #1e40af" : "1px solid #cbd5e1",
                  background: on ? "#eff6ff" : "#fff",
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                {a.name}
                <span style={{ fontWeight: 600, color: "#64748b", marginLeft: 6 }}>{a.kind === "human" ? "사람" : "시스템"}</span>
              </button>
            );
          })}
        </div>
      ) : null}

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
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {truncate(String(projectName ?? "").trim() || "프로젝트", 40)} · {screenTitle}
          </div>
        </div>

        {!hasFlowData ? (
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>예시 흐름</div>
            <div style={{ display: "grid", gap: 8 }}>
              {["자료 등록", "자동 처리", "검토·승인", "공유"].map((label, i) => (
                <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#1e40af" }}>{i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : selectedActor ? (
          <div style={{ display: "grid", gridTemplateColumns: device === "mobile" ? "1fr" : "minmax(0, 200px) 1fr", minHeight: 380 }}>
            {device === "mobile" ? null : (
              <aside style={{ borderRight: "1px solid #e2e8f0", background: "#fbfdff", padding: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>전체 흐름</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {safeSteps.map((s, idx) => {
                    const mine = s.primaryActorId === selectedActor.id || s.secondaryActorIds.includes(selectedActor.id);
                    return (
                      <div
                        key={s.id}
                        style={{
                          border: mine ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                          borderRadius: 10,
                          background: mine ? "#eff6ff" : "#fff",
                          padding: "6px 8px",
                          fontSize: 12,
                          fontWeight: mine ? 900 : 700,
                          color: mine ? "#0f172a" : "#64748b",
                        }}
                      >
                        <span style={{ color: "#1e40af", marginRight: 6 }}>{idx + 1}</span>
                        {truncate(s.title, 80)}
                      </div>
                    );
                  })}
                </div>
              </aside>
            )}
            <main style={{ padding: 14, display: "grid", gap: 14 }}>
              <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{selectedActor.name}</div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{selectedActor.kind === "human" ? "사람" : "시스템"}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#1e40af" }}>담당 단계 {assignedCount}개</span>
                </div>
                {selectedActor.description ? (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>{truncate(selectedActor.description, 200)}</div>
                ) : null}
              </section>

              {selectedActor.kind === "system" ? (
                <section style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>자동 처리 상태</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {(myPrimary.length ? myPrimary : safeSteps).slice(0, 10).map((s, i) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 10,
                          background: i === 0 ? "#fffbeb" : "#f8fafc",
                        }}
                      >
                        <div style={{ fontSize: 11.5, fontWeight: 900, color: "#b45309", minWidth: 52 }}>대기</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{s.title}</div>
                          {s.purpose ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{truncate(s.purpose, 120)}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>내 담당 단계</div>
                  {myPrimary.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {myPrimary.map((s) => (
                        <div key={s.id} style={{ border: "1px solid #cbd5e1", borderRadius: 14, padding: 12, background: "#fff" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{s.title}</div>
                          {s.purpose ? (
                            <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.45 }}>{truncate(s.purpose, 160)}</div>
                          ) : null}
                          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <span style={pillOk}>주 담당</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>
                      주 담당으로 지정된 단계가 없습니다. 참여·검토 중심 화면으로 표시합니다.
                    </div>
                  )}

                  {mySecondaryOnly.length ? (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>참여(보조)</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {mySecondaryOnly.map((s) => (
                          <div key={s.id} style={{ fontSize: 12.5, color: "#475569", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                            {s.title}
                            <span style={{ color: "#94a3b8", marginLeft: 8 }}>주 담당: {actorLabel(s.primaryActorId)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: device === "mobile" ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
                    <div style={statCard}>
                      <div style={statLabel}>처리 대기</div>
                      <div style={statValue}>{myPrimary.length}</div>
                    </div>
                    <div style={statCard}>
                      <div style={statLabel}>최근 결과</div>
                      <div style={statValue}>{myPrimary[0]?.title ? truncate(myPrimary[0].title, 14) : "—"}</div>
                    </div>
                    <div style={statCard}>
                      <div style={statLabel}>승인 필요</div>
                      <div style={statValue}>{/승인|확정/.test(myPrimary.map((x) => x.title).join("")) ? "있음" : "—"}</div>
                    </div>
                  </div>
                </section>
              )}

              <section style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {(selectedActor.kind === "system" ? systemChips : humanChips).map((c) => (
                  <span key={c} style={actionChip}>
                    {c}
                  </span>
                ))}
              </section>

              <section style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>사용자 흐름 요약</div>
                  {otherSteps.length ? (
                    <button type="button" onClick={() => setOthersExpanded((v) => !v)} style={{ ...btnStyle, marginLeft: "auto", fontSize: 11.5 }}>
                      기타 단계 {othersExpanded ? "접기" : `펼치기 (${otherSteps.length})`}
                    </button>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {[...myPrimary, ...mySecondaryOnly].length ? (
                    [...myPrimary, ...mySecondaryOnly].map((s, idx) => (
                      <div key={`mine-${s.id}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, color: "#0f172a" }}>
                        <span style={{ fontWeight: 900, color: "#1e40af" }}>{idx + 1}</span>
                        <span style={{ fontWeight: 800 }}>{s.title}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                          {s.primaryActorId === selectedActor.id ? "주 담당" : "참여"}
                        </span>
                      </div>
                    ))
                  ) : (
                    safeSteps.map((s, idx) => (
                      <div key={`all-${s.id}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, color: "#64748b" }}>
                        <span style={{ fontWeight: 900 }}>{idx + 1}</span>
                        <span style={{ fontWeight: 700 }}>{s.title}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, whiteSpace: "nowrap" }}>담당: {actorLabel(s.primaryActorId)}</span>
                      </div>
                    ))
                  )}
                </div>
                {othersExpanded && otherSteps.length ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0", display: "grid", gap: 6, opacity: 0.85 }}>
                    {otherSteps.map((s, idx) => (
                      <div key={`other-${s.id}`} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#64748b" }}>
                        <span style={{ fontWeight: 800 }}>{idx + 1}</span>
                        <span>{s.title}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12 }}>{actorLabel(s.primaryActorId)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </main>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const btnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
};

const selectStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12.5,
};

const pillOk: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  borderRadius: 999,
  padding: "4px 8px",
  background: "#ecfdf5",
  color: "#047857",
  border: "1px solid #a7f3d0",
};

const statCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 10,
  background: "#f8fafc",
};

const statLabel: CSSProperties = { fontSize: 11, fontWeight: 800, color: "#64748b" };
const statValue: CSSProperties = { marginTop: 6, fontSize: 15, fontWeight: 900, color: "#0f172a", wordBreak: "break-word" };

const actionChip: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  borderRadius: 999,
  padding: "6px 10px",
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
};
