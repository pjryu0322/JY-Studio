import Link from "next/link";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { getCollaborationListView } from "@/lib/workflow/workflowViewModel";

export default function CollaborationPage() {
  const vm = getCollaborationListView();
  return (
    <div>
      <WorkflowPageHeader
        title="Collaboration"
        subtitle="Session workspace entry points linked to Requirements (mock data)."
      />

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {vm.sessions.length === 0 ? (
          <WorkflowEmptyState title="Collaboration sessions" message="No collaboration sessions available" />
        ) : (
          vm.sessions.map(({ session: s, requirement: req }) => {
          return (
            <WorkflowCard key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{s.title}</div>
                    <WorkflowBadge>{s.status}</WorkflowBadge>
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
            </WorkflowCard>
          );
          })
        )}
      </div>
    </div>
  );
}

