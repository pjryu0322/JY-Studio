import type { FeatureMock } from "@/lib/mock/workflowMock";
import { formatFeatureStatusForUi } from "@/lib/ui/workflowUiCopy";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";

export function FeatureSummaryPanel({
  features,
  title,
  emptyLabel = "파생 기능이 없습니다.",
  hideHeader = false,
}: {
  features: FeatureMock[];
  title?: string;
  emptyLabel?: string;
  /** When the parent already provides a section title (e.g. collaboration sidebar). */
  hideHeader?: boolean;
}) {
  return (
    <section aria-label="파생 기능" style={{ display: "grid", gap: 10 }}>
      {hideHeader ? null : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{title ?? "파생 기능"}</div>
          <WorkflowBadge>{features.length}</WorkflowBadge>
        </div>
      )}
      {features.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {features.map((f) => (
            <WorkflowCard key={f.id} padding={12}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{f.name}</div>
                <WorkflowBadge>{formatFeatureStatusForUi(f.status)}</WorkflowBadge>
              </div>
              <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>{f.description}</div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginBottom: 4 }}>사용자 흐름</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                    {f.userFlow.map((x, idx) => (
                      <li key={`${f.id}-flow-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginBottom: 4 }}>비기능</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                    {f.nonFunctional.map((x, idx) => (
                      <li key={`${f.id}-nf-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </WorkflowCard>
          ))}
        </div>
      )}
    </section>
  );
}

