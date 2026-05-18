"use client";

import { FeatureSummaryPanel } from "@/components/workflow/FeatureSummaryPanel";
import { MeetingMinutesPanel } from "@/components/workflow/MeetingMinutesPanel";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowSectionLabel } from "@/components/workflow/primitives/WorkflowSectionLabel";
import { TaskDraftsPanel } from "@/components/workflow/TaskDraftsPanel";
import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { DisplayedAnalysis } from "@/lib/workflow/collaborationWorkspacePayload";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";

export type CollaborationWorkspaceAsideProps = {
  displayedMinutes: MeetingMinutesMock | null;
  displayedFeatures: FeatureMock[];
  displayedTaskDrafts: CollaborationOfficialTaskDraft[];
  displayedAnalysis: DisplayedAnalysis | null;
  displayedIdeas: string[];
  suggestedFeaturesFromIdeas: FeatureMock[];
};

export function CollaborationWorkspaceAside({
  displayedMinutes,
  displayedFeatures,
  displayedTaskDrafts,
  displayedAnalysis,
  displayedIdeas,
  suggestedFeaturesFromIdeas,
}: CollaborationWorkspaceAsideProps) {
  return (
    <aside aria-label="워크스페이스 출력" style={{ display: "grid", gap: 14, alignContent: "start" }}>
      <WorkflowSectionLabel>주요 산출물</WorkflowSectionLabel>

      <WorkflowCard padding={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>최신 회의록</div>
          <WorkflowBadge>공식</WorkflowBadge>
        </div>
        <MeetingMinutesPanel minutes={displayedMinutes} emptyLabel="회의록이 없습니다. 회의록 작성으로 생성하세요(목)." />
      </WorkflowCard>

      <WorkflowCard padding={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>파생 기능</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <WorkflowBadge>공식</WorkflowBadge>
            <WorkflowBadge>워크스페이스</WorkflowBadge>
            <WorkflowBadge>{displayedFeatures.length}</WorkflowBadge>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
          이 세션의 공식 목록(뷰 모델 또는 기능 생성). 아이디어 요청 제안은 아래 보조 인사이트에만 표시됩니다.
        </div>
        <FeatureSummaryPanel
          hideHeader
          features={displayedFeatures}
          emptyLabel="공식 파생 기능이 없습니다. 기능 생성(공식)으로 채우세요(목)."
        />
      </WorkflowCard>

      <WorkflowCard padding={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>공식 작업 초안</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <WorkflowBadge>공식</WorkflowBadge>
            <WorkflowBadge>{displayedTaskDrafts.length}</WorkflowBadge>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
          작업 초안 생성으로 만들어지며, 최신 세션 기준 요구사항 작업 탭과 동기화됩니다. 아이디어 제안과는 다릅니다.
        </div>
        <TaskDraftsPanel tasks={displayedTaskDrafts} emptyLabel="공식 작업 초안이 없습니다. 작업 초안 생성(목)을 사용하세요." />
      </WorkflowCard>

      <WorkflowCard padding={12}>
        <details style={{ border: 0 }}>
          <summary
            style={{
              cursor: "pointer",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            <span>보조 인사이트</span>
            <WorkflowBadge>보조</WorkflowBadge>
          </summary>
          <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, margin: "10px 0 0" }}>
            분석, 아이디어, 제안 형태의 기능 초안, 자리 표시자입니다. 토론을 돕는 용도이며 공식 회의록·기능·작업 초안이 아닙니다.
          </p>

          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            <section aria-label="분석 메모">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>분석 메모</div>
              {displayedAnalysis ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>{displayedAnalysis.summary}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                    {displayedAnalysis.notes.map((n, idx) => (
                      <li key={`analysis-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                  분석 요청을 실행하면 보조 분석이 추가됩니다(목). 공식 산출물은 그대로입니다.
                </div>
              )}
            </section>

            <section aria-label="요청에서 온 아이디어">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>아이디어(브레인스토밍)</span>
                <WorkflowBadge>제안</WorkflowBadge>
              </div>
              {displayedIdeas.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                  {displayedIdeas.map((idea, idx) => (
                    <li key={`idea-${idx}`} style={{ fontSize: 13, color: "#111827", lineHeight: 1.45 }}>
                      {idea}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                  아이디어 요청으로 원시 아이디어 목록을 만듭니다(목). 공식 파생 기능은 바뀌지 않습니다.
                </div>
              )}
            </section>

            <section aria-label="아이디어에서 제안된 기능">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>제안 기능(아이디어 기반)</span>
                <WorkflowBadge>비공식</WorkflowBadge>
              </div>
              {suggestedFeaturesFromIdeas.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {suggestedFeaturesFromIdeas.map((f) => (
                    <WorkflowCard key={f.id} padding={10}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, minWidth: 0 }}>{f.name}</div>
                        <WorkflowBadge>제안</WorkflowBadge>
                      </div>
                      <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>{f.description}</div>
                    </WorkflowCard>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                  아이디어 요청 이후 초안 형태로만 나타납니다. 승격·편집은 이후 제품 단계에서 다룹니다.
                </div>
              )}
            </section>

            <section aria-label="비기능 요약 자리 표시자">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>비기능 요약</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                (자리 표시자) 비기능 제약 통합 요약은 이후에 표시됩니다.
              </div>
            </section>
          </div>
        </details>
      </WorkflowCard>
    </aside>
  );
}
