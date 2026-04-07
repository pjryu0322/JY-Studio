import Link from "next/link";
import { mockRequirements } from "@/lib/mock/workflowMock";

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #e5e5e5",
        background: "#fafafa",
        color: "#374151",
        fontWeight: 800,
      }}
    >
      {status}
    </span>
  );
}

export default function RequirementsPage() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Requirements</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Workflow entry: Requirement → Collaboration Session → Meeting Minutes → Features
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {mockRequirements.map((r) => (
          <div key={r.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{r.title}</div>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>
                  {r.description}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, color: "#6b7280", fontSize: 13 }}>
                  <div>
                    <strong style={{ color: "#111827" }}>{r.sessionCount}</strong> sessions
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>{r.featureCount}</strong> features
                  </div>
                </div>
              </div>

              <div style={{ flex: "0 0 auto" }}>
                <Link
                  href={`/requirements/${encodeURIComponent(r.id)}?tab=overview`}
                  style={{
                    display: "inline-block",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #2563eb",
                    background: "#2563eb",
                    color: "#fff",
                    fontWeight: 900,
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Open
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

