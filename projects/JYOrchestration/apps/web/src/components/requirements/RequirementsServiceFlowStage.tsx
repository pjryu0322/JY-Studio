"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ServiceFlowActionMenu } from "@/components/service-flow/ServiceFlowActionMenu";
import { ServiceFlowChatPanel } from "@/components/service-flow/ServiceFlowChatPanel";
import { ServiceDesignComposer } from "@/components/requirements/ServiceDesignComposer";
import { ServiceFlowHeader } from "@/components/service-flow/ServiceFlowHeader";
import { ServiceFlowMappingPanel } from "@/components/service-flow/ServiceFlowMappingPanel";
import { ServiceFlowProgressSummary } from "@/components/service-flow/ServiceFlowProgressSummary";
import { ServiceFlowRemainingDecisionsDialog } from "@/components/service-flow/ServiceFlowRemainingDecisionsDialog";
import { ServiceFlowSummaryPanel } from "@/components/service-flow/ServiceFlowSummaryPanel";
import { ChatWindowScreenLabelBottom, ChatWindowScreenLabelTop } from "@/components/workspace/ChatWindowScreenLabelBoundaries";
import { RequirementsChatComposerFooter } from "@/components/requirements/RequirementsChatComposerFooter";
import { WorkspaceParticipantsModal } from "@/components/workspace/WorkspaceParticipantsModal";
import { SERVICE_FLOW_STAGE_DECISION_SLOTS } from "@/components/service-flow/serviceFlowStageDerived";
import {
  serviceFlowChipRowStyle,
  serviceFlowStageComposerColumnStyle,
  serviceFlowStageMainChatStyle,
  serviceFlowStageRootSectionStyle,
  serviceFlowChatMessagesScrollStyle,
  serviceFlowStageShellGridStyle,
} from "@/components/service-flow/serviceFlowStageLayout";
import { useWorkNoteComposerInsertControls } from "@/components/worknote/WorkNoteComposerInsertContext";
import { useServiceFlowStageController, type ServiceFlowStageControllerInput } from "@/components/service-flow/useServiceFlowStageController";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type RequirementsServiceFlowStageProps = ServiceFlowStageControllerInput & {
  readonly ideationReadyNotice: string;
  readonly onInviteMember: () => void;
  readonly onRetryGate: () => void;
  /** SingleChat: `/requirements`에서 stage-aware send 핸들러로 위임 */
  readonly onSendServiceFlow?: (payload: ServiceDesignHarnessPayload) => void | Promise<void>;
  /** SingleChat: stage 내부 send 로직을 `/requirements`로 노출 */
  readonly serviceFlowSendRef?: { current: ((payload: ServiceDesignHarnessPayload, text: string) => void | Promise<void>) | null };
  /** SingleChat: 입력 UI는 parent(ServiceDesignComposer)만 사용 */
  readonly singleChatMode?: boolean;
  readonly onSingleChatPromptTrace?: (entry: RequirementsPromptTimelineEntry) => void;
};

export function RequirementsServiceFlowStage({
  ideationReadyNotice,
  onInviteMember,
  onRetryGate,
  ...controllerInput
}: RequirementsServiceFlowStageProps) {
  const showScreenLabels = useShowScreenLabels();
  const c = useServiceFlowStageController(controllerInput);
  const { workshop: w } = c;
  const serviceFlowSendRef = controllerInput.serviceFlowSendRef;

  // Expose the stage-local send executor to `/requirements` (single composer harness routing).
  useEffect(() => {
    if (!serviceFlowSendRef) return;
    serviceFlowSendRef.current = async (payload, text) => {
      // SingleChat: always use parent text (do not rely on stage-local input state).
      w.sendMessage(payload, text);
    };
    return () => {
      if (serviceFlowSendRef.current) serviceFlowSendRef.current = null;
    };
  }, [serviceFlowSendRef, w]);
  const { register: registerWorkNoteComposerInsert } = useWorkNoteComposerInsertControls();
  const setInputRef = useRef(w.setInput);
  setInputRef.current = w.setInput;
  const composerTaRef = w.composerTextareaRef;

  useEffect(() => {
    registerWorkNoteComposerInsert((text) => {
      setInputRef.current(text);
      window.requestAnimationFrame(() => {
        const el = composerTaRef.current;
        if (!el) return;
        el.focus();
        const len = text.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      });
    });
    return () => registerWorkNoteComposerInsert(null);
  }, [registerWorkNoteComposerInsert, composerTaRef]);

  const serviceFlowComposerAtAtItems = useMemo((): readonly ComposerAtAtPickerItem[] => {
    return c.sidebarParticipants.map((p) => ({
      id: `picker:sf:${p.id}`,
      label: p.invited ? `${p.name} (초대됨)` : p.name,
      targets: [{ id: p.id, name: p.name }],
    }));
  }, [c.sidebarParticipants]);

  return (
    <section className="jyo-service-flow-stage" style={serviceFlowStageRootSectionStyle}>
      <style>{`
        .jyo-service-flow-stage-shell {
          height: 100%;
        }
        .jyo-service-flow-stage input,
        .jyo-service-flow-stage select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      <ScreenLabel label="요구사항-서비스흐름-아이디어형워크숍" visible={showScreenLabels} />

      <div className="jyo-service-flow-stage-shell" style={serviceFlowStageShellGridStyle}>
        <main className="jyo-service-flow-chat-shell" style={serviceFlowStageMainChatStyle} aria-label="액터 및 서비스 흐름 작업 영역">
          <div className="chat-viewport" style={{ flex: "1 1 auto", minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
            <div className="chat-header">
              <ChatWindowScreenLabelTop />
              <ScreenLabel label="요구사항-서비스흐름-참여멤버" visible={showScreenLabels} />
              <ServiceFlowHeader
                progressPercent={c.derivedApproval.progressPercent}
                filledSlotCount={c.derivedApproval.filledSlotCount}
                progressSlotTotal={SERVICE_FLOW_STAGE_DECISION_SLOTS.length}
                onOpenRemaining={() => c.setRemainingPanelOpen(true)}
                hint={c.hint}
                memberControls={{
                  count: c.sidebarParticipants.length,
                  onOpen: () => c.setMembersModalOpen(true),
                }}
              />
              {controllerInput.ideationReady && c.chatActive ? (
                <ServiceFlowProgressSummary hint={c.hint} helperLine={c.decision.helperLine} />
              ) : null}
            </div>

              <div ref={w.chatScrollRef} className="chat-messages" style={serviceFlowChatMessagesScrollStyle}>
            {!controllerInput.ideationReady ? (
              <InlineAlert variant="warning" style={{ maxWidth: 620 }}>
                <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.5 }}>{ideationReadyNotice}</div>
                <Button size="sm" variant="secondary" style={{ marginTop: 8 }} onClick={onRetryGate}>
                  다시 확인
                </Button>
              </InlineAlert>
            ) : null}
            {controllerInput.ideationReady && c.summaryActive ? (
              <ServiceFlowSummaryPanel
                actors={c.actors}
                steps={c.steps}
                derivedApproval={c.derivedApproval}
                decision={c.decision}
                hint={c.hint}
                onPatchDeferral={c.patchChecklistDeferral}
              />
            ) : null}
            {controllerInput.ideationReady && c.mappingActive ? (
              <ServiceFlowMappingPanel
                structureLocked={c.structureLocked}
                steps={c.steps}
                actors={c.actors}
                onReapplyRecommended={c.reapplyRecommendedOwners}
                onUpdateStepPrimary={c.updateStepPrimary}
              />
            ) : null}
            <ServiceFlowChatPanel
              messages={w.displayMessages}
              replying={w.replying}
              generatingDraft={controllerInput.generatingDraft}
              structureLocked={c.structureLocked}
              chatActive={c.chatActive}
              ideationReady={controllerInput.ideationReady}
            />
              </div>

            <div className="chat-input">
              <ChatWindowScreenLabelBottom />
              <RequirementsChatComposerFooter>
            <div style={serviceFlowStageComposerColumnStyle}>
              {controllerInput.ideationReady && c.chatActive && w.quickReplies && w.quickReplies.length && !w.replying ? (
                <div style={serviceFlowChipRowStyle}>
                  {w.quickReplies.map((label) => (
                    <Button
                      key={label}
                      size="sm"
                      variant="secondary"
                      onClick={() => w.callAnalyze(label)}
                      style={{ borderRadius: 999 }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {controllerInput.ideationReady && c.chatActive && !w.replying && (!w.quickReplies || !w.quickReplies.length) ? (
                <div style={serviceFlowChipRowStyle}>
                  {c.composerQuickActions.map((it) => (
                    <Button key={it.label} size="sm" variant="secondary" onClick={it.action} style={{ borderRadius: 999 }}>
                      {it.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {controllerInput.singleChatMode ? (
                <>
                  {/* DISABLED FOR SINGLECHAT */}
                  {/* TODO(service-design-singlechat): composer moved to RequirementsWorkspace */}
                </>
              ) : (
                <ServiceDesignComposer
                  stage="service-flow"
                  value={w.input}
                  onChange={w.setInput}
                  busy={false}
                  disabled={c.workspaceMode !== "chat" || w.replying}
                  placeholder="메시지를 입력하세요"
                  targetPickerItems={serviceFlowComposerAtAtItems}
                  onSendIdeation={async () => {}}
                  onSendServiceFlow={async (payload) => {
                    await controllerInput.onSendServiceFlow?.(payload);
                  }}
                  onSendFeaturePlanning={async () => {}}
                  serviceFlowChrome={{
                    textAreaRef: w.composerTextareaRef,
                    actionsOpen: w.toolsOpen,
                    onOpenActions: () => w.setToolsOpen((v) => !v),
                    onToolsOpenChange: w.setToolsOpen,
                    renderActionMenu: ({ menuId, close }) => (
                      <ServiceFlowActionMenu
                        omitMenuContainer
                        menuId={menuId}
                        open={w.toolsOpen}
                        onClose={close}
                        onOrganize={w.requestOrganize}
                        onViewResult={() => c.setWorkspaceMode("summary")}
                        onViewPrompt={() => w.setToolsOpen(false)}
                        onOpenMapping={() => c.setWorkspaceMode("mapping")}
                        projectId={controllerInput.projectId}
                        ideationReady={controllerInput.ideationReady}
                        ideationReadyNotice={ideationReadyNotice}
                        hasFlowContent={Boolean(c.actors.length || c.steps.length)}
                      />
                    ),
                  }}
                />
              )}
            </div>
              </RequirementsChatComposerFooter>
            </div>
          </div>

          <ServiceFlowRemainingDecisionsDialog
            open={c.remainingPanelOpen}
            onClose={() => c.setRemainingPanelOpen(false)}
            entries={c.remainingEntries}
            onJumpToResolve={c.jumpToResolveSlotWrapped}
            onPatchDeferral={c.patchChecklistDeferral}
          />
        </main>
      </div>

      <WorkspaceParticipantsModal
        open={c.membersModalOpen}
        onClose={() => c.setMembersModalOpen(false)}
        participants={c.sidebarParticipants}
        showInvite={Boolean(controllerInput.projectId.trim())}
        inviteDisabled={!controllerInput.projectId.trim()}
        onInviteClick={onInviteMember}
      />
    </section>
  );
}
