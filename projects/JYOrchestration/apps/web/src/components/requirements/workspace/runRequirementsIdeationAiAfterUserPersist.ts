import type { MutableRefObject } from "react";
import { REQUIREMENTS_IDEATION_HTTP } from "@/lib/requirements/requirementsIdeationHttp";
import type { PersistRemoteFn } from "@/lib/requirements/requirementsWorkspacePersist";
import { consumeWorkspaceAiScreenHandoff } from "@/lib/ai-member/workspaceAiHandoff";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
// NOTE: legacy interview markers are handled in the legacy fallback file; normal path is orchestration-first.
import { bumpDraftVersion, type RequirementsDraftDoc } from "@/lib/requirements/draftStore";
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
  buildSingleChatPromptTimelineEntry,
  coerceRequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { legacyProblemInterviewFallbackEnabled } from "@/lib/config/publicFeatureFlags";
import { SINGLE_CHAT_SERVICE_PLANNING_GROUP } from "@/lib/requirements/singleChatOrchestrationSlots";
import { filterIdeationConversationMessages } from "@/lib/requirements/serviceFlowConversation";
import {
  formatDialogueExcerpt,
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
import type { IdeationPlannerTail } from "@/components/requirements/workspace/requirementsIdeationAiTypes";
import { runLegacyProblemInterviewFallbackPipeline } from "@/components/requirements/workspace/legacyProblemInterviewFallbackPipeline";

export type { IdeationPlannerTail } from "@/components/requirements/workspace/requirementsIdeationAiTypes";

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

  const legacyFallbackEnabled = legacyProblemInterviewFallbackEnabled();

  const absorbPromptTrace = (raw: unknown) => {
    const tr = coerceRequirementsPromptTimelineEntry(raw);
    if (!tr) return;
    stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
      promptTimeline: appendIdeationBootstrapPromptTimeline(stateJsonRef.current.promptTimeline, tr),
    });
  };

  const appendAiFacilitatorFailureTrace = (params: {
    readonly error: string;
    readonly routingDecision: string;
    readonly createdAtIso?: string;
  }) => {
    const entry = buildSingleChatPromptTimelineEntry({
      action: "requirementsChatOrchestration",
      source: "fallback",
      timelineStage: "requirements",
      stageGroup: SINGLE_CHAT_SERVICE_PLANNING_GROUP,
      workspaceScreenKey,
      selectedAgents: [],
      error: params.error,
      fallback: true,
      routingDecision: params.routingDecision,
      createdAtIso: params.createdAtIso,
    });
    stateJsonRef.current = mergeRequirementsStateJson(stateJsonRef.current, {
      promptTimeline: appendIdeationBootstrapPromptTimeline(stateJsonRef.current.promptTimeline, entry),
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
        appendAiFacilitatorFailureTrace({
          error: errMsg,
          routingDecision: "ai_facilitator_failed",
        });
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
      appendAiFacilitatorFailureTrace({
        error: errMsg,
        routingDecision: "ai_facilitator_threw",
      });
      ideationSendDevLog("return", `facilitator-throw id=${sendTraceId}`);
      return { kind: "emergency_fail", tail: { needsTailPersist: true, finalRoom: { ...withCalling, aiQuestionIndex: turn + 1 } } };
    }
  };

  const runAiPlannerAfterUserPersist = async (): Promise<IdeationPlannerTail> => {
    // Normal path: always go through LLM orchestration (`/api/requirements/ai-facilitator`).
    // Legacy ProblemInterview pipeline is emergency-only fallback (LLM/parse/orchestration failure).
    const r = await runFacilitatorOrDraftPipeline();
    if (r.kind === "emergency_fail") {
      if (legacyFallbackEnabled) {
        console.warn("[legacy-problem-interview] fallback invoked", {
          reason: "ai_facilitator_emergency_fail",
          projectId: pid || null,
          sendTraceId,
          workspaceScreenKey,
          flagEnabled: true,
          aiFacilitatorFailed: true,
        });
        return runLegacyProblemInterviewFallbackPipeline({
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
        });
      }
      console.warn("[legacy-problem-interview] fallback blocked (flag disabled)", {
        projectId: pid || null,
        sendTraceId,
        workspaceScreenKey,
        flagEnabled: false,
        aiFacilitatorFailed: true,
      });
      return r.tail;
    }
    return r.tail;
  };

  return runAiPlannerAfterUserPersist();
}
