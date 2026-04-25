"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import type {
  RequirementsServiceFlowActorKind,
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

const colWrap: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 55fr) minmax(280px, 45fr)",
  gap: 14,
  alignItems: "stretch",
  minHeight: 0,
  flex: "1 1 auto",
  overflowX: "hidden",
};

const panel: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  overflow: "hidden",
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const panelHeader: CSSProperties = {
  padding: "12px 12px 10px",
  borderBottom: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const headerTitle: CSSProperties = { fontSize: 13, fontWeight: 900, color: "#0f172a" };
const headerSub: CSSProperties = { marginTop: 4, fontSize: 12, fontWeight: 600, color: "#64748b", lineHeight: 1.45 };

const btn: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a",
  cursor: "pointer",
};

const btnPrimary: CSSProperties = {
  ...btn,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

function uuid(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `id_${Math.random().toString(16).slice(2)}`;
  }
}

function normalizeOrder(steps: RequirementsServiceFlowStepV1[]): RequirementsServiceFlowStepV1[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s, idx) => ({ ...s, order: idx + 1 }));
}

function actorKindLabel(kind: RequirementsServiceFlowActorKind): string {
  return kind === "human" ? "사람 액터" : "시스템 액터";
}

export function RequirementsServiceFlowStage({
  ideationReady,
  ideationReadyNotice,
  flow,
  onChangeFlow,
}: {
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  const nowIso = () => new Date().toISOString();

  const steps = flow?.steps ?? [];
  const actors = flow?.actors ?? [];

  const [selectedActorId, setSelectedActorId] = useState<string | null>(actors[0]?.id ?? null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(steps[0]?.id ?? null);
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null;
  const selectedActor = actors.find((a) => a.id === selectedActorId) ?? null;

  useEffect(() => {
    if (selectedStepId && steps.some((s) => s.id === selectedStepId)) return;
    setSelectedStepId(steps[0]?.id ?? null);
  }, [selectedStepId, steps]);

  useEffect(() => {
    if (selectedActorId && actors.some((a) => a.id === selectedActorId)) return;
    setSelectedActorId(actors[0]?.id ?? null);
  }, [actors, selectedActorId]);

  const actorStats = useMemo(() => {
    const byId = new Map<string, { stepIds: string[]; primaryCount: number }>();
    for (const a of actors) byId.set(a.id, { stepIds: [], primaryCount: 0 });
    for (const s of steps) {
      const all = [s.primaryActorId, ...s.secondaryActorIds].filter(Boolean);
      for (const aid of all) {
        const row = byId.get(aid);
        if (!row) continue;
        if (!row.stepIds.includes(s.id)) row.stepIds.push(s.id);
      }
      const pr = byId.get(s.primaryActorId);
      if (pr) pr.primaryCount += 1;
    }
    return byId;
  }, [actors, steps]);

  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");

  const ensureBase = (): RequirementsServiceFlowV1 => {
    const base: RequirementsServiceFlowV1 =
      flow ??
      ({
        createdAt: nowIso(),
        updatedAt: nowIso(),
        steps: [],
        actors: [
          { id: "actor:user", name: "사용자", kind: "human" },
          { id: "actor:system", name: "시스템", kind: "system" },
        ],
      } satisfies RequirementsServiceFlowV1);
    return base;
  };

  const addStep = () => {
    const base = ensureBase();
    const primaryActorId = base.actors[0]?.id ?? "";
    const id = uuid();
    const nextSteps = normalizeOrder([
      ...base.steps,
      {
        id,
        order: base.steps.length + 1,
        title: "새 단계",
        purpose: "목적을 한 줄로 작성",
        primaryActorId,
        secondaryActorIds: [],
        approved: false,
        updatedAt: nowIso(),
      },
    ]);
    onChangeFlow({ ...base, steps: nextSteps, updatedAt: nowIso() });
    setSelectedStepId(id);
  };

  const removeStep = (id: string) => {
    const base = ensureBase();
    const nextSteps = normalizeOrder(base.steps.filter((s) => s.id !== id));
    onChangeFlow({ ...base, steps: nextSteps, updatedAt: nowIso() });
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    const base = ensureBase();
    const ordered = normalizeOrder(base.steps);
    const idx = ordered.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= ordered.length) return;
    const swapped = [...ordered];
    const tmp = swapped[idx]!;
    swapped[idx] = swapped[j]!;
    swapped[j] = tmp;
    onChangeFlow({ ...base, steps: normalizeOrder(swapped), updatedAt: nowIso() });
  };

  const updateStep = (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => {
    const base = ensureBase();
    const nextSteps = base.steps.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: nowIso() } : s));
    onChangeFlow({ ...base, steps: normalizeOrder(nextSteps), updatedAt: nowIso() });
  };

  const approveStep = (id: string) => {
    updateStep(id, { approved: true });
  };

  const addActor = (kind: RequirementsServiceFlowActorKind) => {
    const base = ensureBase();
    const next: RequirementsServiceFlowActorV1 = { id: uuid(), name: kind === "human" ? "새 사람" : "새 시스템", kind };
    onChangeFlow({ ...base, actors: [...base.actors, next], updatedAt: nowIso() });
    setSelectedActorId(next.id);
  };

  const updateActor = (id: string, patch: Partial<RequirementsServiceFlowActorV1>) => {
    const base = ensureBase();
    const nextActors = base.actors.map((a) => (a.id === id ? { ...a, ...patch } : a));
    onChangeFlow({ ...base, actors: nextActors, updatedAt: nowIso() });
  };

  const removeActor = (id: string) => {
    const base = ensureBase();
    const nextActors = base.actors.filter((a) => a.id !== id);
    const fallbackActorId = nextActors[0]?.id ?? "";
    const nextSteps = base.steps.map((s) => ({
      ...s,
      primaryActorId: s.primaryActorId === id ? fallbackActorId : s.primaryActorId,
      secondaryActorIds: s.secondaryActorIds.filter((aid) => aid !== id),
      approved: false,
      updatedAt: nowIso(),
    }));
    onChangeFlow({ ...base, actors: nextActors, steps: nextSteps, updatedAt: nowIso() });
    if (selectedActorId === id) setSelectedActorId(fallbackActorId || null);
  };

  const setSupportingActorsFromSelect = (stepId: string, selected: HTMLCollectionOf<HTMLOptionElement>) => {
    updateStep(stepId, {
      secondaryActorIds: Array.from(selected)
        .filter((o) => o.selected)
        .map((o) => o.value)
        .filter(Boolean),
    });
  };

  return (
    <section className="relative jyo-service-flow-stage" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflowX: "hidden" }}>
      <style>{`
        .jyo-service-flow-grid {
          grid-template-columns: minmax(0, 55fr) minmax(280px, 45fr);
        }
        @media (max-width: 920px) {
          .jyo-service-flow-grid {
            grid-template-columns: minmax(0, 1fr);
            overflow-y: auto;
          }
        }
        .jyo-service-flow-stage input,
        .jyo-service-flow-stage textarea,
        .jyo-service-flow-stage select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      <ScreenLabel label="요구사항-서비스흐름-페이지-섹션" visible={showScreenLabels} />

      {!ideationReady ? (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13, fontWeight: 700, lineHeight: 1.55 }}>
          {ideationReadyNotice}
        </div>
      ) : null}

      <div className="jyo-service-flow-grid" style={colWrap}>
        <div style={panel}>
          <div style={panelHeader}>
            <div style={headerTitle}>서비스 흐름 리스트</div>
            <div style={headerSub}>각 단계는 주 담당 1명(1 액터)만 가집니다.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={addStep} style={btn}>
                단계 추가
              </button>
            </div>
          </div>
          <div style={{ padding: 10, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.length === 0 ? (
              <div style={{ padding: "12px 10px", fontSize: 13, color: "#64748b" }}>아직 단계가 없습니다. “단계 추가” 또는 “AI 초안 생성”을 사용하세요.</div>
            ) : null}
            {normalizeOrder(steps).map((s) => {
              const selected = selectedStep?.id === s.id;
              const primary = actors.find((a) => a.id === s.primaryActorId)?.name ?? s.primaryActorId;
              const secondaryNames =
                s.secondaryActorIds
                  .map((id) => actors.find((a) => a.id === id)?.name ?? id)
                  .filter(Boolean);
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedStepId(s.id)}
                  style={{
                    border: selected ? "2px solid #0f766e" : "1px solid #e2e8f0",
                    borderRadius: 12,
                    background: selected ? "#f0fdfa" : "#fff",
                    padding: "10px 10px 10px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      [{s.order}]{" "}
                      <input
                        value={s.title}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateStep(s.id, { title: e.target.value })}
                        style={{ border: "none", outline: "none", font: "inherit", fontWeight: 900, width: "calc(100% - 54px)" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" style={btn} onClick={() => moveStep(s.id, -1)} disabled={s.order <= 1} title="위로">
                        ↑
                      </button>
                      <button type="button" style={btn} onClick={() => moveStep(s.id, 1)} disabled={s.order >= steps.length} title="아래로">
                        ↓
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12.5, color: "#334155", display: "grid", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 4 }}>목적</div>
                      <input
                        value={s.purpose}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateStep(s.id, { purpose: e.target.value })}
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: s.approved ? "#166534" : s.primaryActorId ? "#334155" : "#b45309" }}>
                        {s.approved ? "승인됨" : "미승인"} · 주 담당: {primary || "미지정"}{secondaryNames.length ? ` · 보조: ${secondaryNames.join(", ")}` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={btn} onClick={() => approveStep(s.id)} disabled={s.approved}>
                          승인
                        </button>
                        <button type="button" style={btn} onClick={() => removeStep(s.id)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <div style={headerTitle}>액터 매핑 / 역할 정보</div>
            <div style={headerSub}>선택한 단계의 주 담당과 보조 액터를 연결합니다.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => addActor("human")} style={btn}>
                사람 액터 추가
              </button>
              <button type="button" onClick={() => addActor("system")} style={btn}>
                시스템 액터 추가
              </button>
            </div>
          </div>

          <div style={{ padding: 10, overflowY: "auto", minHeight: 0, display: "grid", gap: 10 }}>
            <div style={{ border: "1px solid #ccfbf1", background: "#f0fdfa", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
                선택 단계 매핑
              </div>
              {selectedStep ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f766e" }}>
                    [{selectedStep.order}] {selectedStep.title || "이름 없는 단계"}
                  </div>
                  <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                    주 담당 액터
                    <select
                      value={selectedStep.primaryActorId}
                      onChange={(e) => updateStep(selectedStep.id, { primaryActorId: e.target.value, approved: false })}
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, background: "#fff" }}
                    >
                      <option value="">주 담당 선택</option>
                      {actors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                    보조 액터(선택)
                    <select
                      multiple
                      value={selectedStep.secondaryActorIds}
                      onChange={(e) => setSupportingActorsFromSelect(selectedStep.id, e.currentTarget.options)}
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, background: "#fff", minHeight: 92 }}
                    >
                      {actors
                        .filter((a) => a.id !== selectedStep.primaryActorId)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>단계를 선택하거나 추가해 주세요.</div>
              )}
            </div>

            {[{ kind: "human" as const, list: humans }, { kind: "system" as const, list: systems }].map((group) => (
              <div key={group.kind}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>{actorKindLabel(group.kind)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.list.map((a) => {
                    const stat = actorStats.get(a.id);
                    const active = a.id === selectedActorId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedActorId(a.id)}
                        style={{
                          textAlign: "left",
                          borderRadius: 10,
                          border: active ? "2px solid #0f766e" : "1px solid #e2e8f0",
                          background: active ? "#ecfdf5" : "#fff",
                          padding: "8px 10px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.name}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>{a.kind === "human" ? "사람" : "시스템"}</span>
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", marginTop: 3 }}>
                          참여 단계 {stat?.stepIds.length ?? 0} · 주 담당 {stat?.primaryCount ?? 0}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {selectedActor ? (
              <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>역할 설명</div>
                <input
                  value={selectedActor.name}
                  onChange={(e) => updateActor(selectedActor.id, { name: e.target.value })}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, fontWeight: 900 }}
                />
                <textarea
                  value={selectedActor.description ?? ""}
                  onChange={(e) => updateActor(selectedActor.id, { description: e.target.value })}
                  placeholder="역할을 한두 문장으로 정의하세요"
                  style={{ width: "100%", marginTop: 8, borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, minHeight: 80, resize: "vertical" }}
                />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" style={btn} onClick={() => removeActor(selectedActor.id)} disabled={actors.length <= 1}>
                    액터 삭제
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

