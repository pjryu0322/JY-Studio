import type { MutableRefObject } from "react";
import { REQUIREMENTS_IDEATION_HTTP } from "@/lib/requirements/requirementsIdeationHttp";
import type { PersistRemoteFn } from "@/lib/requirements/requirementsWorkspacePersist";
import { consumeWorkspaceAiScreenHandoff } from "@/lib/ai-member/workspaceAiHandoff";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import {
  IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE,
  IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
} from "@/lib/requirements/ideationInterviewBootstrap";
import { bumpDraftVersion, type RequirementsDraftDoc } from "@/lib/requirements/draftStore";
import { normalizeLlmInterviewSuggestions } from "@/lib/requirements/interviewSuggestionChips";
import {
  applyGlobalDelegationDefaults,
  coerceInterviewAnalyzerPayload,
  composeInterviewPlannerReply,
  emergencyFallbackProblemInterviewFromUserMessageRegex,
  emptyProblemInterviewState,
  getControlledQuestionForSlot,
  interviewSlotLevelFromState,
  INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
  mergeAnalyzerIntoProblemInterview,
  mergeImplicitAskedFromLastBootstrapQuestion,
  pickNextAskableInterviewSlot,
  planNextInterviewTurn,
  problemInterviewStateToAnalyzerWire,
  PROBLEM_INTERVIEW_SLOTS,
  slotStrictlyFilled,
  withAskedSlot,
  type InterviewAnalyzerPayload,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import { augmentDialogueExcerptForReplyParent } from "@/lib/requirements/requirementsAnswerContext";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementMemberRef } from "@/lib/requirements/requirementsTargets";
import {
  mergeRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import {
  appendIdeationBootstrapPromptTimeline,
  coerceRequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { filterIdeationConversationMessages } from "@/lib/requirements/serviceFlowConversation";
import {
  formatDialogueExcerpt,
  ideationInterviewMilestoneLine,
  ideationSendDevLog,
  shouldSkipIdeationDuplicateAppend,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { runServiceDesignHarnessTurn } from "@/lib/service-design/runServiceDesignHarnessTurn";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  newChatMessage,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";

export type IdeationPlannerTail =
  | { needsTailPersist: true; finalRoom: RequirementsRoomStateV3; persistMeta?: Partial<RequirementsStateJson> }
  | { needsTailPersist: false };

type RunRequirementsIdeationAiAfterUserPersistContext = {
  readonly sendTraceId: string;
  readonly text: string;
  readonly withCalling: RequirementsRoomStateV3;
  readonly msgs: RequirementsMessage[];
  readonly turn: number;
  readonly pid: string;
  readonly primaryId: string;
  readonly aiName: string;
  readonly targets: readonly RequirementMemberRef[];
  readonly effectiveReplyTo: string | null;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly draftDoc: RequirementsDraftDoc | null;
  readonly sessionUserId: string;
  readonly sessionUserName: string;
  readonly persistRemote: PersistRemoteFn;
  readonly setAiLastInvoke: (next: { ok: boolean; at: string; detail?: string }) => void;
  readonly setInput: (v: string) => void;
  readonly setReplyTo: (v: { id: string; preview: string } | null) => void;
  readonly showErrorToast: (message: string) => void;
  readonly serviceDesignHarness?: ServiceDesignHarnessPayload | null;
  /** SingleChat 화면 키 — AI Agent 절차별 매핑 조회용 (`requirements_ideation` 등) */
  readonly workspaceScreenKey?: string;
  readonly projectType?: string;
  /** 인터뷰 추천 칩 선택 후 전송 시 한 번 소비 */
  readonly consumeInterviewSelectedSuggestion?: () => string | null;
};

export async function runRequirementsIdeationAiAfterUserPersist(
  ctx: RunRequirementsIdeationAiAfterUserPersistContext
): Promise<IdeationPlannerTail> {
  const {
    sendTraceId,
    text,
    withCalling,
    msgs,
    turn,
    pid,
    primaryId,
    aiName,
    targets,
    effectiveReplyTo,
    stateJsonRef,
    projectName,
    projectDescription,
    draftDoc,
    sessionUserId,
    sessionUserName,
    persistRemote,
    setAiLastInvoke,
    setInput,
    setReplyTo,
    showErrorToast,
    serviceDesignHarness,
    workspaceScreenKey: workspaceScreenKeyRaw,
    projectType,
    consumeInterviewSelectedSuggestion,
  } = ctx;

  const workspaceScreenKey =
    String(workspaceScreenKeyRaw ?? "requirements_ideation").trim() || "requirements_ideation";

  const absorbPromptTrace = (raw: unknown) => {
    const tr = coerceRequirementsPromptTimelineEntry(raw);
    if (!tr) return;
    stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
      promptTimeline: appendIdeationBootstrapPromptTimeline(stateJsonRef.current.promptTimeline, tr),
    });
  };

  const msgsIdeationOnly = filterIdeationConversationMessages(msgs);
  const excerpt = augmentDialogueExcerptForReplyParent(
    formatDialogueExcerpt(msgsIdeationOnly),
    msgsIdeationOnly,
    effectiveReplyTo
  );
  const endpoint = REQUIREMENTS_IDEATION_HTTP.AI_FACILITATOR;
  const harness =
    serviceDesignHarness && String(serviceDesignHarness.serviceDesignStage) === "ideation"
      ? await runServiceDesignHarnessTurn({
          input: text,
          stage: "ideation",
          mentionedAI: serviceDesignHarness.mentionedAI ?? null,
        })
      : null;
  if (harness) {
    console.debug("[HARNESS CHECK]", { stage: "ideation", payloadReceived: true, runHarnessExecuted: true });
  }

  const isIdeationProblemInterviewPlannerContext = (): boolean => {
    if (primaryId !== VIRTUAL_AI_PLANNER_ID) return false;
    if (stateJsonRef.current.organizePlannerState) return false;
    const lastAi = [...msgsIdeationOnly].reverse().find((m) => m.role === "ai");
    const internal =
      lastAi && typeof (lastAi as { meta?: { internalType?: string } }).meta?.internalType === "string"
        ? String((lastAi as { meta?: { internalType?: string } }).meta?.internalType)
        : "";
    const boot = internal === IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE;
    const interviewTurn = internal === IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE;
    const looksLikeComposedInterview =
      lastAi?.speakerId === VIRTUAL_AI_PLANNER_ID &&
      /\n\n질문:\n/.test(String((lastAi as { content?: string }).content ?? ""));
    const pi = stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined;
    const active = Boolean(pi && pi.active !== false);
    return boot || interviewTurn || looksLikeComposedInterview || active;
  };

  type InterviewAnalyzerCallOutcome =
    | { kind: "parsed"; payload: InterviewAnalyzerPayload }
    | { kind: "http-ok-parse-fail" }
    | { kind: "remote-fail" };

  const levelRank = (l: "empty" | "partial" | "filled" | null | undefined): number => {
    if (l === "filled") return 2;
    if (l === "partial") return 1;
    return 0;
  };

  const commitInterviewPlannerReplyOnce = async (
    merged: ProblemInterviewState,
    analyzerForPlan: InterviewAnalyzerPayload | null,
    ctxInner?: { prevState?: ProblemInterviewState; lastAskedSlot?: ProblemInterviewSlot | null }
  ): Promise<IdeationPlannerTail> => {
    const nowIso = new Date().toISOString();
    const lastAskedSlot = ctxInner?.lastAskedSlot ?? null;
    const prev = ctxInner?.prevState ?? merged;
    const prevLevel = lastAskedSlot ? interviewSlotLevelFromState(prev, lastAskedSlot) : null;
    const nextLevel = lastAskedSlot ? interviewSlotLevelFromState(merged, lastAskedSlot) : null;
    const avoidImmediateRepeat = lastAskedSlot ? levelRank(nextLevel) <= levelRank(prevLevel) : false;
    const avoidSlotsForNext = avoidImmediateRepeat && lastAskedSlot ? ([lastAskedSlot] as const) : null;

    let mergedForPlan = merged;
    let autoAppliedDelegationDefault = false;
    let delegatedSlot: ProblemInterviewSlot | null = null;
    let delegatedDefaultLine = "";
    const globalDelegation = Boolean(analyzerForPlan && analyzerForPlan.globalDelegation === true);
    if (analyzerForPlan && analyzerForPlan.intent === "delegate_to_ai") {
      delegatedSlot = analyzerForPlan.delegatedSlot ?? lastAskedSlot ?? null;
      delegatedDefaultLine = (analyzerForPlan.delegatedDefault || "AI 기본 추천안 적용").trim();
      if (delegatedSlot && !slotStrictlyFilled(merged, delegatedSlot)) {
        const nextRow = { ...(merged as unknown as Record<string, unknown>) } as Record<string, unknown>;
        nextRow[delegatedSlot] = true;
        const partial = { ...(merged.partial ?? {}) } as Record<string, boolean>;
        if (delegatedSlot in partial) delete partial[delegatedSlot];
        const notes = { ...(merged.notes ?? {}) } as Record<string, string>;
        notes[delegatedSlot] = notes[delegatedSlot]
          ? `${notes[delegatedSlot]}\n${delegatedDefaultLine}`.trim()
          : delegatedDefaultLine;
        mergedForPlan = {
          ...(merged as unknown as Record<string, unknown>),
          ...nextRow,
          partial,
          notes,
          updatedAt: nowIso,
        } as unknown as ProblemInterviewState;
        autoAppliedDelegationDefault = true;
      }
    }

    const mergedWithGlobalDelegation = globalDelegation ? applyGlobalDelegationDefaults(mergedForPlan, nowIso) : mergedForPlan;

    const plan = planNextInterviewTurn(
      mergedWithGlobalDelegation,
      analyzerForPlan,
      mergedWithGlobalDelegation.askedSlots,
      turn,
      INTERVIEW_ANALYZER_CONFIDENCE_THRESHOLD,
      text,
      {
        avoidNextSlot: [
          ...(avoidSlotsForNext ?? []),
          ...(autoAppliedDelegationDefault && (delegatedSlot ?? lastAskedSlot)
            ? [((delegatedSlot ?? lastAskedSlot) as ProblemInterviewSlot)]
            : []),
        ],
        ...(globalDelegation ? { allowEarlyFinishScore: 8.5 } : {}),
      }
    );
    if (plan) {
      const milestone = ideationInterviewMilestoneLine(prev, mergedWithGlobalDelegation);
      const extra = autoAppliedDelegationDefault ? "해당 항목은 AI 기본안으로 반영하겠습니다." : "";
      const mergedSummary = [milestone, extra].filter(Boolean).join("\n");
      const aiBody = composeInterviewPlannerReply(mergedSummary, plan.question);
      const slotForAsked =
        plan.kind === "slot"
          ? plan.slot
          : analyzerForPlan?.nextQuestionSlotKey ??
            analyzerForPlan?.currentSlotKey ??
            analyzerForPlan?.nextBestSlot ??
            lastAskedSlot ??
            ("serviceIdea" as ProblemInterviewSlot);
      const suggestionChips = normalizeLlmInterviewSuggestions(plan.suggestions ?? []);
      const interviewChipMeta =
        plan.allowCustomInput === false
          ? {
              ...(suggestionChips.length ? { interviewSuggestions: suggestionChips } : {}),
              interviewAllowCustomInput: false as const,
            }
          : suggestionChips.length
            ? { interviewSuggestions: suggestionChips }
            : {};
      const asked = withAskedSlot(mergedWithGlobalDelegation, slotForAsked, nowIso);
      const baseMsgs = withCalling.requirementsConversation.messages;
      if (
        primaryId === VIRTUAL_AI_PLANNER_ID &&
        shouldSkipIdeationDuplicateAppend({
          messages: baseMsgs,
          role: "ai",
          body: aiBody,
          matchVirtualPlannerAi: true,
        })
      ) {
        ideationSendDevLog("dedupe-ai-skip", `id=${sendTraceId}`);
        await persistRemote(withCalling, {}, {
          problemInterview: asked,
          ...(stateJsonRef.current.promptTimeline ? { promptTimeline: stateJsonRef.current.promptTimeline } : {}),
        });
        setAiLastInvoke({ ok: true, at: new Date().toISOString() });
        ideationSendDevLog("return", `interview-dedupe-no-ai id=${sendTraceId}`);
        setInput("");
        setReplyTo(null);
        return { needsTailPersist: false };
      }
      ideationSendDevLog("ai-appended", `id=${sendTraceId} kind=interview-next`);
      const interviewNextRoom: RequirementsRoomStateV3 = {
        ...withCalling,
        aiQuestionIndex: turn + 1,
        requirementsConversation: {
          ...withCalling.requirementsConversation,
          messages: [
            ...withCalling.requirementsConversation.messages,
            newChatMessage({
              role: "ai",
              body: aiBody,
              speakerType: "AI",
              speakerId: primaryId,
              speakerName: aiName,
              messageType: "ANSWER",
              meta: {
                internalType: IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
                problemInterviewLastSlot: slotForAsked,
                ...interviewChipMeta,
              },
            }),
          ],
        },
      };
      await persistRemote(interviewNextRoom, {}, {
        problemInterview: asked,
        ...(globalDelegation ? { globalDelegation: true } : {}),
        ...(stateJsonRef.current.promptTimeline ? { promptTimeline: stateJsonRef.current.promptTimeline } : {}),
      });
      setAiLastInvoke({ ok: true, at: new Date().toISOString() });
      ideationSendDevLog("return", `interview-next ok=${Boolean(analyzerForPlan)} id=${sendTraceId}`);
      setInput("");
      setReplyTo(null);
      return { needsTailPersist: false };
    }

    const nextSlot = pickNextAskableInterviewSlot(mergedWithGlobalDelegation, mergedWithGlobalDelegation.askedSlots, null, {
      avoidSlots: avoidSlotsForNext,
    });
    if (nextSlot) {
      const question = getControlledQuestionForSlot(nextSlot, turn);
      const milestone = ideationInterviewMilestoneLine(prev, mergedWithGlobalDelegation);
      const aiBody = composeInterviewPlannerReply(milestone, question);
      const asked = withAskedSlot(mergedWithGlobalDelegation, nextSlot, nowIso);
      const interviewNextRoom: RequirementsRoomStateV3 = {
        ...withCalling,
        aiQuestionIndex: turn + 1,
        requirementsConversation: {
          ...withCalling.requirementsConversation,
          messages: [
            ...withCalling.requirementsConversation.messages,
            newChatMessage({
              role: "ai",
              body: aiBody,
              speakerType: "AI",
              speakerId: primaryId,
              speakerName: aiName,
              messageType: "ANSWER",
              meta: {
                internalType: IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
                problemInterviewLastSlot: nextSlot,
              },
            }),
          ],
        },
      };
      await persistRemote(interviewNextRoom, {}, {
        problemInterview: asked,
        ...(globalDelegation ? { globalDelegation: true } : {}),
        ...(stateJsonRef.current.promptTimeline ? { promptTimeline: stateJsonRef.current.promptTimeline } : {}),
      });
      setAiLastInvoke({ ok: true, at: new Date().toISOString() });
      ideationSendDevLog("return", `interview-gated-next id=${sendTraceId}`);
      setInput("");
      setReplyTo(null);
      return { needsTailPersist: false };
    }

    const blockedBody =
      "정리는 하단 + 메뉴의 [정리 요청]에서 실행할 수 있습니다.\n먼저 아이디어 구체화에 필요한 정보를 조금 더 확인하겠습니다.";
    const blockedState = { ...mergedWithGlobalDelegation, active: true, updatedAt: nowIso } as ProblemInterviewState;
    const blockedRoom: RequirementsRoomStateV3 = {
      ...withCalling,
      aiQuestionIndex: turn + 1,
      requirementsConversation: {
        ...withCalling.requirementsConversation,
        messages: [
          ...withCalling.requirementsConversation.messages,
          newChatMessage({
            role: "ai",
            body: blockedBody,
            speakerType: "AI",
            speakerId: primaryId,
            speakerName: aiName,
            messageType: "ANSWER",
            meta: { internalType: IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE },
          }),
        ],
      },
    };
    await persistRemote(blockedRoom, {}, {
      problemInterview: blockedState,
      ...(globalDelegation ? { globalDelegation: true } : {}),
      ...(stateJsonRef.current.promptTimeline ? { promptTimeline: stateJsonRef.current.promptTimeline } : {}),
    });
    setAiLastInvoke({ ok: true, at: new Date().toISOString() });
    ideationSendDevLog("return", `interview-gated-block id=${sendTraceId}`);
    setInput("");
    setReplyTo(null);
    return { needsTailPersist: false };
  };

  const runIdeationProblemInterviewPipeline = async (): Promise<IdeationPlannerTail> => {
    const nowIso = new Date().toISOString();
    const prevPi = (stateJsonRef.current.problemInterview as ProblemInterviewState | null | undefined) ?? null;
    const seeded = prevPi ?? emptyProblemInterviewState(nowIso);
    const lastUser = msgs.length ? msgs[msgs.length - 1] : null;
    const replyParentId =
      lastUser?.role === "user" && typeof lastUser.replyTo === "string" && lastUser.replyTo.trim()
        ? lastUser.replyTo.trim()
        : typeof effectiveReplyTo === "string" && effectiveReplyTo.trim()
          ? effectiveReplyTo.trim()
          : "";
    const replyParentMsg = replyParentId ? msgs.find((m) => m.id === replyParentId) ?? null : null;
    const latestAiTurn =
      replyParentMsg?.role === "ai"
        ? replyParentMsg
        : [...msgs].reverse().find((m) => m.role === "ai") ?? null;
    const latestAiQuestion = String(latestAiTurn?.content ?? "").trim();
    const replySlotFromUser =
      lastUser?.meta?.replyToSlotKey && String(lastUser.meta.replyToSlotKey).trim()
        ? String(lastUser.meta.replyToSlotKey).trim()
        : undefined;
    const replyTargetFromUser =
      lastUser?.meta?.replyTargetSpeakerId && String(lastUser.meta.replyTargetSpeakerId).trim()
        ? String(lastUser.meta.replyTargetSpeakerId).trim()
        : undefined;

    let outcome: InterviewAnalyzerCallOutcome = { kind: "remote-fail" };
    if (pid) {
      try {
        ideationSendDevLog("analyzer-request", `id=${sendTraceId}`);
        const orchBody = stateJsonRef.current.singleChatOrchestrationV1;
        const selectedSuggestionRaw = (consumeInterviewSelectedSuggestion?.() ?? "").trim();
        const selectedSuggestion = selectedSuggestionRaw || undefined;
        const ar = await credentialsIncludeFetch(REQUIREMENTS_IDEATION_HTTP.INTERVIEW_ANALYZE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName,
            projectDescription,
            projectType: projectType ?? "",
            userMessage: text,
            latestAiQuestion,
            currentSlotKey:
              typeof latestAiTurn?.meta?.problemInterviewLastSlot === "string" && latestAiTurn.meta.problemInterviewLastSlot.trim()
                ? latestAiTurn.meta.problemInterviewLastSlot.trim()
                : undefined,
            ...(replyParentId ? { replyToMessageId: replyParentId } : {}),
            ...(replySlotFromUser ? { replyToSlotKey: replySlotFromUser } : {}),
            ...(replyTargetFromUser ? { replyTargetSpeakerId: replyTargetFromUser } : {}),
            currentInterviewState: problemInterviewStateToAnalyzerWire(seeded),
            workspaceScreenKey,
            ...(orchBody !== undefined && orchBody !== null ? { singleChatOrchestrationV1: orchBody } : {}),
            ...(selectedSuggestion ? { selectedSuggestion } : {}),
            ...(serviceDesignHarness
              ? {
                  serviceDesignStage: serviceDesignHarness.serviceDesignStage,
                  mentionedAI: serviceDesignHarness.mentionedAI,
                  ...(harness ? { responsePolicy: harness.responsePolicy } : {}),
                }
              : {}),
          }),
        });
        const aj = (await ar.json()) as { success?: boolean; data?: unknown; meta?: { promptTrace?: unknown } };
        absorbPromptTrace(aj.meta?.promptTrace);
        const remotePayloadOk = ar.ok && Boolean(aj.success) && aj.data != null;
        if (remotePayloadOk) {
          const parsed = coerceInterviewAnalyzerPayload(aj.data);
          if (parsed) {
            outcome = { kind: "parsed", payload: parsed };
          } else {
            outcome = { kind: "http-ok-parse-fail" };
          }
        } else {
          outcome = { kind: "remote-fail" };
        }
      } catch {
        outcome = { kind: "remote-fail" };
      }
    }

    if (outcome.kind === "parsed") {
      ideationSendDevLog("analyzer-success", `id=${sendTraceId}`);
      const merged = mergeImplicitAskedFromLastBootstrapQuestion(
        msgs,
        mergeAnalyzerIntoProblemInterview(seeded, outcome.payload, nowIso)
      );
      const lastSlotRaw = String(latestAiTurn?.meta?.problemInterviewLastSlot ?? "").trim();
      const lastSlot: ProblemInterviewSlot | null =
        lastSlotRaw && (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(lastSlotRaw)
          ? (lastSlotRaw as ProblemInterviewSlot)
          : null;
      return commitInterviewPlannerReplyOnce(merged, outcome.payload, { prevState: seeded, lastAskedSlot: lastSlot });
    }

    if (outcome.kind === "http-ok-parse-fail") {
      ideationSendDevLog("analyzer-fallback", `reason=parse-or-coerce id=${sendTraceId}`);
    } else {
      ideationSendDevLog("analyzer-fallback", `reason=request-or-empty id=${sendTraceId}`);
    }
    const mergedFallback =
      outcome.kind === "http-ok-parse-fail"
        ? { ...seeded, updatedAt: nowIso }
        : emergencyFallbackProblemInterviewFromUserMessageRegex(seeded, text, nowIso);
    const merged = mergeImplicitAskedFromLastBootstrapQuestion(msgs, mergedFallback);
    const lastSlotRaw = String(latestAiTurn?.meta?.problemInterviewLastSlot ?? "").trim();
    const lastSlot: ProblemInterviewSlot | null =
      lastSlotRaw && (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(lastSlotRaw)
        ? (lastSlotRaw as ProblemInterviewSlot)
        : null;
    return commitInterviewPlannerReplyOnce(merged, null, { prevState: seeded, lastAskedSlot: lastSlot });
  };

  type FacilitatorPipelineResult =
    | { kind: "ok"; tail: IdeationPlannerTail }
    | { kind: "soft_fail"; tail: IdeationPlannerTail }
    | { kind: "emergency_fail"; tail: IdeationPlannerTail };

  const runFacilitatorOrDraftPipeline = async (): Promise<FacilitatorPipelineResult> => {
    let facilitatorFinalRoom: RequirementsRoomStateV3;
    try {
      const priorScreenHandoff = pid ? consumeWorkspaceAiScreenHandoff(pid, "ideation") : "";
      const res = await credentialsIncludeFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(pid ? { projectId: pid } : {}),
          projectName,
          projectDescription,
          ...(projectType !== undefined ? { projectType } : {}),
          stage: "requirements",
          userMessage: text,
          dialogueExcerpt: excerpt,
          targets: targets.map((t) => ({ id: t.id, name: t.name })),
          sender: { id: sessionUserId, name: sessionUserName },
          replyTo: effectiveReplyTo ?? null,
          ...(priorScreenHandoff ? { priorScreenHandoff } : {}),
          workspaceScreenKey,
          ...(stateJsonRef.current.singleChatOrchestrationV1 !== undefined &&
          stateJsonRef.current.singleChatOrchestrationV1 !== null
            ? { singleChatOrchestrationV1: stateJsonRef.current.singleChatOrchestrationV1 }
            : {}),
          ...(serviceDesignHarness
            ? {
                serviceDesignStage: serviceDesignHarness.serviceDesignStage,
                mentionedAI: serviceDesignHarness.mentionedAI,
                ...(harness ? { responsePolicy: harness.responsePolicy } : {}),
              }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: {
          reply?: string;
          draft?: {
            overview: string;
            goals: string[];
            users: string[];
            features: string[];
            excluded: string[];
            nonFunctional: string[];
            successCriteria: string[];
            openIssues: string[];
          };
          promptTrace?: unknown;
          singleChatOrchestrationV1?: unknown;
        };
      };
      absorbPromptTrace(json.data?.promptTrace);
      const orchParsed =
        json.data?.singleChatOrchestrationV1 !== undefined && json.data?.singleChatOrchestrationV1 !== null
          ? parseRequirementsSingleChatOrchestrationV1(json.data.singleChatOrchestrationV1)
          : null;
      if (orchParsed) {
        stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
          singleChatOrchestrationV1: orchParsed,
        });
      }
      const ok = Boolean(res.ok && json.success && (json.data?.reply || json.data?.draft));
      if (ok) {
        setAiLastInvoke({ ok: true, at: new Date().toISOString() });
        const createdDraft = json.data?.draft ?? null;
        const aiReply =
          json.data?.reply ??
          (createdDraft
            ? `요구사항 문서 초안을 만들었습니다.\n\n- 개요 ${createdDraft.overview}\n- 사용자 ${createdDraft.users.join(", ")}\n- 기능 ${createdDraft.features.join(", ")}\n- 기준 ${createdDraft.successCriteria.join(", ")}\n${createdDraft.openIssues.length ? `- 남은 확인사항 ${createdDraft.openIssues.join(", ")}` : ""}`.trim()
            : "");

        const nextDraftDoc =
          createdDraft && pid
            ? bumpDraftVersion(draftDoc, {
                projectId: pid,
                overview: createdDraft.overview,
                goals: createdDraft.goals,
                users: createdDraft.users,
                features: createdDraft.features,
                excluded: createdDraft.excluded,
                nonFunctional: createdDraft.nonFunctional,
                successCriteria: createdDraft.successCriteria,
                openIssues: createdDraft.openIssues,
                createdAt: new Date().toISOString(),
                source: { messageCount: msgs.length, lastMessageAt: msgs[msgs.length - 1]?.createdAt },
              })
            : null;

        if (
          primaryId === VIRTUAL_AI_PLANNER_ID &&
          shouldSkipIdeationDuplicateAppend({
            messages: withCalling.requirementsConversation.messages,
            role: "ai",
            body: aiReply,
            matchVirtualPlannerAi: true,
          })
        ) {
          ideationSendDevLog("dedupe-ai-skip", `id=${sendTraceId} kind=facilitator`);
          facilitatorFinalRoom = { ...withCalling, aiQuestionIndex: turn + 1 };
          ideationSendDevLog("return", `facilitator-dedupe id=${sendTraceId}`);
        } else {
          ideationSendDevLog("ai-appended", `id=${sendTraceId} kind=facilitator`);
          facilitatorFinalRoom = {
            ...withCalling,
            aiQuestionIndex: turn + 1,
            requirementsConversation: {
              ...withCalling.requirementsConversation,
              messages: [
                ...withCalling.requirementsConversation.messages,
                newChatMessage({
                  role: "ai",
                  body: aiReply,
                  speakerType: "AI",
                  speakerId: primaryId,
                  speakerName: aiName,
                  messageType: "ANSWER",
                }),
              ],
            },
            ...(nextDraftDoc ? { requirementsDraft: nextDraftDoc } : {}),
          };
          ideationSendDevLog("return", `facilitator-ai id=${sendTraceId}`);
        }
      } else {
        const errMsg = json.message || "응답 생성 실패";
        setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
        showErrorToast(`${IDEATION_AI_DISPLAY_NAME} 응답에 실패했습니다. 다시 시도해 주세요.`);
        facilitatorFinalRoom = { ...withCalling, aiQuestionIndex: turn + 1 };
        ideationSendDevLog("return", `facilitator-http id=${sendTraceId}`);
      }
      const tail: IdeationPlannerTail = {
        needsTailPersist: true,
        finalRoom: facilitatorFinalRoom,
        persistMeta: {
          ...(orchParsed ? { singleChatOrchestrationV1: orchParsed } : {}),
          ...(stateJsonRef.current.promptTimeline ? { promptTimeline: stateJsonRef.current.promptTimeline } : {}),
        },
      };
      return ok ? { kind: "ok", tail } : { kind: "soft_fail", tail };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setAiLastInvoke({ ok: false, at: new Date().toISOString(), detail: errMsg });
      showErrorToast(`${IDEATION_AI_DISPLAY_NAME} 응답에 실패했습니다. 다시 시도해 주세요.`);
      ideationSendDevLog("return", `facilitator-throw id=${sendTraceId}`);
      return { kind: "emergency_fail", tail: { needsTailPersist: true, finalRoom: { ...withCalling, aiQuestionIndex: turn + 1 } } };
    }
  };

  const runAiPlannerAfterUserPersist = async (): Promise<IdeationPlannerTail> => {
    // Normal path: always go through LLM orchestration (`/api/requirements/ai-facilitator`).
    // Legacy ProblemInterview pipeline is emergency-only fallback (LLM/parse/orchestration failure).
    const r = await runFacilitatorOrDraftPipeline();
    if (r.kind === "emergency_fail") return runIdeationProblemInterviewPipeline();
    return r.tail;
  };

  return runAiPlannerAfterUserPersist();
}
