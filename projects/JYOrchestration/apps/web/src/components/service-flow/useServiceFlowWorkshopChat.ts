"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkshopMessage } from "@/components/service-flow/serviceFlowWorkshopTypes";
import {
  buildServiceFlowAiPersist,
  buildServiceFlowUserPersist,
  workshopMessageFromPersisted,
} from "@/components/service-flow/serviceFlowWorkshopBridge";
import {
  normalizeServiceFlowStepOrder,
  serviceFlowMissingSlotQuestions,
  type ServiceFlowStageSlotKey,
} from "@/components/service-flow/serviceFlowStageDerived";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import { mergeServiceFlowUserFacingMessage } from "@/lib/requirements/serviceFlowAnalyzeValidation";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type {
  RequirementsServiceFlowV1,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { postServiceFlowAnalyze } from "@/lib/requirements/serviceFlowAnalyzeClient";
import { coerceRequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { consumeWorkspaceAiScreenHandoff, peekWorkspaceAiScreenHandoff } from "@/lib/ai-member/workspaceAiHandoff";
import { shouldSuppressServiceFlowVisibleFromResponse } from "@/lib/requirements/crossStageProposalDedupe";
import {
  type ServiceFlowProposalDecision,
} from "@/lib/requirements/serviceFlowProposalDecision";
import {
  normalizeQuickRepliesToActions,
  quickActionsToLabels,
  resolveProposalDecisionFromQuickActionInput,
  type QuickAction,
  type QuickActionId,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  stripAlternativeCanvasReopenFromQuickReplies,
  type AlternativeProposalPayloadWire,
} from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  buildServiceFlowApplySyncUserMessage,
  type ServiceFlowOrchestrationSyncResult,
} from "@/lib/requirements/serviceFlowOrchestrationSync";
import { markFlowAsPrimaryProposalVariant } from "@/lib/requirements/serviceFlowProposalVariant";
import {
  buildServiceDesignHarnessPayload,
  type ServiceDesignHarnessPayload,
} from "@/lib/service-design/serviceDesignTurnPayload";
import { runServiceDesignHarnessTurn } from "@/lib/service-design/runServiceDesignHarnessTurn";

export type ServiceFlowWorkspaceMode = "chat" | "mapping" | "summary";

export type ServiceFlowQuickActionDispatch = Readonly<{
  readonly id: QuickActionId;
  readonly label: string;
}>;

function resolveDecisionFromQuickActionInput(input: {
  readonly quickAction?: ServiceFlowQuickActionDispatch | null;
  readonly labelFallback?: string | null;
}): ServiceFlowProposalDecision | null {
  return resolveProposalDecisionFromQuickActionInput({
    quickActionId: input.quickAction?.id,
    quickActionLabel: input.quickAction?.label ?? input.labelFallback,
  });
}

const GENERIC_ANALYZE_FAILURE =
  "지금은 자동 반영에 실패했습니다. 다시 시도해 주세요." as const;

function resolveServiceFlowAnalyzeFailureUx(json: unknown): {
  body: string;
  quickReplies?: string[];
} {
  const fj = json as {
    message?: string;
    meta?: { userFacingMessage?: string; quickReplies?: readonly string[] };
  };
  const body =
    String(fj.meta?.userFacingMessage ?? "").trim() ||
    String(fj.message ?? "").trim() ||
    GENERIC_ANALYZE_FAILURE;
  const quickReplies = Array.isArray(fj.meta?.quickReplies)
    ? fj.meta.quickReplies.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 3)
    : [];
  return quickReplies.length ? { body, quickReplies } : { body };
}

const SLOT_RESOLVE_USER_MESSAGES: Record<ServiceFlowStageSlotKey, string> = {
  humanActors: "사람 액터를 누가 쓰는지 정리해 주세요. 액터 목록을 사람/시스템으로 나눠 반영해 주세요.",
  systemActors: "시스템이 처리하는 역할을 액터로 정리해 주세요. 시스템 액터를 추가해 주세요.",
  mainFlow: "주요 서비스 흐름을 3단계 이상으로 다시 정리해 주세요.",
  actorResponsibility: "각 단계의 주 담당(primaryActorId)을 흐름에 맞게 반영해 주세요.",
  approvalStep: "승인/확정 단계가 필요한지와 담당을 흐름에 반영해 주세요.",
  exceptionFlow: "예외·수정·반려 같은 예외 흐름을 흐름 설명에 반영해 주세요.",
  accessControl: "권한 범위는 다음 기능정리 단계에서 진행됩니다.",
  handoffToFeatures: "세부 기능 정의는 다음 기능정리 단계에서 진행됩니다.",
};

export function useServiceFlowWorkshopChat({
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
  structureLockedAt,
  derivedSlotsForDraftBootstrap,
  onSingleChatPromptTrace,
  orchestrationContext,
  onAnalyzeStatePatch,
  onEnterActorEdit,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (
    next: RequirementsServiceFlowV1,
  ) => void | Promise<ServiceFlowOrchestrationSyncResult | null>;
  readonly currentUserId: string | null;
  readonly ideationReady: boolean;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount: number;
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
  readonly workspaceMode: ServiceFlowWorkspaceMode;
  readonly setWorkspaceMode: (m: ServiceFlowWorkspaceMode) => void;
  readonly structureLockedAt: string | null | undefined;
  readonly derivedSlotsForDraftBootstrap: Record<ServiceFlowStageSlotKey, boolean>;
  readonly onSingleChatPromptTrace?: (entry: RequirementsPromptTimelineEntry) => void;
  readonly orchestrationContext?: Readonly<{
    singleChatOrchestrationV1?: unknown;
    requirementsOrchestrationStageV1?: unknown;
    featurePlanningSlotsV1?: unknown;
  }>;
  readonly onAnalyzeStatePatch?: (patch: Partial<RequirementsStateJson>) => void | Promise<void>;
  readonly onEnterActorEdit?: () => void;
}) {
  const aiDisplayName = IDEATION_AI_DISPLAY_NAME;
  const displayMessages = useMemo(
    () => persistedServiceFlowMessages.map((m) => workshopMessageFromPersisted(m, aiDisplayName)),
    [persistedServiceFlowMessages, aiDisplayName],
  );

  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [quickActions, setQuickActions] = useState<readonly QuickAction[] | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);
  const [alternativeCanvasOpen, setAlternativeCanvasOpen] = useState(false);
  const [pendingStatusLabel, setPendingStatusLabel] = useState<string | null>(null);
  const alternativePayloadRef = useRef<AlternativeProposalPayloadWire | null>(null);

  const clearReplyingState = useCallback(() => {
    setReplying(false);
    setPendingStatusLabel(null);
  }, []);
  const [latestAiQuestion, setLatestAiQuestion] = useState<string>("");
  const [toolsOpen, setToolsOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollPendingRef = useRef(false);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const onAppendRef = useRef(onAppendPersistedServiceFlowMessages);
  const onChangeFlowRef = useRef(onChangeFlow);
  const onAnalyzeStatePatchRef = useRef(onAnalyzeStatePatch);
  const orchestrationContextRef = useRef(orchestrationContext);
  const onSingleChatPromptTraceRef = useRef(onSingleChatPromptTrace);
  useEffect(() => {
    onSingleChatPromptTraceRef.current = onSingleChatPromptTrace;
  }, [onSingleChatPromptTrace]);

  const emitPromptTrace = useCallback((raw: unknown) => {
    const tr = coerceRequirementsPromptTimelineEntry(raw);
    if (tr) onSingleChatPromptTraceRef.current?.(tr);
  }, []);
  useEffect(() => {
    onAppendRef.current = onAppendPersistedServiceFlowMessages;
  }, [onAppendPersistedServiceFlowMessages]);
  useEffect(() => {
    onChangeFlowRef.current = onChangeFlow;
  }, [onChangeFlow]);
  useEffect(() => {
    onAnalyzeStatePatchRef.current = onAnalyzeStatePatch;
  }, [onAnalyzeStatePatch]);
  useEffect(() => {
    orchestrationContextRef.current = orchestrationContext;
  }, [orchestrationContext]);

  const scrollChatToBottom = useCallback(() => {
    autoScrollPendingRef.current = true;
    window.requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      autoScrollPendingRef.current = false;
    });
  }, []);

  const resizeComposer = useCallback(() => {
    const el = composerTextareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  const messagesRef = useRef<WorkshopMessage[]>(displayMessages);
  const flowRef = useRef<RequirementsServiceFlowV1 | null>(flow);
  const latestAiQuestionRef = useRef<string>(latestAiQuestion);
  useEffect(() => {
    messagesRef.current = displayMessages;
  }, [displayMessages]);
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  useEffect(() => {
    latestAiQuestionRef.current = latestAiQuestion;
  }, [latestAiQuestion]);

  const takeActorFlowHandoff = useCallback(
    () => (projectId.trim() ? consumeWorkspaceAiScreenHandoff(projectId.trim(), "actor_flow") : ""),
    [projectId],
  );

  const callAnalyze = useCallback(
    (
      userMessageText: string,
      opts?: {
        silentUserAppend?: boolean;
        harness?: ServiceDesignHarnessPayload;
        responsePolicy?: unknown;
        quickAction?: ServiceFlowQuickActionDispatch | null;
        quickActionLabel?: string | null;
      }
    ) => {
      if (workspaceMode !== "chat") return;
      const body = userMessageText.trim();
      if (!body) return;
      const quickAction = opts?.quickAction ?? null;
      const quickActionLabelEarly =
        String(quickAction?.label ?? opts?.quickActionLabel ?? "").trim() || null;
      const pendingDecision = resolveDecisionFromQuickActionInput({
        quickAction,
        labelFallback: quickActionLabelEarly,
      });
      if (pendingDecision === "ALTERNATIVE") {
        setPendingStatusLabel("다른 대안을 생성하고 있습니다…");
      } else if (pendingDecision === "APPLY") {
        setPendingStatusLabel("추천안을 반영하고 있습니다…");
      } else if (pendingDecision === "REVIEW_FLOW") {
        setPendingStatusLabel("흐름을 정리하고 있습니다…");
      } else if (
        pendingDecision === "NEXT_STAGE" ||
        pendingDecision === "FEATURE_DETAIL" ||
        pendingDecision === "FLOW_APPROVE"
      ) {
        setPendingStatusLabel("다음 단계로 전환하고 있습니다…");
      } else if (quickActionLabelEarly) {
        setPendingStatusLabel("요청을 처리하고 있습니다…");
      } else {
        setPendingStatusLabel("AI 기획자가 응답을 준비하고 있습니다…");
      }
      setReplying(true);
      setQuickReplies(null);
      setQuickActions(null);

      void (async () => {
        try {
          if (!opts?.silentUserAppend) {
            autoScrollPendingRef.current = true;
            const userPersisted = buildServiceFlowUserPersist(body, currentUserId);
            const nextSlice = await onAppendRef.current([userPersisted]);
            messagesRef.current = nextSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          }

          const transcript = [...(messagesRef.current ?? [])];
          const recentMessages = transcript
            .slice(-24)
            .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.body}`)
            .join("\n")
            .slice(0, 12000);

          const priorScreenHandoff = takeActorFlowHandoff();
          const harness = await runServiceDesignHarnessTurn({
            input: body,
            stage: "service-flow",
            mentionedAI: opts?.harness?.mentionedAI ?? null,
          });
          console.debug("[HARNESS CHECK]", {
            stage: "service-flow",
            path: "callAnalyze",
            runHarnessExecuted: true,
          });
          console.debug("[HARNESS FLOW]", {
            stage: "service-flow",
            input: body,
            mentionedAI: harness.mentionedAI,
          });

          const payload = opts?.harness ?? buildServiceDesignHarnessPayload("service-flow", body);
          const responsePolicy = harness.responsePolicy ?? opts?.responsePolicy ?? undefined;
          const quickActionLabel =
            String(quickAction?.label ?? opts?.quickActionLabel ?? "").trim() || undefined;
          const quickActionId = quickAction?.id;
          const proposalDecision = resolveDecisionFromQuickActionInput({
            quickAction,
            labelFallback: quickActionLabel,
          });

          const orchCtx = orchestrationContextRef.current;
          const result = await postServiceFlowAnalyze({
            projectId,
            projectName,
            projectDescription,
            ideationAssets,
            userMessage: body,
            currentFlow: flowRef.current,
            recentMessages,
            latestAiQuestion: latestAiQuestionRef.current,
            ...(priorScreenHandoff ? { priorScreenHandoff } : {}),
            ...(opts?.silentUserAppend ? { autoHandoff: true } : {}),
            ...(quickActionId ? { quickActionId } : {}),
            ...(quickActionLabel ? { quickActionLabel } : {}),
            ...(proposalDecision ? { proposalDecision } : {}),
            ...(orchCtx?.singleChatOrchestrationV1 !== undefined
              ? { singleChatOrchestrationV1: orchCtx.singleChatOrchestrationV1 }
              : {}),
            ...(orchCtx?.requirementsOrchestrationStageV1 !== undefined
              ? { requirementsOrchestrationStageV1: orchCtx.requirementsOrchestrationStageV1 }
              : {}),
            ...(orchCtx?.featurePlanningSlotsV1 !== undefined
              ? { featurePlanningSlotsV1: orchCtx.featurePlanningSlotsV1 }
              : {}),
            serviceDesignStage: harness.stage,
            mentionedAI: harness.mentionedAI,
            ...(responsePolicy ? { responsePolicy } : {}),
          });

          if (result.ok) {
            emitPromptTrace(result.meta?.promptTrace);
          } else {
            const fj = result.json as { meta?: { promptTrace?: unknown } };
            emitPromptTrace(fj?.meta?.promptTrace);
          }

          if (!result.ok || !result.data.updatedFlow) {
            autoScrollPendingRef.current = true;
            const failureUx = result.ok
              ? { body: GENERIC_ANALYZE_FAILURE }
              : resolveServiceFlowAnalyzeFailureUx(result.json);
            const errSlice = await onAppendRef.current([
              buildServiceFlowAiPersist(failureUx.body, {
                ...(failureUx.quickReplies?.length
                  ? { interviewSuggestions: failureUx.quickReplies }
                  : {}),
              }),
            ]);
            if (failureUx.quickReplies?.length) setQuickReplies(failureUx.quickReplies);
            messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
            clearReplyingState();
            return;
          }

          const data = result.data;
          const nextFlow = data.updatedFlow;
          const altPayload = nextFlow?.alternativeProposalPayload ?? null;
          if (altPayload) {
            alternativePayloadRef.current = altPayload;
            if (data.openAlternativeCanvas) setAlternativeCanvasOpen(true);
          }
          if (!nextFlow) {
            autoScrollPendingRef.current = true;
            const errSlice = await onAppendRef.current([
              buildServiceFlowAiPersist(GENERIC_ANALYZE_FAILURE),
            ]);
            messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
            clearReplyingState();
            return;
          }
          const statePatch = result.meta?.requirementsStatePatch;
          if (statePatch && onAnalyzeStatePatchRef.current) {
            await Promise.resolve(onAnalyzeStatePatchRef.current(statePatch));
          }
          const slotSync = await Promise.resolve(onChangeFlowRef.current(nextFlow));

          const suppressVisible = shouldSuppressServiceFlowVisibleFromResponse(data);
          const nextQ = String(data.nextQuestion ?? "").trim();
          if (nextQ && !suppressVisible) setLatestAiQuestion(nextQ);

          const normalizedActions = normalizeQuickRepliesToActions(
            Array.isArray(data.quickReplies) ? data.quickReplies : [],
          );
          const replies = stripAlternativeCanvasReopenFromQuickReplies(
            quickActionsToLabels(normalizedActions),
          );
          const actionsAfterCanvas = normalizeQuickRepliesToActions(replies);
          if (!suppressVisible) {
            setQuickActions(actionsAfterCanvas.length ? actionsAfterCanvas : null);
            setQuickReplies(replies.length ? replies : null);
          } else {
            setQuickActions(null);
            setQuickReplies(null);
          }

          if (suppressVisible) {
            clearReplyingState();
            return;
          }

          const applySyncBody =
            pendingDecision === "APPLY" && slotSync
              ? buildServiceFlowApplySyncUserMessage({ flow: nextFlow, sync: slotSync })
              : null;
          const aiBody =
            applySyncBody ||
            mergeServiceFlowUserFacingMessage(String(data.assistantMessage ?? "").trim(), nextQ || null) ||
            "반영했습니다.";
          const done = !nextQ && Boolean(data.readiness?.readyForNext);
          autoScrollPendingRef.current = true;
          const combined =
            aiBody + (done ? "\n\n기본 운영 흐름이 정리되었습니다.\n추가 수정사항이 있으면 말씀해 주세요." : "");
          const okSlice = await onAppendRef.current([
            buildServiceFlowAiPersist(combined, {
              interviewSuggestions: replies.length ? replies : undefined,
            }),
          ]);
          messagesRef.current = okSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          clearReplyingState();
        } catch {
          autoScrollPendingRef.current = true;
          try {
            const errSlice = await onAppendRef.current([
              buildServiceFlowAiPersist(GENERIC_ANALYZE_FAILURE),
            ]);
            messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          } finally {
            clearReplyingState();
          }
        }
      })();
    },
    [
      workspaceMode,
      currentUserId,
      aiDisplayName,
      projectId,
      projectName,
      projectDescription,
      ideationAssets,
      takeActorFlowHandoff,
      emitPromptTrace,
      clearReplyingState,
    ],
  );

  const callAnalyzeRef = useRef(callAnalyze);
  useEffect(() => {
    callAnalyzeRef.current = callAnalyze;
  }, [callAnalyze]);

  useEffect(() => {
    if (flow?.alternativeProposalPayload) {
      alternativePayloadRef.current = flow.alternativeProposalPayload;
    }
  }, [flow?.alternativeProposalPayload]);

  const openAlternativeCanvas = useCallback(() => {
    const payload =
      flowRef.current?.alternativeProposalPayload ?? alternativePayloadRef.current;
    if (!payload) return;
    alternativePayloadRef.current = payload;
    setAlternativeCanvasOpen(true);
  }, []);

  const dispatchClientOnlyDecision = useCallback(
    (decision: ServiceFlowProposalDecision, _chip: string | null, quickActionId?: QuickActionId | null): boolean => {
      if (quickActionId === "ADD_ACTOR") {
        onEnterActorEdit?.();
        return true;
      }
      if (decision === "VIEW_ALTERNATIVE_DETAIL") {
        openAlternativeCanvas();
        return true;
      }
      if (decision === "KEEP_PRIMARY") {
        const payload =
          flowRef.current?.alternativeProposalPayload ?? alternativePayloadRef.current;
        if (payload?.baselineFlow) {
          onChangeFlowRef.current({
            ...markFlowAsPrimaryProposalVariant(payload.baselineFlow),
            alternativeProposalPayload: null,
          });
          alternativePayloadRef.current = null;
          setAlternativeCanvasOpen(false);
          setQuickReplies(null);
          setQuickActions(null);
        }
        return true;
      }
      return false;
    },
    [openAlternativeCanvas, onEnterActorEdit],
  );

  const sendMessage = useCallback(
    (
      harnessFromComposer?: ServiceDesignHarnessPayload,
      overrideText?: string,
      quickAction?: ServiceFlowQuickActionDispatch | null,
    ) => {
      if (workspaceMode !== "chat") return;
      const body = (overrideText ?? input).trim();
      if (!body) return;
      const payload = harnessFromComposer ?? buildServiceDesignHarnessPayload("service-flow", body);
      const decision = resolveDecisionFromQuickActionInput({
        quickAction,
        labelFallback: quickAction?.label ?? body,
      });
      if (quickAction?.id === "ADD_ACTOR") {
        onEnterActorEdit?.();
        setInput("");
        return;
      }
      if (decision && dispatchClientOnlyDecision(decision, quickAction?.label ?? null, quickAction?.id ?? null)) {
        setInput("");
        return;
      }
      setInput("");
      callAnalyze(body, {
        harness: payload,
        ...(quickAction ? { quickAction } : {}),
        ...(quickAction?.label ? { quickActionLabel: quickAction.label } : {}),
      });
      scrollChatToBottom();
    },
    [workspaceMode, input, callAnalyze, scrollChatToBottom, dispatchClientOnlyDecision],
  );

  const jumpToResolveSlot = useCallback(
    (key: ServiceFlowStageSlotKey) => {
      if (key === "actorResponsibility" && flowRef.current?.structureLockedAt) {
        setWorkspaceMode("mapping");
        return;
      }
      setWorkspaceMode("chat");
      window.setTimeout(() => {
        callAnalyzeRef.current(SLOT_RESOLVE_USER_MESSAGES[key]);
      }, 0);
    },
    [setWorkspaceMode],
  );

  const requestOrganize = useCallback(() => {
    if (workspaceMode !== "chat") return;
    setToolsOpen(false);
    setReplying(true);
    void (async () => {
      const excerpt = [...displayMessages, { id: "tmp", role: "user" as const, name: "사용자", body: "(정리 요청)" }]
        .slice(-24)
        .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.body}`)
        .join("\n")
        .slice(0, 12000);
      try {
        const priorScreenHandoff = takeActorFlowHandoff();
        const organizeMsg =
          "정리 요청: 지금까지의 대화와 기존 초안을 바탕으로 액터/흐름/담당 매핑을 최신 상태로 다시 정리해 주세요.";
        const organizeHarness = buildServiceDesignHarnessPayload("service-flow", organizeMsg);
        const harness = await runServiceDesignHarnessTurn({
          input: organizeMsg,
          stage: "service-flow",
          mentionedAI: null,
        });
        console.debug("[HARNESS CHECK]", { stage: "service-flow", path: "requestOrganize", runHarnessExecuted: true });
        console.debug("[HARNESS FLOW]", {
          stage: "service-flow",
          input: organizeMsg,
          mentionedAI: harness.mentionedAI,
        });
        const result = await postServiceFlowAnalyze({
          projectId,
          projectName,
          projectDescription,
          ideationAssets,
          userMessage: organizeMsg,
          recentMessages: excerpt,
          latestAiQuestion,
          currentFlow: flow,
          ...(priorScreenHandoff ? { priorScreenHandoff } : {}),
          serviceDesignStage: harness.stage,
          mentionedAI: harness.mentionedAI,
          responsePolicy: harness.responsePolicy,
        });
        if (result.ok) {
          emitPromptTrace(result.meta?.promptTrace);
        } else {
          const fj = result.json as { meta?: { promptTrace?: unknown } };
          emitPromptTrace(fj?.meta?.promptTrace);
        }
        if (!result.ok || !result.data.updatedFlow) {
          const failureUx = result.ok
            ? { body: GENERIC_ANALYZE_FAILURE }
            : resolveServiceFlowAnalyzeFailureUx(result.json);
          const errSlice = await onAppendRef.current([
            buildServiceFlowAiPersist(failureUx.body, {
              ...(failureUx.quickReplies?.length ? { interviewSuggestions: failureUx.quickReplies } : {}),
            }),
          ]);
          if (failureUx.quickReplies?.length) setQuickReplies(failureUx.quickReplies);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          clearReplyingState();
          return;
        }
        const organizedFlow = result.data.updatedFlow;
        onChangeFlowRef.current(organizedFlow);
        const nextQ = String(result.data?.nextQuestion ?? "").trim();
        if (nextQ) setLatestAiQuestion(nextQ);
        setQuickReplies(null);
        const organizeBody = mergeServiceFlowUserFacingMessage(
          String(result.data?.assistantMessage ?? "").trim() || "정리했습니다.",
          nextQ || null,
        );
        const okSlice = await onAppendRef.current([buildServiceFlowAiPersist(organizeBody)]);
        messagesRef.current = okSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        setWorkspaceMode("summary");
        clearReplyingState();
      } catch {
        try {
          const errSlice = await onAppendRef.current([buildServiceFlowAiPersist("자동 정리에 실패했습니다. 다시 시도해주세요.")]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        } finally {
          clearReplyingState();
        }
      }
    })();
  }, [
    workspaceMode,
    displayMessages,
    projectId,
    projectName,
    projectDescription,
    ideationAssets,
    latestAiQuestion,
    flow,
    aiDisplayName,
    setWorkspaceMode,
    takeActorFlowHandoff,
    emitPromptTrace,
  ]);

  useEffect(() => {
    if (structureLockedAt) return;
    if (draftGenerationCount <= 0) return;
    const timer = window.setTimeout(() => {
      const qs = serviceFlowMissingSlotQuestions(derivedSlotsForDraftBootstrap, 3);
      const body =
        "초안을 준비했습니다. 수정할 부분만 말씀해 주세요.\n" +
        (qs.length ? `\n(빠르게 확인)\n${qs.map((q) => `- ${q}`).join("\n")}` : "");
      void onAppendRef.current([buildServiceFlowAiPersist(body)]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftGenerationCount, derivedSlotsForDraftBootstrap, structureLockedAt]);

  const bootOnceRef = useRef(false);
  useEffect(() => {
    if (structureLockedAt) return;
    if (workspaceMode !== "chat") return;
    if (bootOnceRef.current) return;
    if (replying) return;
    if (persistedServiceFlowMessages.length > 0) return;
    if (!ideationReady) return;
    if (generatingDraft) return;

    const hasSteps = Boolean(flow?.steps?.length);
    const hasAnyFlow = Boolean(flow?.actors?.length || flow?.steps?.length);
    const hasIdeationAssets = (ideationAssets?.length ?? 0) > 0;

    if (hasSteps) {
      const handoffPeek = projectId.trim() ? peekWorkspaceAiScreenHandoff(projectId.trim(), "actor_flow") : "";
      const ideationHandoff = /이전\s*담당:\s*ideation/i.test(handoffPeek);
      bootOnceRef.current = true;
      if (ideationHandoff) {
        callAnalyzeRef.current("서비스 흐름 인터뷰 시작", { silentUserAppend: true });
        return;
      }
      const list = normalizeServiceFlowStepOrder(flow?.steps ?? [])
        .slice(0, 8)
        .map((s) => `${s.order}. ${s.title}`)
        .join("\n");
      void onAppendRef.current([
        buildServiceFlowAiPersist(
          `아이디어 구체화 단계에서 다음 흐름이 정리되었습니다.\n\n${list}\n\n다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.`,
          { interviewSuggestions: ["그대로 진행", "단계 수정", "빠진 단계 추가"] },
        ),
      ]);
      return;
    }

    if (hasIdeationAssets && !hasAnyFlow) return;

    bootOnceRef.current = true;
    callAnalyzeRef.current("서비스 흐름 인터뷰 시작", { silentUserAppend: true });
  }, [
    replying,
    persistedServiceFlowMessages.length,
    ideationReady,
    generatingDraft,
    flow?.steps?.length,
    flow?.actors?.length,
    ideationAssets?.length,
    structureLockedAt,
    workspaceMode,
    flow,
  ]);

  useEffect(() => {
    if (!autoScrollPendingRef.current) return;
    scrollChatToBottom();
  }, [displayMessages.length, replying, scrollChatToBottom]);

  const alternativeCanvasPayload =
    flow?.alternativeProposalPayload ?? alternativePayloadRef.current;

  const closeAlternativeCanvas = useCallback(() => setAlternativeCanvasOpen(false), []);

  const applyAlternativeFromCanvas = useCallback(() => {
    setAlternativeCanvasOpen(false);
    sendMessage(
      buildServiceDesignHarnessPayload("service-flow", "이 대안 적용"),
      "이 대안 적용",
      { id: "APPLY_ALTERNATIVE", label: "이 대안 적용" },
    );
  }, [sendMessage]);

  const keepPrimaryFromCanvas = useCallback(() => {
    dispatchClientOnlyDecision("KEEP_PRIMARY", "기존안 유지");
  }, [dispatchClientOnlyDecision]);

  const regenerateAlternativeFromCanvas = useCallback(() => {
    setAlternativeCanvasOpen(false);
    sendMessage(
      buildServiceDesignHarnessPayload("service-flow", "다른 대안 보기"),
      "다른 대안 보기",
      { id: "GENERATE_ALTERNATIVE", label: "다른 대안 다시 생성" },
    );
  }, [sendMessage]);

  return {
    aiDisplayName,
    displayMessages,
    input,
    setInput,
    replying,
    pendingStatusLabel,
    quickActions,
    quickReplies,
    setQuickReplies,
    latestAiQuestion,
    setLatestAiQuestion,
    toolsOpen,
    setToolsOpen,
    chatScrollRef,
    composerTextareaRef,
    scrollChatToBottom,
    resizeComposer,
    callAnalyze,
    sendMessage,
    jumpToResolveSlot,
    requestOrganize,
    alternativeCanvasOpen,
    alternativeCanvasPayload,
    closeAlternativeCanvas,
    openAlternativeCanvas,
    applyAlternativeFromCanvas,
    keepPrimaryFromCanvas,
    regenerateAlternativeFromCanvas,
  };
}
