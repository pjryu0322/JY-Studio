import Link from "next/link";
import { getMockRequirement, mockSessions } from "@/lib/mock/workflowMock";

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
        fontWeight: 800,
      }}
    >
      {text}
    </span>
  );
}

export default function CollaborationPage() {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>Collaboration</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
        Session workspace entry points linked to Requirements (mock data).
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {mockSessions.map((s) => {
          const req = getMockRequirement(s.requirementId);
          return (
            <div key={s.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{s.title}</div>
                    <Badge text={s.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{s.createdAt}</div>
                  <div style={{ marginTop: 10, fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                    <strong>Requirement:</strong>{" "}
                    {req ? (
                      <Link href={`/requirements/${encodeURIComponent(req.id)}?tab=overview`} style={{ textDecoration: "underline" }}>
                        {req.title}
                      </Link>
                    ) : (
                      <span style={{ color: "#6b7280" }}>(unknown)</span>
                    )}
                  </div>
                </div>

                <div style={{ flex: "0 0 auto" }}>
                  <Link
                    href={`/collaboration/${encodeURIComponent(s.id)}`}
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
                    Open workspace
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

