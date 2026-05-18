"use client";

import { useCallback, type MutableRefObject } from "react";
import type { Project } from "@/components/project-spec/types";
import { REQUIREMENTS_IDEATION_HTTP } from "@/lib/requirements/requirementsIdeationHttp";
import type { PersistRemoteFn } from "@/lib/requirements/requirementsWorkspacePersist";
import {
  appendIdeationDeliverableAssets,
  extractPreviewLinesFromMarkdown,
  IDEATION_DELIVERABLE_LABELS,
  IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
  type IdeationDeliverableChatPayload,
  type IdeationDeliverableType,
} from "@/lib/requirements/ideationDeliverables";
import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import { formatDialogueExcerpt } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  newChatMessage,
  VIRTUAL_AI_PLANNER_ID,
  type RequirementsRoomStateV3,
} from "@/lib/project/requirementsRoomState";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function useRequirementsHandleGenerateDeliverables(params: {
  readonly resolvedProjectId: string;
  readonly conversationStatus: "idle" | "loading" | "loaded" | "error";
  readonly goals: string;
  readonly targetUsers: string;
  readonly scopeIn: string;
  readonly scopeOut: string;
  readonly success: string;
  readonly nfr: string;
  readonly openIssues: string;
  readonly priorityFeatures: string;
  readonly conversationMessages: readonly RequirementsMessage[];
  readonly ideationConversationOnly: readonly RequirementsMessage[];
  readonly project: Project | null;
  readonly room: RequirementsRoomStateV3;
  readonly persistRemote: PersistRemoteFn;
  readonly showSuccessToast: (message: string) => void;
  readonly showErrorToast: (message: string) => void;
  readonly openDeliverableViewer: (ids: readonly string[], focusId?: string | null) => void;
  readonly setDeliverableGenerateBusy: (busy: boolean) => void;
  readonly setError: (message: string | null) => void;
  readonly stateJsonRef: MutableRefObject<RequirementsStateJson>;
}): (types: readonly IdeationDeliverableType[], opts?: { readonly revisionRequest?: string }) => Promise<void> {
  const {
    resolvedProjectId,
    conversationStatus,
    goals,
    targetUsers,
    scopeIn,
    scopeOut,
    success,
    nfr,
    openIssues,
    priorityFeatures,
    conversationMessages,
    ideationConversationOnly,
    project,
    room,
    persistRemote,
    showSuccessToast,
    showErrorToast,
    openDeliverableViewer,
    setDeliverableGenerateBusy,
    setError,
    stateJsonRef,
  } = params;

  return useCallback(
    async (types: readonly IdeationDeliverableType[], opts?: { readonly revisionRequest?: string }) => {
      const pid = resolvedProjectId.trim();
      if (!pid) {
        setError("프로젝트에 연결된 뒤 산출물 생성을 사용할 수 있습니다.");
        throw new Error("GUARD");
      }
      if (conversationStatus !== "loaded") {
        setError("대화 이력을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
        throw new Error("GUARD");
      }
      setDeliverableGenerateBusy(true);
      setError(null);
      try {
        const chatSummary = [
          goals.trim() && `저장 요약 — 목표/핵심:\n${goals.trim()}`,
          targetUsers.trim() && `저장 요약 — 대상 사용자:\n${targetUsers.trim()}`,
          scopeIn.trim() && `저장 요약 — 범위(포함):\n${scopeIn.trim()}`,
          scopeOut.trim() && `저장 요약 — 범위(제외):\n${scopeOut.trim()}`,
          success.trim() && `저장 요약 — 성공 기준:\n${success.trim()}`,
          nfr.trim() && `저장 요약 — NFR 등:\n${nfr.trim()}`,
          openIssues.trim() && `저장 요약 — 열린 이슈:\n${openIssues.trim()}`,
          priorityFeatures.trim() && `저장 요약 — 우선 기능:\n${priorityFeatures.trim()}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        const excerpt = formatDialogueExcerpt(ideationConversationOnly);
        const planBaseName = (project?.name ?? "").trim() || "프로젝트";
        const res = await credentialsIncludeFetch(REQUIREMENTS_IDEATION_HTTP.DELIVERABLES_GENERATE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid,
            projectName: project?.name ?? "",
            projectDescription: project?.description ?? "",
            chatSummary,
            dialogueExcerpt: excerpt,
            revisionRequest: opts?.revisionRequest ?? "",
            outputTypes: types,
          }),
        });
        let json: {
          success?: boolean;
          code?: string;
          message?: string;
          data?: { outputs?: Partial<Record<IdeationDeliverableType, string>> };
        };
        try {
          json = (await res.json()) as typeof json;
        } catch {
          throw new Error(
            res.status === 502 || res.status === 503
              ? "산출물 생성 API가 비정상 응답을 반환했습니다. 서버 로그와 OpenAI(OPENAI_API_KEY·쿼터)를 확인해 주세요."
              : "산출물 생성 응답을 해석하지 못했습니다."
          );
        }
        if (!res.ok || !json.success || !json.data?.outputs) {
          const code = String(json.code ?? "");
          if (code === "NO_KEY") {
            throw new Error("AI 산출물 생성을 사용하려면 서버에 OPENAI_API_KEY 설정이 필요합니다.");
          }
          throw new Error(json.message || "산출물 생성에 실패했습니다.");
        }

        const existing =
          parseRequirementsStateJson(project?.requirementsStateJson).deliverableAssets ??
          stateJsonRef.current.deliverableAssets ??
          [];

        const { merged, created } = appendIdeationDeliverableAssets({
          projectId: pid,
          existing,
          outputs: json.data.outputs,
          typesRequested: types,
          getAssetTitle: (t, v) => (t === "full_plan" ? `${planBaseName} 아이디어 초안 v${v}` : undefined),
        });
        if (!created.length) {
          throw new Error("생성된 본문이 비어 있습니다.");
        }

        const notices = created.map((c) => {
          const payload: IdeationDeliverableChatPayload = {
            kind: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
            mode: "single",
            headline:
              c.type === "full_plan"
                ? `${planBaseName} 아이디어 초안이 생성되었습니다.`
                : `${IDEATION_DELIVERABLE_LABELS[c.type]} 초안이 생성되었습니다.`,
            requestedTypes: [c.type],
            items: [
              {
                assetId: c.id,
                type: c.type,
                title: c.title,
                version: c.version,
                previewLines: extractPreviewLinesFromMarkdown(c.content),
              },
            ],
          };
          return newChatMessage({
            role: "ai",
            body: JSON.stringify(payload),
            speakerType: "AI",
            speakerId: VIRTUAL_AI_PLANNER_ID,
            speakerName: IDEATION_AI_DISPLAY_NAME,
            messageType: "NOTICE",
            meta: { internalType: IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE },
          });
        });
        const nextRoom: RequirementsRoomStateV3 = {
          ...room,
          requirementsConversation: {
            ...room.requirementsConversation,
            projectId: pid,
            messages: [...conversationMessages, ...notices],
          },
        };
        await persistRemote(nextRoom, {}, { deliverableAssets: merged });
        if (types.length === 1 && types[0] === "full_plan") {
          const fp = created.find((c) => c.type === "full_plan");
          if (fp) openDeliverableViewer([fp.id], fp.id);
          showSuccessToast(`${planBaseName} 아이디어 초안 생성 완료`);
        } else {
          showSuccessToast(`${created.length}개 산출물 생성 완료`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "오류";
        if (msg !== "GUARD") {
          setError(msg);
          showErrorToast(msg);
        }
        throw e;
      } finally {
        setDeliverableGenerateBusy(false);
      }
    },
    [
      resolvedProjectId,
      conversationStatus,
      goals,
      targetUsers,
      scopeIn,
      scopeOut,
      success,
      nfr,
      openIssues,
      priorityFeatures,
      conversationMessages,
      ideationConversationOnly,
      project?.name,
      project?.description,
      project?.requirementsStateJson,
      room,
      persistRemote,
      showSuccessToast,
      showErrorToast,
      openDeliverableViewer,
      setDeliverableGenerateBusy,
      setError,
      stateJsonRef,
    ]
  );
}
