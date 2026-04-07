import Link from "next/link";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { getRequirementsListView } from "@/lib/workflow/workflowViewModel";

export default function RequirementsPage() {
  const vm = getRequirementsListView();
  return (
    <div>
      <WorkflowPageHeader
        title="Requirements"
        subtitle="Workflow entry: Requirement → Collaboration Session → Meeting Minutes → Features"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {vm.requirements.length === 0 ? (
          <WorkflowEmptyState title="Requirements" message="No requirements available" />
        ) : (
          vm.requirements.map((r) => (
            <WorkflowCard key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{r.title}</div>
                    <WorkflowBadge>{r.status}</WorkflowBadge>
                  </div>
                  <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>
                    {r.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      flexWrap: "wrap",
                      marginTop: 10,
                      color: "#6b7280",
                      fontSize: 13,
                    }}
                  >
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
            </WorkflowCard>
          ))
        )}
      </div>
    </div>
  );
}

