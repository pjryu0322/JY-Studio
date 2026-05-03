"use client";

import { useEffect, useMemo, useState } from "react";
import { WORKSPACE_SECTION_META } from "@/components/project-spec/workspaceSectionMeta";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { RequirementsChatHeaderRow } from "@/components/requirements/RequirementsChatHeaderRow";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { WorkspaceChatPanel } from "@/components/workspace/WorkspaceChatPanel";
import { WorkspaceComposerFooter } from "@/components/workspace/WorkspaceComposerFooter";
import { WorkspaceMainPanel } from "@/components/workspace/WorkspaceMainPanel";
import pillStyles from "@/components/workspace/workspaceProgressPill.module.css";
import { useProjectWorkspaceParticipants } from "@/components/workspace/useProjectWorkspaceParticipants";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { uiTokens as t } from "@/components/ui/tokens";
import { FeaturePlanningComposer } from "./FeaturePlanningComposer";
import { FeaturePlanningSidebarContent } from "./FeaturePlanningSidebarContent";
import { FeaturePlanningSlotsPanel } from "./FeaturePlanningSlotsPanel";
import { FeaturePlanningWorkspaceCanvas } from "./FeaturePlanningWorkspaceCanvas";
import { enrichFeaturePlanningDisplayMessages } from "@/lib/featurePlanning/featurePlanningChatDisplay";
import { useFeaturePlanningWorkspace } from "./useFeaturePlanningWorkspace";
import styles from "./featurePlanningWorkspace.module.css";

type FeatureCanvasMode = "overview" | "deliverables";

export function FeaturePlanningWorkspace({ projectId }: { readonly projectId: string }) {
  const showScreenLabels = useShowScreenLabels();
  const shell = useFeaturePlanningWorkspace(projectId);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [canvas, setCanvas] = useState<FeatureCanvasMode | null>(null);
  const { participants, participantBadgeCount, members, reloadMembers } = useProjectWorkspaceParticipants({
    projectId,
    activeStage: "ideation",
    aiLastInvoke: null,
    aiInvokePending: false,
  });

  const displayMessages = useMemo(
    () => enrichFeaturePlanningDisplayMessages(shell.messages, shell.artifact),
    [shell.messages, shell.artifact]
  );

  const existingHumanUserIds = useMemo(
    () => new Set(members.filter((m) => m.memberType === "HUMAN" && m.userId).map((m) => m.userId as string)),
    [members]
  );

  useEffect(() => {
    if (!canvas) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [canvas]);

  const mainEl = (
    <WorkspaceMainPanel style={{ position: "relative", minWidth: 0 }}>
      <WorkspaceChatPanel
        messages={displayMessages}
        loading={shell.initLoading || shell.loading || shell.resetChatLoading || shell.slotDigestLoading}
        loadingHint={
          shell.resetChatLoading
            ? shell.resetChatLoadingHint
            : shell.slotDigestLoading
              ? shell.slotDigestLoadingHint
              : shell.loading
                ? shell.chatLoadingHint
                : shell.initLoadingHint
        }
        onSlotNavChipClick={(slotId) => {
          void shell.expandSlotPreviewInChat(slotId);
        }}
        slotDigestLoading={shell.slotDigestLoading}
        screenLabel={WORKSPACE_SECTION_META.featurePlanningChat.fullLabel}
        emptyHint={
          !shell.initLoading && !shell.loading && !shell.slotDigestLoading && displayMessages.length === 0 ? (
            <div
              style={{
                justifySelf: "start",
                maxWidth: "min(100%, 620px)",
                width: "100%",
                minWidth: 0,
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                background: t.bgCard,
                fontSize: 14,
                color: t.textSecondary,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {shell.artifact?.slots?.length
                ? "대화를 불러오는 중 문제가 있었습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해 주세요."
                : "기능 정리 초안을 준비한 뒤 AI 기획자가 이곳에서 질문을 드립니다.\n\n초안 준비가 끝나지 않았다면 서버에 OPENAI_API_KEY가 설정되어 있는지 확인해 주세요."}
            </div>
          ) : null
        }
      />
    </WorkspaceMainPanel>
  );

  const topBar = (
    <RequirementsChatHeaderRow
      variant="card"
      memberButtonTestId="feature-planning-members-open"
      memberBefore={<ScreenLabel label={WORKSPACE_SECTION_META.featurePlanningHeaderMembers.fullLabel} visible={showScreenLabels} />}
      leading={
        <div className={styles.headerLeading}>
          <div className={styles.labeledStack}>
            <ScreenLabel label={WORKSPACE_SECTION_META.featurePlanningHeaderProgress.fullLabel} visible={showScreenLabels} />
            <div
              className={pillStyles.trigger}
              style={{ maxWidth: "min(100%, 360px)", cursor: "default" }}
              aria-label={`정리 영역 ${shell.planningAreaCount}개`}
              data-testid="workspace-header-progress-pill"
            >
              <span className={pillStyles.nowrap}>정리 영역</span>
              <span className={pillStyles.sep}>·</span>
              <span className={pillStyles.count}>{shell.planningAreaCount}개</span>
            </div>
          </div>
        </div>
      }
      memberControls={{
        count: participantBadgeCount,
        onOpen: () => setMembersModalOpen(true),
      }}
    />
  );

  const mainBody = (
    <div className={styles.body}>
      <div className={styles.mainStack}>{mainEl}</div>
    </div>
  );

  return (
    <div className={styles.root}>
      <ScreenLabel label={WORKSPACE_SECTION_META.featurePlanningRoot.fullLabel} visible={showScreenLabels} />
      {shell.loadError ? <div role="alert" className={styles.notice}>{shell.loadError}</div> : null}
      {shell.notice ? <div role="status" className={styles.notice}>{shell.notice}</div> : null}
      {shell.showStructuralRegenerateHint ? (
        <div role="region" aria-label="기능 정리 구조 안내" className={styles.structHint}>
          <p className={styles.structHintText}>
            저장된 정리가 <strong>업무 처리 절차</strong> 위주로 잡혀 있으면, 프로토타입 설계에는 맞지 않을 수 있습니다.{" "}
            <strong>서비스 구조</strong> 기준으로 다시 만들 것을 권장합니다.
          </p>
          <button type="button" className={styles.structHintBtn} onClick={() => shell.onRegenerateSlots()}>
            구조에 맞게 다시 만들기
          </button>
        </div>
      ) : null}

      <WorkspaceShell
        className={styles.shellCard}
        top={topBar}
        footer={
          <WorkspaceComposerFooter>
            <FeaturePlanningComposer
              value={shell.composer}
              onChange={shell.setComposer}
              onSend={() => {
                void shell.send();
              }}
              busy={shell.initLoading || shell.loading || shell.resetChatLoading || shell.slotDigestLoading}
              onOpenResultsView={() => setCanvas("overview")}
              onRequestPlannerOrganize={() => {
                void shell.requestPlannerOrganize();
              }}
              onResetChat={
                shell.artifact?.slots?.length
                  ? () => {
                      void shell.resetChat();
                    }
                  : undefined
              }
            />
          </WorkspaceComposerFooter>
        }
      >
        {mainBody}
      </WorkspaceShell>

      {canvas === "overview" ? (
        <FeaturePlanningWorkspaceCanvas title="결과물" onClose={() => setCanvas(null)} footer={<span>프로젝트 · {projectId.slice(0, 8)}…</span>}>
          <div style={{ padding: "4px 2px 16px", flex: 1, minHeight: 0, overflow: "auto" }}>
            <FeaturePlanningSidebarContent />
          </div>
        </FeaturePlanningWorkspaceCanvas>
      ) : null}

      {canvas === "deliverables" ? (
        <FeaturePlanningWorkspaceCanvas title="기능 정리 현황" onClose={() => setCanvas(null)}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <FeaturePlanningSlotsPanel
              artifact={shell.artifact}
              activeSlotId={shell.activeSlotId}
              onActiveSlotChange={shell.setActiveSlotId}
              onChangeItem={shell.updateArtifactItem}
              generating={shell.initLoading}
              saving={shell.slotsSaving}
              onRegenerateClick={shell.onRegenerateSlots}
            />
          </div>
        </FeaturePlanningWorkspaceCanvas>
      ) : null}

      <RequirementsMemberInviteModal
        open={inviteOpen && Boolean(projectId.trim())}
        projectId={projectId.trim()}
        onClose={() => setInviteOpen(false)}
        onInvited={() => void reloadMembers()}
        existingHumanUserIds={existingHumanUserIds}
      />

      <WorkspaceParticipantsModal
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        participants={participants}
        showInvite={Boolean(projectId.trim())}
        inviteDisabled={!projectId.trim()}
        onInviteClick={() => setInviteOpen(true)}
      />
    </div>
  );
}
