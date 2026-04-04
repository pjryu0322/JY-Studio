"use client";

import type { ReactNode } from "react";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import { AiMemberRoleCard } from "@/components/project-spec/ai-members/AiMemberRoleCard";
import { AiMembersStage2SummaryCard } from "@/components/project-spec/ai-members/AiMembersStage2SummaryCard";
import { Stage2ExecutionResultPanel } from "@/components/project-spec/ai-members/Stage2ExecutionResultPanel";
import { useAiMembersState } from "@/components/project-spec/ai-members/useAiMembersState";
import type { AiMemberRoleKey } from "@/lib/ai-member/aiMemberRoleDefinitions";
import { STAGE2_DASHBOARD_ROLE_ORDER } from "@/lib/ai-member/aiMemberRoleDefinitions";
import { mapEnvironmentTestLastToStage2Summary } from "@/lib/ai-member/aiMemberStage2Policies";

function recentLineForRole(
  roleKey: AiMemberRoleKey,
  last: ReturnType<typeof mapEnvironmentTestLastToStage2Summary>
): string | null {
  if (!last) return null;
  if (roleKey === "executor") return last.executor !== "—" ? `결과: ${last.executor}` : null;
  if (roleKey === "reviewer")
    return last.reviewer.value !== "—" ? `결과: ${last.reviewer.value}` : null;
  if (roleKey === "security")
    return last.security.value !== "—" ? `결과: ${last.security.value}` : null;
  return last.scm.value !== "—" ? `결과: ${last.scm.value}` : null;
}

export function AiMembersPage(props: {
  projectId: string;
  members: ProjectMemberUiRow[];
  canManageMembers: boolean;
  canRunStage2EnvTest: boolean;
  isProjectOwner: boolean;
  onMembersChanged: () => Promise<void>;
  onOpenPresetInvite: (orchKey: string) => void;
  onRemoveMember: (memberId: string) => void;
  setMessage: (msg: string) => void;
  setError: (msg: string | null) => void;
  children?: ReactNode;
}) {
  const {
    projectId,
    members,
    canManageMembers,
    canRunStage2EnvTest,
    isProjectOwner,
    onMembersChanged,
    onOpenPresetInvite,
    onRemoveMember,
    setMessage,
    setError,
    children,
  } = props;

  const st = useAiMembersState({
    projectId,
    members,
    canRunStage2EnvTest,
    isProjectOwner,
    onAfterMutation: onMembersChanged,
  });

  const summary = mapEnvironmentTestLastToStage2Summary(st.stage2Last);

  return (
    <div data-testid="ai-members-page" style={{ display: "grid", gap: 16 }}>
      <AiMembersStage2SummaryCard
        readiness={st.readiness}
        canRunStage2EnvTest={canRunStage2EnvTest}
        executorReady={st.readiness.executorSlot === "ready"}
        canRunTest={st.stage2Runnable}
        canAddDefaults={st.canAddDefaults}
        busyRun={st.busyStage2}
        busyDefaults={st.busyDefaults}
        note={st.note}
        stage2Last={st.stage2Last}
        onRunStage2={() => st.runStage2()}
        onAddDefaults={() => st.addDefaultMembers()}
      />

      <Stage2ExecutionResultPanel last={st.stage2Last} />

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 10px 0", color: "#0f172a" }}>역할 대시보드</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {STAGE2_DASHBOARD_ROLE_ORDER.map((roleKey) => (
            <AiMemberRoleCard
              key={roleKey}
              roleKey={roleKey}
              member={roleKey === "executor" ? null : st.pickMemberForRole(roleKey)}
              canManage={canManageMembers}
              executorEnvironmentReady={st.readiness.executorSlot === "ready"}
              recentStage2Line={recentLineForRole(roleKey, summary)}
              onMembersChanged={onMembersChanged}
              onOpenPresetInvite={onOpenPresetInvite}
              onRemoveMember={onRemoveMember}
              setMessage={setMessage}
              setError={setError}
            />
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
