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
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { postServiceFlowAnalyze } from "@/lib/requirements/serviceFlowAnalyzeClient";
import { consumeWorkspaceAiScreenHandoff } from "@/lib/ai-member/workspaceAiHandoff";

export type ServiceFlowWorkspaceMode = "chat" | "mapping" | "summary";

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
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
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
}) {
  const aiDisplayName = displayedWorkspaceAiTitle("actor_flow");
  const displayMessages = useMemo(
    () => persistedServiceFlowMessages.map((m) => workshopMessageFromPersisted(m, aiDisplayName)),
    [persistedServiceFlowMessages, aiDisplayName],
  );

  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);
  const [latestAiQuestion, setLatestAiQuestion] = useState<string>("");
  const [toolsOpen, setToolsOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollPendingRef = useRef(false);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const onAppendRef = useRef(onAppendPersistedServiceFlowMessages);
  const onChangeFlowRef = useRef(onChangeFlow);
  useEffect(() => {
    onAppendRef.current = onAppendPersistedServiceFlowMessages;
  }, [onAppendPersistedServiceFlowMessages]);
  useEffect(() => {
    onChangeFlowRef.current = onChangeFlow;
  }, [onChangeFlow]);

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
    (userMessageText: string, opts?: { silentUserAppend?: boolean }) => {
      if (workspaceMode !== "chat") return;
      const body = userMessageText.trim();
      if (!body) return;
      setReplying(true);
      setQuickReplies(null);

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
          });

          if (!result.ok || !result.data.updatedFlow) {
            autoScrollPendingRef.current = true;
            const errSlice = await onAppendRef.current([
              buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
            ]);
            messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
            setReplying(false);
            return;
          }

          const data = result.data;
          const nextFlow = data.updatedFlow;
          if (!nextFlow) {
            autoScrollPendingRef.current = true;
            const errSlice = await onAppendRef.current([
              buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
            ]);
            messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
            setReplying(false);
            return;
          }
          onChangeFlowRef.current(nextFlow);

          const nextQ = String(data.nextQuestion ?? "").trim();
          if (nextQ) setLatestAiQuestion(nextQ);

          const replies = Array.isArray(data.quickReplies)
            ? data.quickReplies.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 3)
            : [];
          setQuickReplies(replies.length ? replies : null);

          const aiBody = [String(data.assistantMessage ?? "").trim(), nextQ].filter(Boolean).join("\n");
          const done = !nextQ && Boolean(data.readiness?.readyForNext);
          autoScrollPendingRef.current = true;
          const combined =
            (aiBody || "반영했습니다.") +
            (done ? "\n\n기본 운영 흐름이 정리되었습니다.\n추가 수정사항이 있으면 말씀해 주세요." : "");
          const okSlice = await onAppendRef.current([buildServiceFlowAiPersist(combined)]);
          messagesRef.current = okSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          setReplying(false);
        } catch {
          autoScrollPendingRef.current = true;
          try {
            const errSlice = await onAppendRef.current([
              buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
            ]);
            messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          } finally {
            setReplying(false);
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
    ],
  );

  const callAnalyzeRef = useRef(callAnalyze);
  useEffect(() => {
    callAnalyzeRef.current = callAnalyze;
  }, [callAnalyze]);

  const sendMessage = useCallback(() => {
    if (workspaceMode !== "chat") return;
    const body = input.trim();
    if (!body) return;
    setInput("");
    callAnalyze(body);
    scrollChatToBottom();
  }, [workspaceMode, input, callAnalyze, scrollChatToBottom]);

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
        const result = await postServiceFlowAnalyze({
          projectId,
          projectName,
          projectDescription,
          ideationAssets,
          userMessage:
            "정리 요청: 지금까지의 대화와 기존 초안을 바탕으로 액터/흐름/담당 매핑을 최신 상태로 다시 정리해 주세요.",
          recentMessages: excerpt,
          latestAiQuestion,
          currentFlow: flow,
          ...(priorScreenHandoff ? { priorScreenHandoff } : {}),
        });
        if (!result.ok || !result.data.updatedFlow) {
          const errSlice = await onAppendRef.current([
            buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
          ]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          setReplying(false);
          return;
        }
        const organizedFlow = result.data.updatedFlow;
        onChangeFlowRef.current(organizedFlow);
        const nextQ = String(result.data?.nextQuestion ?? "").trim();
        if (nextQ) setLatestAiQuestion(nextQ);
        setQuickReplies(null);
        const okSlice = await onAppendRef.current([
          buildServiceFlowAiPersist(
            [String(result.data?.assistantMessage ?? "").trim() || "정리했습니다.", nextQ].filter(Boolean).join("\n"),
          ),
        ]);
        messagesRef.current = okSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        setWorkspaceMode("summary");
        setReplying(false);
      } catch {
        try {
          const errSlice = await onAppendRef.current([buildServiceFlowAiPersist("자동 정리에 실패했습니다. 다시 시도해주세요.")]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        } finally {
          setReplying(false);
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
      const list = normalizeServiceFlowStepOrder(flow?.steps ?? [])
        .slice(0, 8)
        .map((s) => `${s.order}. ${s.title}`)
        .join("\n");
      bootOnceRef.current = true;
      void onAppendRef.current([
        buildServiceFlowAiPersist(
          `아이디어 구체화 단계에서 다음 흐름이 정리되었습니다.\n\n${list}\n\n이 흐름에서 누락되었거나 수정할 단계가 있습니까?`,
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

  return {
    aiDisplayName,
    displayMessages,
    input,
    setInput,
    replying,
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
  };
}
