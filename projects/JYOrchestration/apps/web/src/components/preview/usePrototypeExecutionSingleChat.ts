"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrototypeChatBuiltMessage } from "@/lib/prototype/buildPrototypeChatMessages";
import {
  filterPersistedPrototypeExecutionMessages,
  mergePrototypeExecutionChatTimeline,
  projectPrototypeBuiltMessagesToRequirements,
} from "@/lib/prototype/prototypeBuiltMessageProjection";
import { postPrototypeChatSlots, postPrototypeChatTurn } from "@/lib/prototype/prototypeExecutionSingleChatClient";
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
  hasValidImplementationLeadBootstrap,
  sanitizeImplementationConversationMessages,
  type ImplementationOrchestrationSummaryInput,
} from "@/lib/prototype/implementationOrchestrationSummary";

export type PrototypeExecutionOperationalSendResult = "handled" | "continue";

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
  readonly onOperationalSend: (text: string) => Promise<PrototypeExecutionOperationalSendResult>;
  readonly onPersistStateJson: (patch: {
    messages: readonly RequirementsMessage[];
    slots: readonly PrototypeExecutionInterviewSlot[];
    answers: Readonly<Record<string, string>>;
    currentSlotKey: string | null;
    readonly bootstrapTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
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
    implementationBootstrapRef.current = hasValidImplementationLeadBootstrap(sanitized);
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
      if (hasValidImplementationLeadBootstrap(base)) {
        implementationBootstrapRef.current = true;
        return base;
      }
      implementationBootstrapRef.current = true;
      const next = [...base, ...bootstrap.messages];
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
      meta: { serviceDesignStage: "feature-planning" },
    });

    const operational = await onOperationalSend(text);
    if (operational === "handled") {
      setConversationMessages((prev) => {
        const next = [...prev, userMsg];
        persistConversation(next, answers, currentSlotKey);
        return next;
      });
      return;
    }

    const pid = projectId.trim();
    if (!pid) return;

    setAiInvokePending(true);
    try {
      let nextAnswers = { ...answers };
      let nextSlotKey = currentSlotKey;

      const turn = await postPrototypeChatTurn({
        projectId: pid,
        projectName,
        projectDescription,
        templateName,
        userMessage: text,
        envOk,
        slots,
        answers: nextAnswers,
        currentSlotKey: nextSlotKey,
        mentionedAI: extractMentionedAI(text),
      });

      if (!turn.success || !turn.data?.assistantMessage) {
        const err = turn.message?.trim() || "AI 응답을 받지 못했습니다.";
        setConversationMessages((prev) => {
          const next = [
            ...prev,
            userMsg,
            newRequirementsMessage({
              role: "ai",
              speakerType: "AI",
              speakerId: "prototype_build",
              speakerName: aiTitle,
              messageType: "FRIENDLY_ERROR",
              content: err,
              meta: { serviceDesignStage: "feature-planning" },
            }),
          ];
          persistConversation(next, nextAnswers, nextSlotKey);
          return next;
        });
        return;
      }

      const data = turn.data;
      if (data.slotKeyToFill && data.slotValue) {
        nextAnswers = { ...nextAnswers, [data.slotKeyToFill]: data.slotValue };
      }
      if (data.nextSlotKey) nextSlotKey = data.nextSlotKey;

      const aiBody = [
        data.assistantMessage,
        data.nextQuestion ? `\n\n${data.nextQuestion}` : "",
      ]
        .join("")
        .trim();

      const aiMsg = newRequirementsMessage({
        role: "ai",
        speakerType: "AI",
        speakerId: "prototype_build",
        speakerName: String(data.responderLabel ?? "").trim() || aiTitle,
        messageType: "STATEMENT",
        content: aiBody,
        meta: {
          serviceDesignStage: "feature-planning",
          interviewSuggestions: data.nextQuestion ? [data.nextQuestion] : undefined,
          interviewAllowCustomInput: true,
        },
      });

      setConversationMessages((prev) => {
        const next = [...prev, userMsg, aiMsg];
        persistConversation(next, nextAnswers, nextSlotKey);
        return next;
      });
      setAnswers(nextAnswers);
      setCurrentSlotKey(nextSlotKey);
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
    projectId,
    projectName,
    projectDescription,
    templateName,
    envOk,
    slots,
    answers,
    currentSlotKey,
    aiTitle,
    persistConversation,
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
      implementationBootstrapRef.current = hasValidImplementationLeadBootstrap(persisted);
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

