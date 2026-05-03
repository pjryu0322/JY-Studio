import { randomUUID } from "node:crypto";
import { runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { runFeaturePlanningChatLlm } from "@/lib/featurePlanning/featurePlanningChatLlm";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { ensureFeaturePlanningQuestionSuffix } from "@/lib/featurePlanning/featurePlanningInteractiveBubble";
import { withFeaturePlanningProjectLock } from "@/lib/featurePlanning/featurePlanningProjectLock";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";
import { patchProjectRequirementsStateJson } from "@/lib/featurePlanning/saveFeaturePlanningWorkspace";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FeaturePlanningPlannerTurnMetaV1 } from "@/lib/featurePlanning/featurePlanningChatLlm";

export type FeaturePlannerTurnWorkspaceMessage = {
  readonly id: string;
  readonly role: "user" | "ai";
  readonly text: string;
  readonly at: string;
  readonly resultSummary?: { title: string; lines: readonly string[] };
};

export type FeaturePlannerTurnOk = {
  readonly ok: true;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly messages: readonly FeaturePlannerTurnWorkspaceMessage[];
  readonly plannerMeta: FeaturePlanningPlannerTurnMetaV1;
};

export type FeaturePlannerTurnErr = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  /** 사용자 메시지가 저장되기 전 실패 시 undefined */
  readonly messages?: readonly FeaturePlannerTurnWorkspaceMessage[];
};

function toWorkspaceMessages(rows: FeaturePlanningWorkspaceChatMessageV1[]): FeaturePlannerTurnWorkspaceMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role as "user" | "ai",
    text: m.text,
    at: m.at,
    ...(m.resultSummary ? { resultSummary: m.resultSummary } : {}),
  }));
}

function lastAssistantTextBefore(prior: readonly FeaturePlanningWorkspaceChatMessageV1[]): string {
  for (let i = prior.length - 1; i >= 0; i--) {
    if (prior[i]?.role === "ai") return String(prior[i]?.text ?? "").trim();
  }
  return "";
}

/**
 * 기능 정리 플래너 한 턴 — 채팅 API와 `/api/features/planner-turn`에서 공통 사용.
 */
export async function executeFeaturePlanningPlannerTurn(input: {
  readonly projectId: string;
  readonly message: string;
}): Promise<FeaturePlannerTurnOk | FeaturePlannerTurnErr> {
  const projectId = input.projectId.trim();
  const message = input.message.trim();
  if (!projectId || !message) {
    return { ok: false, code: "BAD_INPUT", message: "projectId와 message가 필요합니다." };
  }

  return withFeaturePlanningProjectLock(projectId, () =>
    runWithPromptTimelineProject(projectId, async () => {
      const row = await findProjectScalarsByIdSafe(projectId);
      if (!row) {
        return { ok: false, code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." };
      }

      const state = parseRequirementsStateJson(row.requirementsStateJson);
      const artifact = state.featurePlanningSlotsV1 ?? null;
      if (!artifact?.slots?.length) {
        return { ok: false, code: "NO_SLOTS", message: "기능 정리 초안이 아직 없습니다. 잠시 후 다시 시도하거나 페이지를 새로고침해 주세요." };
      }

      const chat = state.featurePlanningWorkspaceChatV1 ?? { messages: [] };
      const prior = [...(chat.messages ?? [])];
      const now = new Date().toISOString();
      const userMsg: FeaturePlanningWorkspaceChatMessageV1 = {
        id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        role: "user",
        text: message.slice(0, 16000),
        at: now,
      };
      const withUser = [...prior, userMsg];

      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        await patchProjectRequirementsStateJson(projectId, {
          featurePlanningWorkspaceChatV1: { messages: withUser },
        });
        return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
      }

      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      const lastAssistantMessage = lastAssistantTextBefore(prior);
      const gen = await runFeaturePlanningChatLlm({
        projectId,
        artifact,
        userMessage: message,
        lastAssistantMessage: lastAssistantMessage || undefined,
        projectName: row.name,
        projectDescription: row.description ?? "",
        requirementsStateJson: row.requirementsStateJson,
        workspaceMessages: withUser,
        apiKey,
        model,
      });

      if (!gen.ok) {
        await patchProjectRequirementsStateJson(projectId, {
          featurePlanningWorkspaceChatV1: { messages: withUser },
        });
        return { ok: false, code: gen.code, message: gen.message, messages: toWorkspaceMessages(withUser) };
      }

      const rawAi = ensureFeaturePlanningQuestionSuffix(gen.aiMessage.trim());
      const aiMsg: FeaturePlanningWorkspaceChatMessageV1 = {
        id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        role: "ai",
        text: sanitizeFeaturePlanningUserVisibleKorean(rawAi).slice(0, 32000),
        at: new Date().toISOString(),
        ...(gen.resultSummary
          ? {
              resultSummary: {
                title: sanitizeFeaturePlanningUserVisibleKorean(gen.resultSummary.title),
                lines: gen.resultSummary.lines.map((l) => sanitizeFeaturePlanningUserVisibleKorean(l)),
              },
            }
          : {}),
      };
      const finalMessages = [...withUser, aiMsg];

      const patch = await patchProjectRequirementsStateJson(projectId, {
        featurePlanningSlotsV1: gen.artifact,
        featurePlanningWorkspaceChatV1: { messages: finalMessages },
      });
      if (!patch.ok) {
        return { ok: false, code: "SAVE", message: "저장에 실패했습니다.", messages: toWorkspaceMessages(withUser) };
      }

      return {
        ok: true,
        artifact: gen.artifact,
        messages: toWorkspaceMessages(finalMessages),
        plannerMeta: gen.plannerMeta,
      };
    })
  );
}
