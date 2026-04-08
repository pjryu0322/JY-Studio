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
    <aside aria-label="Workspace output" style={{ display: "grid", gap: 14, alignContent: "start" }}>
      <WorkflowSectionLabel>Primary outputs</WorkflowSectionLabel>

      <WorkflowCard padding={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Latest minutes</div>
          <WorkflowBadge>Official</WorkflowBadge>
        </div>
        <MeetingMinutesPanel minutes={displayedMinutes} emptyLabel="No meeting minutes yet. Use 회의록 작성 to generate (mock)." />
      </WorkflowCard>

      <WorkflowCard padding={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Derived features</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <WorkflowBadge>Official</WorkflowBadge>
            <WorkflowBadge>Workspace</WorkflowBadge>
            <WorkflowBadge>{displayedFeatures.length}</WorkflowBadge>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
          Official list for this session (view model or Feature 생성). 아이디어 요청 suggestions stay under Supporting insights only.
        </div>
        <FeatureSummaryPanel
          hideHeader
          features={displayedFeatures}
          emptyLabel="No official derived features yet. Use Feature 생성 (official) to populate (mock)."
        />
      </WorkflowCard>

      <WorkflowCard padding={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Official task drafts</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <WorkflowBadge>Official</WorkflowBadge>
            <WorkflowBadge>{displayedTaskDrafts.length}</WorkflowBadge>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
          Generated via Task 초안 생성; synced to the requirement Tasks tab for the latest session. Not the same as idea suggestions.
        </div>
        <TaskDraftsPanel
          tasks={displayedTaskDrafts}
          emptyLabel="No official task drafts yet. Use Task 초안 생성 (mock)."
        />
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
            <span>Supporting insights</span>
            <WorkflowBadge>Secondary</WorkflowBadge>
          </summary>
          <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, margin: "10px 0 0" }}>
            Analysis, raw ideas, suggested feature shapes, and placeholders. These support the discussion; they are not the official minutes, features, or
            task drafts.
          </p>

          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            <section aria-label="Analysis notes">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>Analysis notes</div>
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
                  Run 분석 요청 to add supporting analysis (mock). Official outputs stay as-is.
                </div>
              )}
            </section>

            <section aria-label="Ideas from request">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Ideas (brainstorm)</span>
                <WorkflowBadge>Suggestion</WorkflowBadge>
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
                  Run 아이디어 요청 for a raw idea list (mock). This does not change official derived features.
                </div>
              )}
            </section>

            <section aria-label="Suggested features from ideas">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Suggested features (from ideas)</span>
                <WorkflowBadge>Not official</WorkflowBadge>
              </div>
              {suggestedFeaturesFromIdeas.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {suggestedFeaturesFromIdeas.map((f) => (
                    <WorkflowCard key={f.id} padding={10}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, minWidth: 0 }}>{f.name}</div>
                        <WorkflowBadge>Suggestion</WorkflowBadge>
                      </div>
                      <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>{f.description}</div>
                    </WorkflowCard>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                  Appears after 아이디어 요청 as draft shapes only. Promote or edit in a later product phase.
                </div>
              )}
            </section>

            <section aria-label="Non-functional summary placeholder">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>Non-functional summary</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                (placeholder) Consolidated non-functional constraints will appear here later.
              </div>
            </section>
          </div>
        </details>
      </WorkflowCard>
    </aside>
  );
}
