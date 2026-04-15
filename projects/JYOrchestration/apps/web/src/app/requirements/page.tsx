"use client";

import Link from "next/link";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { formatRequirementStatusForUi } from "@/lib/ui/workflowUiCopy";
import { getRequirementsListView } from "@/lib/workflow/workflowViewModel";

export default function RequirementsPage() {
  const vm = getRequirementsListView();
  const showScreenLabels = useShowScreenLabels();

  return (
    <div className="relative">
      <ScreenLabel label="요구사항-목록-섹션" visible={showScreenLabels} />
      <WorkflowPageHeader
        title="요구사항"
        subtitle="워크플로우 흐름: 요구사항 → 협업 세션 → 회의록 → 기능"
        backHref="/workspace"
        backLabel="워크스페이스로"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {vm.requirements.length === 0 ? (
          <WorkflowEmptyState title="요구사항" message="표시할 요구사항이 없습니다." />
        ) : (
          vm.requirements.map((r) => (
            <WorkflowCard key={r.id}>
              <div className="relative" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <ScreenLabel label="요구사항-항목카드" visible={showScreenLabels} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div className="relative" style={{ fontSize: 14, fontWeight: 900 }}>
                      <ScreenLabel label="요구사항-항목카드-제목" visible={showScreenLabels} />
                      {r.title}
                    </div>
                    <div className="relative">
                      <ScreenLabel label="요구사항-항목카드-상태배지" visible={showScreenLabels} />
                      <WorkflowBadge>{formatRequirementStatusForUi(r.status)}</WorkflowBadge>
                    </div>
                  </div>
                  <div className="relative" style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>
                    <ScreenLabel label="요구사항-항목카드-설명" visible={showScreenLabels} />
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
                      <strong style={{ color: "#111827" }}>{r.sessionCount}</strong>개 세션
                    </div>
                    <div>
                      <strong style={{ color: "#111827" }}>{r.featureCount}</strong>개 기능
                    </div>
                  </div>
                </div>

                <div className="relative" style={{ flex: "0 0 auto" }}>
                  <ScreenLabel label="요구사항-항목카드-열기버튼" visible={showScreenLabels} />
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
                    열기
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
