"use client";

import Link from "next/link";
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
import { WorkspaceSuccessErrorSaveToastHost } from "@/components/workspace/WorkspaceSuccessErrorSaveToastHost";
import { useTimedSuccessErrorToasts } from "@/components/workspace/useTimedSuccessErrorToasts";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { uiTokens as t } from "@/components/ui/tokens";
import { FeaturePlanningComposer } from "./FeaturePlanningComposer";
import { FeaturePlanningSidebarContent } from "./FeaturePlanningSidebarContent";
import { FeaturePlanningSlotsPanel } from "./FeaturePlanningSlotsPanel";
import { FeaturePlanningWorkspaceCanvas } from "./FeaturePlanningWorkspaceCanvas";
import { enrichFeaturePlanningDisplayMessages } from "@/lib/featurePlanning/featurePlanningChatDisplay";
import { publishProjectRailParticipantCount } from "@/lib/layout/projectRailParticipants";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import { useWorkNoteChatSelectionRequester } from "@/components/worknote/WorkNoteChatSelectionBridge";
import { useFeaturePlanningWorkspace } from "./useFeaturePlanningWorkspace";
import styles from "./featurePlanningWorkspace.module.css";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

type FeatureCanvasMode = "overview" | "deliverables";

export function FeaturePlanningWorkspace({
  projectId,
  singleChatMode = false,
  singleChatSendRef,
}: {
  readonly projectId: string;
  /** Service Design SingleChat: chat/composer lives in parent (`/requirements`). */
  readonly singleChatMode?: boolean;
  /** Service Design SingleChat: expose existing send logic to parent without refactor. */
  readonly singleChatSendRef?: { current: ((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null };
}) {
  const showScreenLabels = useShowScreenLabels();
  const shell = useFeaturePlanningWorkspace(projectId);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [canvas, setCanvas] = useState<FeatureCanvasMode | null>(null);
  const { successToast, errorToast } = useTimedSuccessErrorToasts({ successDismissMs: 2800 });
  const { participants, participantBadgeCount, members, reloadMembers } = useProjectWorkspaceParticipants({
      projectId,
      activeStage: "ideation",
      workspaceParticipantScreenKey: "feature_planning",
      aiLastInvoke: null,
      aiInvokePending: false,
    });

  const displayMessages = useMemo(
    () => enrichFeaturePlanningDisplayMessages(shell.messages, shell.artifact),
    [shell.messages, shell.artifact]
  );

  const appendChatSelectionToWorkNote = useWorkNoteChatSelectionRequester(projectId);

  const serviceFlowHref = useMemo(
    () => `/requirements?projectId=${encodeURIComponent(projectId.trim())}&stage=service-flow`,
    [projectId]
  );

  const existingHumanUserIds = useMemo(
    () => new Set(members.filter((m) => m.memberType === "HUMAN" && m.userId).map((m) => m.userId as string)),
    [members]
  );

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) return;
    publishProjectRailParticipantCount(pid, "features", participantBadgeCount);
  }, [projectId, participantBadgeCount]);

  useEffect(() => {
    if (!canvas) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [canvas]);

  useEffect(() => {
    if (!singleChatSendRef) return;
    singleChatSendRef.current = async (payload, text) => {
      if (payload.serviceDesignStage !== "feature-planning") return;
      // IMPORTANT: reuse existing feature-planning send logic; no contract refactor in this phase.
      // TODO(service-design-harness): pass payload.serviceDesignStage and payload.mentionedAI into this stage API when backend contract is extended.
      await shell.sendMessage(text);
    };
    return () => {
      if (singleChatSendRef.current) singleChatSendRef.current = null;
    };
  }, [singleChatSendRef, shell]);

  const mainEl = (
    <WorkspaceMainPanel style={{ position: "relative", minWidth: 0 }}>
      {singleChatMode ? (
        <>
          {/* TODO(service-design-singlechat): chat timeline unified in RequirementsWorkspace */}
          <FeaturePlanningSlotsPanel
            artifact={shell.artifact}
            activeSlotId={shell.activeSlotId}
            onActiveSlotChange={shell.setActiveSlotId}
            onChangeItem={shell.updateArtifactItem}
            generating={shell.initLoading}
            saving={shell.slotsSaving}
            onRegenerateClick={shell.onRegenerateSlots}
          />
        </>
      ) : (
        <WorkspaceChatPanel
          messages={displayMessages}
          onChatSelectionToWorkNote={appendChatSelectionToWorkNote}
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
            shell.initError
              ? null
              : !shell.initLoading && !shell.loading && !shell.slotDigestLoading && displayMessages.length === 0 ? (
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
                    {!shell.serviceFlowReady
                      ? "액터 및 서비스 흐름 정의를 완료하면 이곳에서 기능 정리를 이어갈 수 있습니다."
                      : shell.artifact?.slots?.length
                        ? "대화를 불러오는 중 문제가 있었습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해 주세요."
                        : `서비스 흐름 분석이 끝나면 ${displayedWorkspaceAiTitle("feature_planning")}가 이곳에서 질문을 드립니다.\n\n응답이 없으면 서버에 OPENAI_API_KEY가 설정되어 있는지 확인해 주세요.`}
                  </div>
                ) : null
          }
        />
      )}
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
              style={{ maxWidth: "min(100%, 520px)", cursor: "default" }}
              aria-label={
                shell.checklistProgress
                  ? `기능정리 진행률 ${Math.round((100 * shell.checklistProgress.completed) / shell.checklistProgress.total)}퍼센트`
                  : `정리 영역 ${shell.planningAreaCount}개`
              }
              data-testid="workspace-header-progress-pill"
            >
              {shell.checklistProgress ? (
                <>
                  <span className={pillStyles.nowrap}>
                    기능정리 진행률{" "}
                    {Math.round((100 * shell.checklistProgress.completed) / shell.checklistProgress.total)}%
                  </span>
                  <span className={pillStyles.sep}>·</span>
                  <span className={pillStyles.count}>
                    현재 영역 · {shell.checklistProgress.currentAreaTitle || "—"} (
                    {shell.checklistProgress.areaCompleted}/{shell.checklistProgress.areaTotal})
                  </span>
                </>
              ) : (
                <>
                  <span className={pillStyles.nowrap}>정리 영역</span>
                  <span className={pillStyles.sep}>·</span>
                  <span className={pillStyles.count}>{shell.planningAreaCount}개</span>
                </>
              )}
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
    <div className={`chat-messages ${styles.body}`}>
      <div className={styles.mainStack}>{mainEl}</div>
    </div>
  );

  return (
    <div className={styles.root}>
      <WorkspaceSuccessErrorSaveToastHost success={successToast} error={errorToast} />
      <ScreenLabel label={WORKSPACE_SECTION_META.featurePlanningRoot.fullLabel} visible={showScreenLabels} />
      {shell.loadError ? <div role="alert" className={styles.notice}>{shell.loadError}</div> : null}
      {!shell.loadError && !shell.serviceFlowReady ? (
        <div role="region" className={styles.notice} aria-label="서비스 흐름 단계 안내">
          <Link href={serviceFlowHref} className={styles.structHintBtn} style={{ display: "inline-block", textDecoration: "none" }}>
            액터 및 서비스 흐름 정의로 이동
          </Link>
        </div>
      ) : null}
      {shell.initError ? (
        <div
          role="alert"
          className={styles.notice}
          style={{
            borderColor: "#fecaca",
            background: "#fff1f2",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: "#9f1239" }}>기능 정리 분석에 실패했습니다.</div>
          <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.55 }}>{shell.initError}</div>
          <button
            type="button"
            className={styles.structHintBtn}
            onClick={() => shell.retryInitialize()}
            style={{ alignSelf: "flex-start" }}
          >
            다시 생성
          </button>
        </div>
      ) : null}
      {shell.notice ? <div role="status" className={styles.notice}>{shell.notice}</div> : null}
      {shell.serviceFlowReady && shell.showStructuralRegenerateHint ? (
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
          singleChatMode ? (
            <>
              {/* DISABLED FOR SINGLECHAT */}
              {/* TODO(service-design-singlechat): composer moved to parent */}
            </>
          ) : (
            <WorkspaceComposerFooter>
              <FeaturePlanningComposer
                value={shell.composer}
                onChange={shell.setComposer}
                onSend={() => {
                  void shell.send();
                }}
                busy={shell.initLoading || shell.loading || shell.resetChatLoading || shell.slotDigestLoading}
                disabled={!shell.serviceFlowReady}
                placeholder={
                  shell.serviceFlowReady
                    ? shell.plannerInputHint ?? undefined
                    : "액터 및 서비스 흐름을 먼저 확정한 뒤 대화를 시작할 수 있습니다."
                }
                onOpenResultsView={() => setCanvas("overview")}
                onRequestPlannerOrganize={() => {
                  void shell.requestPlannerOrganize();
                }}
                onResetChat={
                  shell.serviceFlowReady && shell.artifact?.slots?.length
                    ? () => {
                        void shell.resetChat();
                      }
                    : undefined
                }
              />
            </WorkspaceComposerFooter>
          )
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
