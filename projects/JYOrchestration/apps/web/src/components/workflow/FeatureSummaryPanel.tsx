import type { FeatureMock } from "@/lib/mock/workflowMock";

function Badge({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #e5e5e5",
        background: "#fafafa",
        color: "#374151",
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

export function FeatureSummaryPanel({ features, title }: { features: FeatureMock[]; title?: string }) {
  return (
    <section aria-label="Derived features" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{title ?? "Derived Features"}</div>
        <Badge text={`${features.length}`} />
      </div>
      {features.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>(no features)</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {features.map((f) => (
            <div key={f.id} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{f.name}</div>
                <Badge text={f.status} />
              </div>
              <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>{f.description}</div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginBottom: 4 }}>User flow</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                    {f.userFlow.map((x, idx) => (
                      <li key={`${f.id}-flow-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginBottom: 4 }}>Non-functional</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                    {f.nonFunctional.map((x, idx) => (
                      <li key={`${f.id}-nf-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

