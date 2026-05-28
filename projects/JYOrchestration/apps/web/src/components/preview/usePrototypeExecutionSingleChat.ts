"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { PrototypeChatBuiltMessage } from "@/lib/prototype/buildPrototypeChatMessages";
import {
  filterPersistedPrototypeExecutionMessages,
  mergePrototypeExecutionChatTimeline,
  projectPrototypeBuiltMessagesToRequirements,
} from "@/lib/prototype/prototypeBuiltMessageProjection";
import {
  postImplementationTurn,
  postPrototypeChatSlots,
} from "@/lib/prototype/prototypeExecutionSingleChatClient";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import {
  buildPrototypeExecutionSingleChatPersistPatch,
  resolvePrototypeExecutionSingleChatFromState,
} from "@/lib/prototype/prototypeExecutionSingleChatWire";

export { buildPrototypeExecutionSingleChatPersistPatch };
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import { extractMentionedAI } from "@/lib/service-design/serviceDesignMentionExtract";
import type { PrototypeChatAction } from "@/lib/prototype/buildPrototypeChatMessages";
import {
  buildImplementationBootstrapBundle,
  hasAnyValidImplementationBootstrap,
  sanitizeImplementationConversationMessages,
  type ImplementationOrchestrationSummaryInput,
} from "@/lib/prototype/implementationOrchestrationSummary";
import {
  buildImplementationTurnAssistantMessage,
  isExplicitImplementationExecutionRequest,
} from "@/lib/prototype/implementationUserFeedback";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";

export type PrototypeExecutionOperationalSendResult =
  | "handled"
  | "continue"
  | Readonly<{
      kind: "status_query";
      aiMessage: RequirementsMessage;
      timelineEntries?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      kind: "assistant_reply";
      aiMessage: RequirementsMessage;
      timelineEntries?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
      /** assistant_reply persist 직후 패널에서 실행할 후속 action */
      afterPersist?: "start_prototype_work_plan";
    }>
  | Readonly<{
      kind: "apply_conversation";
      messages: readonly RequirementsMessage[];
      timelineEntries?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
      orchestration?: PrototypeExecutionOrchestrationPersistInput;
    }>
  | Readonly<{
      kind: "timeline_only";
      timelineEntries: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
    }>
  | Readonly<{
      kind: "stage_action_run";
      run: import("@/lib/prototype/implementationStageActionRun").ImplementationStageActionRun;
    }>;

export function usePrototypeExecutionSingleChat({
  projectId,
  projectName,
  projectDescription,
  requirementsStateJson,
  mergedBuiltMessages,
  envOk,
  templateName,
  ideationSummary,
  actorFlowSummary,
  protoBusy,
  inputBlocked,
  onOperationalSend,
  onOperationalStageActionRun,
  onOperationalAfterPersist,
  onPersistStateJson,
  implementationBootstrapInput,
  envLoading = false,
  conversationResetNonce = 0,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly mergedBuiltMessages: readonly PrototypeChatBuiltMessage[];
  readonly envOk: boolean;
  readonly templateName: string;
  readonly ideationSummary: string;
  readonly actorFlowSummary: string;
  readonly protoBusy: boolean;
  readonly inputBlocked: boolean;
  readonly onOperationalSend: (
    text: string,
    userMsg: RequirementsMessage,
  ) => Promise<PrototypeExecutionOperationalSendResult>;
  readonly onOperationalStageActionRun?: (
    run: import("@/lib/prototype/implementationStageActionRun").ImplementationStageActionRun,
  ) => void;
  readonly onOperationalAfterPersist?: (action: "start_prototype_work_plan") => void;
  readonly onPersistStateJson: (patch: {
    messages: readonly RequirementsMessage[];
    slots: readonly PrototypeExecutionInterviewSlot[];
    answers: Readonly<Record<string, string>>;
    currentSlotKey: string | null;
    readonly bootstrapTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
    readonly orchestration?: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly implementationBootstrapInput?: ImplementationOrchestrationSummaryInput | null;
  readonly envLoading?: boolean;
  readonly conversationResetNonce?: number;
}) {
  const [conversationStatus, setConversationStatus] = useState<"idle" | "loading" | "loaded">("idle");
  const [conversationMessages, setConversationMessages] = useState<readonly RequirementsMessage[]>([]);
  const [slots, setSlots] = useState<readonly PrototypeExecutionInterviewSlot[]>([]);
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const [currentSlotKey, setCurrentSlotKey] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null);
  const [input, setInput] = useState("");
  const [aiInvokePending, setAiInvokePending] = useState(false);
  const slotsBootstrapRef = useRef(false);
  const implementationBootstrapRef = useRef(false);
  const actionByLabelRef = useRef<ReadonlyMap<string, PrototypeChatAction>>(new Map());

  const aiTitle = displayedWorkspaceAiTitle("prototype_build");

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid) {
      setConversationStatus("idle");
      setConversationMessages([]);
      return;
    }
    setConversationStatus("loading");
    const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
    const sanitized = sanitizeImplementationConversationMessages(resolved.messages ?? []);
    setConversationMessages(sanitized);
    setSlots(resolved.slots ?? []);
    setAnswers(resolved.answers ?? {});
    setCurrentSlotKey(resolved.currentSlotKey ?? null);
    setReplyTo(null);
    setInput("");
    setConversationStatus("loaded");
    slotsBootstrapRef.current = (resolved.slots?.length ?? 0) > 0;
    implementationBootstrapRef.current = hasAnyValidImplementationBootstrap(sanitized);
  }, [projectId, requirementsStateJson, conversationResetNonce]);

  useEffect(() => {
    slotsBootstrapRef.current = false;
    implementationBootstrapRef.current = false;
  }, [conversationResetNonce]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || conversationStatus !== "loaded" || envLoading) return;
    if (implementationBootstrapRef.current || !implementationBootstrapInput) return;
    const bootstrap = buildImplementationBootstrapBundle(implementationBootstrapInput);
    setConversationMessages((prev) => {
      const base = sanitizeImplementationConversationMessages(prev);
      if (hasAnyValidImplementationBootstrap(base)) {
        implementationBootstrapRef.current = true;
        return base;
      }
      implementationBootstrapRef.current = true;
      const next = sanitizeImplementationConversationMessages([...base, ...bootstrap.messages]);
      onPersistStateJson({
        messages: next,
        slots,
        answers,
        currentSlotKey,
        bootstrapTimeline: bootstrap.timelineEntries,
      });
      return next;
    });
  }, [
    projectId,
    conversationStatus,
    envLoading,
    implementationBootstrapInput,
    onPersistStateJson,
    slots,
    answers,
    currentSlotKey,
    conversationResetNonce,
  ]);

  const { messages: derivedMessages, actionByLabel } = useMemo(
    () => projectPrototypeBuiltMessagesToRequirements(mergedBuiltMessages),
    [mergedBuiltMessages],
  );
  actionByLabelRef.current = actionByLabel;

  const chatMessages = useMemo(
    () => mergePrototypeExecutionChatTimeline(derivedMessages, conversationMessages),
    [derivedMessages, conversationMessages],
  );

  const persistConversation = useCallback(
    (nextMessages: readonly RequirementsMessage[], nextAnswers: Readonly<Record<string, string>>, nextSlotKey: string | null) => {
      const persisted = filterPersistedPrototypeExecutionMessages(nextMessages);
      setConversationMessages(persisted);
      onPersistStateJson({
        messages: persisted,
        slots,
        answers: nextAnswers,
        currentSlotKey: nextSlotKey,
      });
    },
    [onPersistStateJson, slots],
  );

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || conversationStatus !== "loaded") return;
    if (slotsBootstrapRef.current || !envOk) return;
    slotsBootstrapRef.current = true;
    void (async () => {
      const r = await postPrototypeChatSlots({
        projectId: pid,
        projectName,
        projectDescription,
        templateName,
        ideationSummary,
        actorFlowSummary,
      });
      if (r.success && r.slots?.length) {
        setSlots(r.slots);
        setCurrentSlotKey(r.slots[0]?.key ?? null);
      }
    })();
  }, [projectId, projectName, projectDescription, templateName, ideationSummary, actorFlowSummary, envOk, conversationStatus]);

  const appendAiNotice = useCallback(
    (text: string) => {
      const body = String(text ?? "").trim();
      if (!body) return;
      const msg = newRequirementsMessage({
        role: "ai",
        speakerType: "AI",
        speakerId: "prototype_build",
        speakerName: aiTitle,
        messageType: "NOTICE",
        content: body,
        meta: { serviceDesignStage: "feature-planning", internalType: "PROTOTYPE_EXECUTION_NOTICE" },
      });
      setConversationMessages((prev) => {
        const next = [...prev, msg];
        persistConversation(next, answers, currentSlotKey);
        return next;
      });
    },
    [aiTitle, answers, currentSlotKey, persistConversation],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || inputBlocked || protoBusy || aiInvokePending) return;

    const replySnapshot = replyTo;
    if (replyTo) setReplyTo(null);
    setInput("");

    const userMsg = newRequirementsMessage({
      role: "user",
      speakerType: "USER",
      speakerId: "me",
      speakerName: "나",
      messageType: "STATEMENT",
      content: text,
      replyTo: replySnapshot?.id ?? null,
      meta: { serviceDesignStage: "implementation" },
    });

    flushSync(() => {
      setConversationMessages((prev) => [...prev, userMsg]);
    });

    const operational = await onOperationalSend(text, userMsg);
    if (operational === "handled") {
      setConversationMessages((prev) => {
        const persisted = filterPersistedPrototypeExecutionMessages(prev);
        onPersistStateJson({
          messages: persisted,
          slots,
          answers,
          currentSlotKey,
        });
        return persisted;
      });
      return;
    }
  if (operational && typeof operational === "object" && operational.kind === "stage_action_run") {
    onOperationalStageActionRun?.(operational.run);
    setConversationMessages((prev) => {
      const persisted = filterPersistedPrototypeExecutionMessages(prev);
      onPersistStateJson({
        messages: persisted,
        slots,
        answers,
        currentSlotKey,
      });
      return persisted;
    });
    return;
  }
    if (operational && typeof operational === "object" && operational.kind === "apply_conversation") {
      const persisted = filterPersistedPrototypeExecutionMessages(operational.messages);
      setConversationMessages(persisted);
      onPersistStateJson({
        messages: persisted,
        slots,
        answers,
        currentSlotKey,
        bootstrapTimeline: operational.timelineEntries,
        orchestration: operational.orchestration,
      });
      return;
    }
    if (operational && typeof operational === "object" && operational.kind === "timeline_only") {
      setConversationMessages((prev) => {
        const persisted = filterPersistedPrototypeExecutionMessages(prev);
        onPersistStateJson({
          messages: persisted,
          slots,
          answers,
          currentSlotKey,
          bootstrapTimeline: operational.timelineEntries,
        });
        return persisted;
      });
      return;
    }
    if (
      operational &&
      typeof operational === "object" &&
      (operational.kind === "status_query" || operational.kind === "assistant_reply")
    ) {
      const afterPersist = operational.kind === "assistant_reply" ? operational.afterPersist : undefined;
      setConversationMessages((prev) => {
        const next = [...prev, operational.aiMessage];
        const persisted = filterPersistedPrototypeExecutionMessages(next);
        onPersistStateJson({
          messages: persisted,
          slots,
          answers,
          currentSlotKey,
          bootstrapTimeline: operational.timelineEntries,
        });
        return persisted;
      });
      if (afterPersist === "start_prototype_work_plan") {
        onOperationalAfterPersist?.(afterPersist);
      }
      return;
    }

    const pid = projectId.trim();
    if (!pid) return;

    setAiInvokePending(true);
    try {
      const turn = await postImplementationTurn({
        projectId: pid,
        projectName,
        projectDescription,
        userMessage: text,
        userMessageId: userMsg.id,
        envOk,
        requirementsStateJson,
        mentionedAI: extractMentionedAI(text),
      });

      if (!turn.success || !turn.data?.modelResult) {
        const err = turn.message?.trim() || "구현 단계 응답을 받지 못했습니다.";
        setConversationMessages((prev) => {
          const next = [
            ...prev,
            newRequirementsMessage({
              role: "ai",
              speakerType: "AI",
              speakerId: "prototype_build",
              speakerName: aiTitle,
              messageType: "FRIENDLY_ERROR",
              content: err,
              meta: { serviceDesignStage: "implementation" },
            }),
          ];
          const persisted = filterPersistedPrototypeExecutionMessages(next);
          onPersistStateJson({
            messages: persisted,
            slots,
            answers,
            currentSlotKey,
          });
          return persisted;
        });
        return;
      }

      const { modelResult, statePatch, timelineEntries } = turn.data;
      const aiMsg = buildImplementationTurnAssistantMessage({ model: modelResult, envOk });

      let timeline = statePatch.orchestration.promptTimeline;
      for (const entry of timelineEntries) {
        timeline = appendPromptTimeline(timeline, entry);
      }

      setConversationMessages((prev) => {
        const next = [...prev, aiMsg];
        const persisted = filterPersistedPrototypeExecutionMessages(next);
        onPersistStateJson({
          messages: persisted,
          slots,
          answers,
          currentSlotKey,
          orchestration: {
            ...statePatch.orchestration,
            ...(timeline ? { promptTimeline: timeline } : {}),
          },
        });
        return persisted;
      });
    } finally {
      setAiInvokePending(false);
    }
  }, [
    input,
    inputBlocked,
    protoBusy,
    aiInvokePending,
    replyTo,
    onOperationalSend,
    onOperationalStageActionRun,
    projectId,
    projectName,
    projectDescription,
    requirementsStateJson,
    envOk,
    slots,
    answers,
    currentSlotKey,
    aiTitle,
    onPersistStateJson,
    onOperationalAfterPersist,
  ]);

  const handleInterviewSuggestionPick = useCallback((label: string) => {
    const action = actionByLabelRef.current.get(label.trim());
    if (action) return { kind: "action" as const, action };
    setInput((prev) => (prev.trim() ? `${prev.trim()}\n${label}` : label));
    return { kind: "prefill" as const };
  }, []);

  const applyPersistedMessages = useCallback(
    (messages: readonly RequirementsMessage[]) => {
      const persisted = filterPersistedPrototypeExecutionMessages(messages);
      setConversationMessages(persisted);
      implementationBootstrapRef.current = hasAnyValidImplementationBootstrap(persisted);
    },
    [],
  );

  return {
    conversationStatus,
    chatMessages,
    input,
    setInput,
    replyTo,
    setReplyTo,
    sendMessage,
    appendAiNotice,
    applyPersistedMessages,
    handleInterviewSuggestionPick,
    aiInvokePending,
    actionByLabelRef,
  };
}

