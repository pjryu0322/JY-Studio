"use client";

import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ServiceFlowActionMenu } from "@/components/service-flow/ServiceFlowActionMenu";
import { ServiceFlowChatPanel } from "@/components/service-flow/ServiceFlowChatPanel";
import { ServiceFlowComposer } from "@/components/service-flow/ServiceFlowComposer";
import { ServiceFlowHeader } from "@/components/service-flow/ServiceFlowHeader";
import { ServiceFlowMappingPanel } from "@/components/service-flow/ServiceFlowMappingPanel";
import { ServiceFlowProgressSummary } from "@/components/service-flow/ServiceFlowProgressSummary";
import { ServiceFlowRemainingDecisionsDialog } from "@/components/service-flow/ServiceFlowRemainingDecisionsDialog";
import { ServiceFlowSummaryPanel } from "@/components/service-flow/ServiceFlowSummaryPanel";
import { RequirementsChatComposerFooter } from "@/components/requirements/RequirementsChatComposerFooter";
import { RequirementsMembersModal } from "@/components/requirements/RequirementsMembersModal";
import { SERVICE_FLOW_STAGE_DECISION_SLOTS } from "@/components/service-flow/serviceFlowStageDerived";
import {
  serviceFlowChipRowStyle,
  serviceFlowStageComposerColumnStyle,
  serviceFlowStageMainChatStyle,
  serviceFlowStageRootSectionStyle,
  serviceFlowStageScrollAreaStyle,
  serviceFlowStageShellGridStyle,
} from "@/components/service-flow/serviceFlowStageLayout";
import { useServiceFlowStageController, type ServiceFlowStageControllerInput } from "@/components/service-flow/useServiceFlowStageController";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type RequirementsServiceFlowStageProps = ServiceFlowStageControllerInput & {
  readonly ideationReadyNotice: string;
  readonly onInviteMember: () => void;
  readonly onRetryGate: () => void;
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

  return (
    <section className="jyo-service-flow-stage" style={serviceFlowStageRootSectionStyle}>
      <style>{`
        @media (max-width: 760px) {
          .jyo-service-flow-stage-shell {
            overflow-y: auto !important;
          }
        }
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

          <div ref={w.chatScrollRef} style={serviceFlowStageScrollAreaStyle}>
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

              <ServiceFlowComposer
                value={w.input}
                onChange={w.setInput}
                onSubmit={w.sendMessage}
                disabled={c.workspaceMode !== "chat" || w.replying}
                placeholder="메시지를 입력하세요"
                onOpenActions={() => w.setToolsOpen((v) => !v)}
                textAreaRef={w.composerTextareaRef}
                actionsOpen={w.toolsOpen}
                actionMenu={
                  <ServiceFlowActionMenu
                    open={w.toolsOpen}
                    onClose={() => w.setToolsOpen(false)}
                    onOrganize={w.requestOrganize}
                    onViewResult={() => c.setWorkspaceMode("summary")}
                    onViewPrompt={() => w.setToolsOpen(false)}
                    onOpenMapping={() => c.setWorkspaceMode("mapping")}
                    projectId={controllerInput.projectId}
                    ideationReady={controllerInput.ideationReady}
                    ideationReadyNotice={ideationReadyNotice}
                    hasFlowContent={Boolean(c.actors.length || c.steps.length)}
                  />
                }
              />
            </div>
          </RequirementsChatComposerFooter>

          <ServiceFlowRemainingDecisionsDialog
            open={c.remainingPanelOpen}
            onClose={() => c.setRemainingPanelOpen(false)}
            entries={c.remainingEntries}
            onJumpToResolve={c.jumpToResolveSlotWrapped}
            onPatchDeferral={c.patchChecklistDeferral}
          />
        </main>
      </div>

      <RequirementsMembersModal
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
