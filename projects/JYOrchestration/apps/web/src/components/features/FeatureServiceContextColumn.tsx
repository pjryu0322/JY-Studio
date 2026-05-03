"use client";

import type { RequirementsServiceFlowActorV1, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

function actorName(actors: readonly RequirementsServiceFlowActorV1[], id: string): string {
  return actors.find((a) => a.id === id)?.name ?? id;
}

export function FeatureServiceContextColumn({ flow }: { readonly flow: RequirementsServiceFlowV1 | null }) {
  const actors = flow?.actors ?? [];
  const steps = (flow?.steps ?? [])
    .filter((s) => s.approved)
    .sort((a, b) => a.order - b.order);

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 0,
        minWidth: 0,
        overflowY: "auto",
        padding: "12px 12px 14px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
      }}
      aria-label="액터 및 서비스 흐름 근거"
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>액터</div>
      {actors.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155", lineHeight: 1.55 }}>
          {actors.map((a) => (
            <li key={a.id}>
              <strong style={{ color: "#0f172a" }}>{a.name}</strong>
              <span style={{ color: "#94a3b8" }}> · {a.kind === "system" ? "시스템" : "사람"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>액터 정보 없음</div>
      )}

      <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>승인된 서비스 흐름</div>
      {steps.length ? (
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: "#334155", lineHeight: 1.55 }}>
          {steps.map((s) => (
            <li key={s.id} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>{s.title}</div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                주: {actorName(actors, s.primaryActorId)}
                {(s.secondaryActorIds ?? []).length
                  ? ` · 부: ${(s.secondaryActorIds ?? []).map((id) => actorName(actors, id)).join(", ")}`
                  : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>승인된 단계가 없습니다.</div>
      )}
    </aside>
  );
}
