"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  gridTemplateColumns: "320px minmax(0, 1fr) 300px",
  gap: 14,
  alignItems: "stretch",
  minHeight: 0,
};

const panel: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#fff",
  overflow: "hidden",
  minHeight: 0,
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
  onGenerateAiDraft,
  onApproveAll,
  onNavigateToFeaturesHref,
  chat,
}: {
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
  readonly onNavigateToFeaturesHref: string;
  readonly chat: ReactNode;
}) {
  const showScreenLabels = useShowScreenLabels();
  const nowIso = () => new Date().toISOString();

  const steps = flow?.steps ?? [];
  const actors = flow?.actors ?? [];

  const [selectedActorId, setSelectedActorId] = useState<string | null>(actors[0]?.id ?? null);
  const selectedActor = actors.find((a) => a.id === selectedActorId) ?? null;

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

  const upsertFlow = (patch: Partial<RequirementsServiceFlowV1>) => {
    const base = ensureBase();
    onChangeFlow({ ...base, ...patch, updatedAt: nowIso() });
  };

  const addStep = () => {
    const base = ensureBase();
    const nextSteps = normalizeOrder([
      ...base.steps,
      {
        id: uuid(),
        order: base.steps.length + 1,
        title: "새 단계",
        purpose: "목적을 한 줄로 작성",
        primaryActorId: base.actors[0]?.id ?? "actor:user",
        secondaryActorIds: [],
        approved: false,
        updatedAt: nowIso(),
      },
    ]);
    onChangeFlow({ ...base, steps: nextSteps, updatedAt: nowIso() });
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

  return (
    <section className="relative" style={{ marginTop: 14 }}>
      <ScreenLabel label="요구사항-서비스흐름-페이지-섹션" visible={showScreenLabels} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>액터 및 서비스 흐름 정의</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
            서비스 흐름을 먼저 정리한 뒤 액터·책임을 확정합니다.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={onGenerateAiDraft} style={btnPrimary} disabled={!ideationReady} title={!ideationReady ? ideationReadyNotice : "AI로 초안을 생성합니다"}>
            AI 초안 생성
          </button>
          <button type="button" onClick={onApproveAll} style={btn} disabled={!flow || steps.length === 0}>
            전체 승인
          </button>
          <Link href={onNavigateToFeaturesHref} style={{ ...btn, display: "inline-block", textDecoration: "none" }}>
            기능 정리로 이동
          </Link>
        </div>
      </div>

      {!ideationReady ? (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13, fontWeight: 700, lineHeight: 1.55 }}>
          {ideationReadyNotice}
        </div>
      ) : null}

      <div style={colWrap}>
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
              const primary = actors.find((a) => a.id === s.primaryActorId)?.name ?? s.primaryActorId;
              const secondaryNames =
                s.secondaryActorIds
                  .map((id) => actors.find((a) => a.id === id)?.name ?? id)
                  .filter(Boolean);
              return (
                <div key={s.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "10px 10px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      [{s.order}]{" "}
                      <input
                        value={s.title}
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
                        onChange={(e) => updateStep(s.id, { purpose: e.target.value })}
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13 }}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 4 }}>주 담당</div>
                        <select
                          value={s.primaryActorId}
                          onChange={(e) => updateStep(s.id, { primaryActorId: e.target.value })}
                          style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, background: "#fff" }}
                        >
                          {actors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 4 }}>보조(복수)</div>
                        <input
                          value={secondaryNames.join(", ")}
                          onChange={(e) => {
                            const tokens = e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean);
                            const ids = tokens
                              .map((name) => actors.find((a) => a.name === name)?.id)
                              .filter((x): x is string => Boolean(x));
                            updateStep(s.id, { secondaryActorIds: ids });
                          }}
                          placeholder="예: 시스템, 관리자"
                          style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: s.approved ? "#166534" : "#b45309" }}>
                        {s.approved ? "승인됨" : "미승인"} · 주 담당: {primary}{secondaryNames.length ? ` · 보조: ${secondaryNames.join(", ")}` : ""}
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

        <div style={{ minHeight: 0 }}>{chat}</div>

        <div style={panel}>
          <div style={panelHeader}>
            <div style={headerTitle}>액터 목록 / 역할 정보</div>
            <div style={headerSub}>단계에서 등장하는 사람·시스템을 분리해 관리합니다.</div>
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
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.name}
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
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

