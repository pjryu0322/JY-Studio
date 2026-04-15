"use client";

import Link from "next/link";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { formatCollaborationSessionStatusForUi } from "@/lib/ui/workflowUiCopy";
import { getCollaborationListView } from "@/lib/workflow/workflowViewModel";

export default function CollaborationPage() {
  const vm = getCollaborationListView();
  const showScreenLabels = useShowScreenLabels();

  return (
    <div className="relative">
      <ScreenLabel label="협업-목록-페이지-섹션" visible={showScreenLabels} />
      <WorkflowPageHeader
        title="협업"
        subtitle="요구사항에 연결된 세션 워크스페이스 진입점(목 데이터)."
        backHref="/requirements"
        backLabel="요구사항으로"
      />

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {vm.sessions.length === 0 ? (
          <WorkflowEmptyState title="협업 세션" message="표시할 협업 세션이 없습니다." />
        ) : (
          vm.sessions.map(({ session: s, requirement: req }) => {
            return (
              <WorkflowCard key={s.id}>
                <div className="relative" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <ScreenLabel label="협업-목록-세션카드-컨테이너" visible={showScreenLabels} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div className="relative" style={{ fontSize: 14, fontWeight: 900 }}>
                        <ScreenLabel label="협업-목록-세션카드-제목텍스트" visible={showScreenLabels} />
                        {s.title}
                      </div>
                      <div className="relative">
                        <ScreenLabel label="협업-목록-세션카드-상태배지" visible={showScreenLabels} />
                        <WorkflowBadge>{formatCollaborationSessionStatusForUi(s.status)}</WorkflowBadge>
                      </div>
                    </div>
                    <div className="relative" style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      <ScreenLabel label="협업-목록-세션카드-생성일시" visible={showScreenLabels} />
                      {s.createdAt}
                    </div>
                    <div className="relative" style={{ marginTop: 10, fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
                      <ScreenLabel label="협업-목록-세션카드-요구사항링크" visible={showScreenLabels} />
                      <strong>요구사항:</strong>{" "}
                      {req ? (
                        <Link href={`/requirements/${encodeURIComponent(req.id)}?tab=overview`} style={{ textDecoration: "underline" }}>
                          {req.title}
                        </Link>
                      ) : (
                        <span style={{ color: "#6b7280" }}>(알 수 없음)</span>
                      )}
                    </div>
                  </div>

                  <div className="relative" style={{ flex: "0 0 auto" }}>
                    <ScreenLabel label="협업-목록-세션카드-워크스페이스열기버튼" visible={showScreenLabels} />
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
                      워크스페이스 열기
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
