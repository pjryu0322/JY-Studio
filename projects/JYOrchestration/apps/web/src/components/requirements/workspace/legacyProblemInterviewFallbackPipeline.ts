import type { MutableRefObject } from "react";
import { REQUIREMENTS_IDEATION_HTTP } from "@/lib/requirements/requirementsIdeationHttp";
import type { PersistRemoteFn } from "@/lib/requirements/requirementsWorkspacePersist";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import { IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";
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
import { mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { appendIdeationBootstrapPromptTimeline, coerceRequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsMessageMeta } from "@/lib/requirements/requirementsMessage";
import type { RequirementMemberRef } from "@/lib/requirements/requirementsTargets";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { newChatMessage, VIRTUAL_AI_PLANNER_ID, type RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";
import {
  ideationInterviewMilestoneLine,
  ideationSendDevLog,
  shouldSkipIdeationDuplicateAppend,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { IdeationPlannerTail } from "@/components/requirements/workspace/requirementsIdeationAiTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Legacy ProblemInterview fallback pipeline (legacy fallback only).
 *
 * NOTE:
 * - 정상 경로는 `/api/requirements/ai-facilitator` (singleChatOrchestrationV1) 입니다.
 * - 이 파이프라인은 feature-flag로만 접근 가능한 emergency fallback 용도로만 유지합니다.
 */
export async function runLegacyProblemInterviewFallbackPipeline(params: {
  readonly sendTraceId: string;
  readonly text: string;
  readonly withCalling: RequirementsRoomStateV3;
  readonly msgs: readonly RequirementsMessage[];
  readonly turn: number;
  readonly pid: string;
  readonly primaryId: string;
  readonly aiName: string;
  readonly targets: readonly RequirementMemberRef[];
  readonly effectiveReplyTo: string | null;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string;
  readonly workspaceScreenKey: string;
  readonly persistRemote: PersistRemoteFn;
  readonly setAiLastInvoke: (next: { ok: boolean; at: string; detail?: string }) => void;
  readonly setInput: (v: string) => void;
  readonly setReplyTo: (v: { id: string; preview: string } | null) => void;
  readonly showErrorToast: (message: string) => void;
  readonly serviceDesignHarness?: ServiceDesignHarnessPayload | null;
  readonly consumeInterviewSelectedSuggestion?: () => string | null;
}): Promise<IdeationPlannerTail> {
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
    projectType,
    workspaceScreenKey,
    persistRemote,
    setAiLastInvoke,
    setInput,
    setReplyTo,
    showErrorToast,
    serviceDesignHarness,
    consumeInterviewSelectedSuggestion,
  } = params;

  console.warn("[legacy-problem-interview] fallback pipeline entered", {
    projectId: pid || null,
    sendTraceId,
    workspaceScreenKey,
    reason: "legacy_fallback_pipeline_entry",
  });

  type InterviewAnalyzerCallOutcome =
    | { kind: "parsed"; payload: InterviewAnalyzerPayload }
    | { kind: "http-ok-parse-fail" }
    | { kind: "remote-fail" };

  const absorbPromptTrace = (raw: unknown) => {
    const tr = coerceRequirementsPromptTimelineEntry(raw);
    if (!tr) return;
    stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
      promptTimeline: appendIdeationBootstrapPromptTimeline(stateJsonRef.current.promptTimeline, tr),
    });
  };

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

    // Emergency-only legacy question selection (should not run on normal path).
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
      "AI 기획자 응답 생성에 실패했습니다. OpenAI 연결 설정을 확인하거나 다시 시도해 주세요.";
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

  // --- legacy pipeline entry ---
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
    replyParentMsg?.role === "ai" ? replyParentMsg : [...msgs].reverse().find((m) => m.role === "ai") ?? null;
  const latestAiQuestion = String(latestAiTurn?.content ?? "").trim();

  // Legacy fallback compatibility:
  // - reply meta fields and `problemInterviewLastSlot` exist on older message shapes and are not part of the core orchestration path.
  // - We keep access as best-effort string parsing to avoid breaking historical data.
  const lastUserMeta = (lastUser && typeof (lastUser as { meta?: unknown }).meta === "object" ? ((lastUser as { meta?: unknown }).meta as RequirementsMessageMeta) : null) as
    | RequirementsMessageMeta
    | null;

  const replySlotFromUser =
    lastUserMeta?.replyToSlotKey && String(lastUserMeta.replyToSlotKey).trim()
      ? String(lastUserMeta.replyToSlotKey).trim()
      : undefined;
  const replyTargetFromUser =
    lastUserMeta?.replyTargetSpeakerId && String(lastUserMeta.replyTargetSpeakerId).trim()
      ? String(lastUserMeta.replyTargetSpeakerId).trim()
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
            typeof (latestAiTurn as { meta?: { problemInterviewLastSlot?: unknown } } | null | undefined)?.meta?.problemInterviewLastSlot === "string" &&
            String((latestAiTurn as { meta?: { problemInterviewLastSlot?: unknown } }).meta?.problemInterviewLastSlot).trim()
              ? String((latestAiTurn as { meta?: { problemInterviewLastSlot?: unknown } }).meta?.problemInterviewLastSlot).trim()
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
              }
            : {}),
        }),
      });
      const aj = (await ar.json()) as { success?: boolean; data?: unknown; meta?: { promptTrace?: unknown } };
      absorbPromptTrace(aj.meta?.promptTrace);
      const remotePayloadOk = ar.ok && Boolean(aj.success) && aj.data != null;
      if (remotePayloadOk) {
        const parsed = coerceInterviewAnalyzerPayload(aj.data);
        outcome = parsed ? { kind: "parsed", payload: parsed } : { kind: "http-ok-parse-fail" };
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
      msgs as RequirementsMessage[],
      mergeAnalyzerIntoProblemInterview(seeded, outcome.payload, nowIso)
    );
    const lastSlotRaw = String((latestAiTurn as { meta?: { problemInterviewLastSlot?: unknown } } | null | undefined)?.meta?.problemInterviewLastSlot ?? "").trim();
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

  const merged = mergeImplicitAskedFromLastBootstrapQuestion(msgs as RequirementsMessage[], mergedFallback);
  const lastSlotRaw = String((latestAiTurn as { meta?: { problemInterviewLastSlot?: unknown } } | null | undefined)?.meta?.problemInterviewLastSlot ?? "").trim();
  const lastSlot: ProblemInterviewSlot | null =
    lastSlotRaw && (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(lastSlotRaw)
      ? (lastSlotRaw as ProblemInterviewSlot)
      : null;
  return commitInterviewPlannerReplyOnce(merged, null, { prevState: seeded, lastAskedSlot: lastSlot });
}

