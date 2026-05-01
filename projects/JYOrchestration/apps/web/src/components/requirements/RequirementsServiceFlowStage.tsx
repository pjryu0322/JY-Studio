"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
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
import {
  applyRecommendedServiceFlowPrimaryActors,
  computeServiceFlowDecisionResolution,
  deriveServiceFlowApprovalFromFlow,
  normalizeServiceFlowStepOrder,
  SERVICE_FLOW_STAGE_DECISION_SLOTS,
  serviceFlowProgressHint,
  unresolvedServiceFlowChecklistEntries,
  type ServiceFlowStageSlotKey,
} from "@/components/service-flow/serviceFlowStageDerived";
import { serviceFlowStageBtnStyle } from "@/components/service-flow/serviceFlowStageUi";
import {
  serviceFlowSidebarParticipants,
  type ServiceFlowProjectMember,
} from "@/components/service-flow/serviceFlowWorkshopBridge";
import { useServiceFlowWorkshopChat, type ServiceFlowWorkspaceMode } from "@/components/service-flow/useServiceFlowWorkshopChat";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type {
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
  RequirementsServiceFlowChecklistDeferralKind,
} from "@/lib/requirements/requirementsStateJson";

const shell: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  alignItems: "stretch",
  overflow: "hidden",
  background: "#fff",
};

const chatWrap: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  position: "relative",
};

export function RequirementsServiceFlowStage({
  projectId,
  projectName,
  projectDescription,
  ideationParticipantHumanMemberIds,
  ideationAssets,
  ideationReady,
  ideationReadyNotice,
  flow,
  onChangeFlow,
  generatingDraft,
  draftGenerationCount = 0,
  members,
  currentUserId,
  onInviteMember,
  onRetryGate,
  persistedServiceFlowMessages,
  onAppendPersistedServiceFlowMessages,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationParticipantHumanMemberIds: readonly string[];
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount?: number;
  readonly members: readonly ServiceFlowProjectMember[];
  readonly currentUserId: string | null;
  readonly onInviteMember: () => void;
  readonly onRetryGate: () => void;
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
}) {
  const showScreenLabels = useShowScreenLabels();
  const [workspaceMode, setWorkspaceMode] = useState<ServiceFlowWorkspaceMode>("chat");
  const [remainingPanelOpen, setRemainingPanelOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);

  const derivedApproval = useMemo(() => deriveServiceFlowApprovalFromFlow(flow), [flow]);
  const hint = serviceFlowProgressHint(derivedApproval);
  const structureLocked = Boolean(flow?.structureLockedAt);
  const deferrals = flow?.checklistDeferrals ?? null;
  const decision = useMemo(
    () => computeServiceFlowDecisionResolution({ flow, derivedSlots: derivedApproval.slots, deferrals }),
    [flow, derivedApproval.slots, deferrals],
  );
  const chatActive = workspaceMode === "chat";
  const mappingActive = workspaceMode === "mapping";
  const summaryActive = workspaceMode === "summary";

  const {
    displayMessages,
    input,
    setInput,
    replying,
    quickReplies,
    toolsOpen,
    setToolsOpen,
    chatScrollRef,
    composerTextareaRef,
    callAnalyze,
    sendMessage,
    jumpToResolveSlot,
    requestOrganize,
  } = useServiceFlowWorkshopChat({
    projectId,
    projectName,
    projectDescription,
    ideationAssets,
    flow,
    onChangeFlow,
    currentUserId,
    ideationReady,
    generatingDraft,
    draftGenerationCount,
    persistedServiceFlowMessages,
    onAppendPersistedServiceFlowMessages,
    workspaceMode,
    setWorkspaceMode,
    structureLockedAt: flow?.structureLockedAt,
    derivedSlotsForDraftBootstrap: derivedApproval.slots,
  });

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeServiceFlowStepOrder(flow?.steps ?? []), [flow?.steps]);
  const sidebarParticipants = useMemo(
    () => serviceFlowSidebarParticipants(members, currentUserId, ideationParticipantHumanMemberIds, replying),
    [members, currentUserId, ideationParticipantHumanMemberIds, replying],
  );

  const patchChecklistDeferral = (key: ServiceFlowStageSlotKey, kind: RequirementsServiceFlowChecklistDeferralKind | null) => {
    if (!flow) return;
    const now = new Date().toISOString();
    const next: Partial<Record<ServiceFlowStageSlotKey, RequirementsServiceFlowChecklistDeferralKind>> = {
      ...(flow.checklistDeferrals ?? {}),
    };
    if (kind === null) delete next[key];
    else next[key] = kind;
    const checklistDeferrals = Object.keys(next).length ? next : null;
    onChangeFlow({ ...flow, checklistDeferrals, updatedAt: now });
  };

  const reapplyRecommendedOwners = () => {
    if (!flow?.structureLockedAt) return;
    const now = new Date().toISOString();
    const next = applyRecommendedServiceFlowPrimaryActors({ ...flow, updatedAt: now });
    onChangeFlow({ ...next, structureLockedAt: flow.structureLockedAt ?? now, updatedAt: now });
  };

  const updateStep = (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => {
    if (!flow) return;
    const now = new Date().toISOString();
    const nextSteps = flow.steps.map((s) => {
      if (s.id !== id) return s;
      const merged: RequirementsServiceFlowStepV1 = { ...s, ...patch, updatedAt: now };
      if (!("approved" in patch)) merged.approved = false;
      return merged;
    });
    onChangeFlow({ ...flow, steps: normalizeServiceFlowStepOrder(nextSteps), updatedAt: now });
  };

  const jumpToResolveSlotWrapped = (key: ServiceFlowStageSlotKey) => {
    setRemainingPanelOpen(false);
    jumpToResolveSlot(key);
  };

  const remainingEntries = useMemo(
    () => unresolvedServiceFlowChecklistEntries(derivedApproval.slots, deferrals),
    [derivedApproval.slots, deferrals],
  );

  return (
    <section
      className="jyo-service-flow-stage"
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
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

      <div
        className="jyo-service-flow-stage-shell"
        style={{
          ...shell,
          gridTemplateColumns: "minmax(0, 1fr)",
          height: "100%",
        }}
      >
        <main className="jyo-service-flow-chat-shell" style={chatWrap} aria-label="액터 및 서비스 흐름 작업 영역">
          <ScreenLabel label="요구사항-서비스흐름-참여멤버" visible={showScreenLabels} />
          <ServiceFlowHeader
            progressPercent={derivedApproval.progressPercent}
            filledSlotCount={derivedApproval.filledSlotCount}
            progressSlotTotal={SERVICE_FLOW_STAGE_DECISION_SLOTS.length}
            onOpenRemaining={() => setRemainingPanelOpen(true)}
            hint={hint}
            memberControls={{
              count: sidebarParticipants.length,
              onOpen: () => setMembersModalOpen(true),
            }}
          />
          {ideationReady && chatActive ? (
            <ServiceFlowProgressSummary hint={hint} helperLine={decision.helperLine} />
          ) : null}

          <div
            ref={chatScrollRef}
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              padding: "12px 20px 14px",
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            {!ideationReady ? (
              <div style={{ border: "1px solid #fde68a", borderRadius: 14, padding: 12, background: "#fffbeb", maxWidth: 620 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.5 }}>{ideationReadyNotice}</div>
                <button type="button" onClick={onRetryGate} style={{ ...serviceFlowStageBtnStyle, marginTop: 8 }}>
                  다시 확인
                </button>
              </div>
            ) : null}
            {ideationReady && summaryActive ? (
              <ServiceFlowSummaryPanel
                actors={actors}
                steps={steps}
                derivedApproval={derivedApproval}
                decision={decision}
                hint={hint}
                onPatchDeferral={patchChecklistDeferral}
              />
            ) : null}
            {ideationReady && mappingActive ? (
              <ServiceFlowMappingPanel
                structureLocked={structureLocked}
                steps={steps}
                actors={actors}
                onReapplyRecommended={reapplyRecommendedOwners}
                onUpdateStepPrimary={(stepId, primaryActorId) => updateStep(stepId, { primaryActorId })}
              />
            ) : null}
            <ServiceFlowChatPanel
              messages={displayMessages}
              replying={replying}
              generatingDraft={generatingDraft}
              structureLocked={structureLocked}
              chatActive={chatActive}
              ideationReady={ideationReady}
            />
          </div>

          <RequirementsChatComposerFooter>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 720, margin: "0 auto", minWidth: 0 }}>
              {ideationReady && chatActive && quickReplies && quickReplies.length && !replying ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {quickReplies.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => callAnalyze(label)}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        borderRadius: 999,
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0f172a",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {ideationReady && chatActive && !replying && (!quickReplies || !quickReplies.length) ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(() => {
                    const shouldShowApproval = !decision.requiredUnresolved.length && decision.optionalUnresolved.includes("approvalStep");
                    const shouldShowException = !decision.requiredUnresolved.length && decision.optionalUnresolved.includes("exceptionFlow");

                    const base =
                      steps.length >= 1
                        ? []
                        : [
                            {
                              label: "액터 추가",
                              action: () => callAnalyze("액터를 추가해 주세요. 사람 액터와 시스템 액터를 분리해 정리해 주세요."),
                            },
                            {
                              label: "흐름 정리",
                              action: () =>
                                callAnalyze("주요 서비스 흐름을 3단계 이상으로 정리해 주세요. 각 단계 제목/목적/담당을 포함해 주세요."),
                            },
                          ];

                    const extras =
                      steps.length >= 1
                        ? [
                            ...(shouldShowApproval
                              ? [
                                  {
                                    label: "승인 추가",
                                    action: () =>
                                      callAnalyze("승인/확정 단계가 필요합니다. 승인 단계를 흐름에 추가하고 담당도 지정해 주세요."),
                                  },
                                ]
                              : []),
                            ...(shouldShowException
                              ? [
                                  {
                                    label: "예외 흐름",
                                    action: () =>
                                      callAnalyze("수정 요청/반려 같은 예외 흐름이 필요합니다. 예외 단계를 흐름에 반영해 주세요."),
                                  },
                                ]
                              : []),
                          ]
                        : [];

                    return [...base, ...extras];
                  })().map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      onClick={it.action}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        borderRadius: 999,
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0f172a",
                        cursor: "pointer",
                      }}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <ServiceFlowComposer
                value={input}
                onChange={setInput}
                onSubmit={sendMessage}
                disabled={workspaceMode !== "chat" || replying}
                placeholder="메시지를 입력하세요"
                onOpenActions={() => setToolsOpen((v) => !v)}
                textAreaRef={composerTextareaRef}
                actionsOpen={toolsOpen}
                actionMenu={
                  <ServiceFlowActionMenu
                    open={toolsOpen}
                    onClose={() => setToolsOpen(false)}
                    onOrganize={requestOrganize}
                    onViewResult={() => setWorkspaceMode("summary")}
                    onViewPrompt={() => setToolsOpen(false)}
                    onOpenMapping={() => setWorkspaceMode("mapping")}
                    projectId={projectId}
                    ideationReady={ideationReady}
                    ideationReadyNotice={ideationReadyNotice}
                    hasFlowContent={Boolean(actors.length || steps.length)}
                  />
                }
              />
            </div>
          </RequirementsChatComposerFooter>

          <ServiceFlowRemainingDecisionsDialog
            open={remainingPanelOpen}
            onClose={() => setRemainingPanelOpen(false)}
            entries={remainingEntries}
            onJumpToResolve={jumpToResolveSlotWrapped}
            onPatchDeferral={patchChecklistDeferral}
          />
        </main>
      </div>

      <RequirementsMembersModal
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        participants={sidebarParticipants}
        showInvite={Boolean(projectId.trim())}
        inviteDisabled={!projectId.trim()}
        onInviteClick={onInviteMember}
      />
    </section>
  );
}
