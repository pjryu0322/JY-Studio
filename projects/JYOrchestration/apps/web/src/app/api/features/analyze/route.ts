import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { buildFeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";
import { patchProjectRequirementsStateJson } from "@/lib/featurePlanning/saveFeaturePlanningWorkspace";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { randomUUID } from "node:crypto";
import { runFeaturePlanningAnalyzeChecklistLlm } from "@/lib/featurePlanning/runFeaturePlanningAnalyzeChecklistLlm";
import { resumeOpeningFromChecklist } from "@/lib/featurePlanning/featurePlanningDynamicChecklist";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { withFeaturePlanningProjectLock } from "@/lib/featurePlanning/featurePlanningProjectLock";
import {
  firstFlowStepTitleForFeaturePlanningEntry,
  FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE,
  isServiceFlowApprovedForFeaturePlanning,
} from "@/lib/featurePlanning/featurePlanningServiceFlowGate";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

type Body = {
  projectId?: string;
  forceRegenerate?: boolean;
};

function toWorkspaceMessages(rows: FeaturePlanningWorkspaceChatMessageV1[]) {
  return rows.map((m) => ({
    id: m.id,
    role: m.role as "user" | "ai",
    text: m.text,
    at: m.at,
    ...(m.resultSummary ? { resultSummary: m.resultSummary } : {}),
    ...(m.plannerSurface ? { plannerSurface: m.plannerSurface } : {}),
  }));
}

/**
 * 기능 정리 화면 진입용 — 서비스 흐름 확정 후 슬롯·첫 AI 메시지를 LLM으로 준비한다.
 * (initialize와 동일 저장 형태, 프롬프트 타임라인 purpose만 ANALYZE)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const forceRegenerate = body.forceRegenerate === true;

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canEditProject", "POST /api/features/analyze");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    return await withFeaturePlanningProjectLock(projectId, () =>
      runWithPromptTimelineProject(projectId, async () => {
        const row = await findProjectScalarsByIdSafe(projectId);
        if (!row) {
          return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
        }

        const state = parseRequirementsStateJson(row.requirementsStateJson);
        const existingArtifact = state.featurePlanningSlotsV1 ?? null;
        const existingChat = state.featurePlanningWorkspaceChatV1 ?? { messages: [] };
        const priorMessages = existingChat.messages ?? [];
        const hasSlots = Boolean(existingArtifact?.slots?.length);
        const needsFlowForLlm =
          forceRegenerate || !hasSlots || (hasSlots && priorMessages.length === 0);
        if (needsFlowForLlm && !isServiceFlowApprovedForFeaturePlanning(row.requirementsStateJson)) {
          return NextResponse.json(
            {
              success: false,
              code: "SERVICE_FLOW_INCOMPLETE",
              message: FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim(),
            },
            { status: 403 },
          );
        }

        if (!forceRegenerate && hasSlots && priorMessages.length > 0) {
          const art: FeaturePlanningSlotsArtifactV1 = existingArtifact!;
          return NextResponse.json({
            success: true,
            data: {
              generated: false,
              artifact: art,
              slots: art.slots,
              messages: toWorkspaceMessages(priorMessages),
            },
          });
        }

        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) {
          return NextResponse.json(
            { success: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." },
            { status: 200 },
          );
        }

        const model = resolveOpenAiModelFromEnv();
        const ctx = buildFeaturePlanningSlotsLlmContext({
          projectName: row.name,
          projectDescription: row.description,
          requirementsStateJson: row.requirementsStateJson,
          requirementsConversationJson: row.requirementsConversationJson,
          forceRegenerate: forceRegenerate === true,
        });
        const firstStepTitle = firstFlowStepTitleForFeaturePlanningEntry(state.serviceFlowV1 ?? null);

        if (!forceRegenerate && hasSlots && priorMessages.length === 0) {
          const art = existingArtifact!;
          if (art.planningChecklistV1) {
            const now = new Date().toISOString();
            const text = sanitizeFeaturePlanningUserVisibleKorean(resumeOpeningFromChecklist(art.planningChecklistV1)).slice(
              0,
              32000
            );
            const aiMessage: FeaturePlanningWorkspaceChatMessageV1 = {
              id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
              role: "ai",
              text,
              at: now,
              plannerSurface: "initial_entry",
            };
            const patch = await patchProjectRequirementsStateJson(projectId, {
              featurePlanningWorkspaceChatV1: { messages: [aiMessage] },
            });
            if (!patch.ok) {
              return NextResponse.json({ success: false, message: "저장에 실패했습니다." }, { status: 500 });
            }
            const mergedState = parseRequirementsStateJson(patch.merged);
            return NextResponse.json({
              success: true,
              data: {
                generated: true,
                artifact: art,
                slots: art.slots,
                messages: toWorkspaceMessages(mergedState.featurePlanningWorkspaceChatV1?.messages ?? [aiMessage]),
              },
            });
          }
          const gen = await runFeaturePlanningAnalyzeChecklistLlm({
            projectId,
            ctx,
            requirementsStateJson: row.requirementsStateJson,
            apiKey,
            model,
            firstStepTitle,
            forceRegenerate: false,
            existingArtifact: art,
            promptPurpose: "FEATURE_PLANNING_ANALYZE",
          });
          if (!gen.ok) {
            return NextResponse.json({ success: false, code: gen.code, message: gen.message }, { status: 200 });
          }
          const patch = await patchProjectRequirementsStateJson(projectId, {
            featurePlanningSlotsV1: gen.artifact,
            sampleDataSpecV1: gen.sampleDataSpecV1,
            featurePlanningWorkspaceChatV1: { messages: [gen.aiMessage] },
          });
          if (!patch.ok) {
            return NextResponse.json({ success: false, message: "저장에 실패했습니다." }, { status: 500 });
          }
          const mergedState = parseRequirementsStateJson(patch.merged);
          return NextResponse.json({
            success: true,
            data: {
              generated: true,
              artifact: gen.artifact,
              slots: gen.artifact.slots,
              messages: toWorkspaceMessages(mergedState.featurePlanningWorkspaceChatV1?.messages ?? [gen.aiMessage]),
            },
          });
        }

        const gen = await runFeaturePlanningAnalyzeChecklistLlm({
          projectId,
          ctx,
          requirementsStateJson: row.requirementsStateJson,
          apiKey,
          model,
          firstStepTitle,
          forceRegenerate: forceRegenerate === true,
          existingArtifact: existingArtifact,
          promptPurpose: "FEATURE_PLANNING_ANALYZE",
        });
        if (!gen.ok) {
          return NextResponse.json({ success: false, code: gen.code, message: gen.message }, { status: 200 });
        }

        let nextMessages: FeaturePlanningWorkspaceChatMessageV1[];
        if (forceRegenerate && priorMessages.length) {
          const prefix = `[기능 정리 초안 다시 만들기]\n\n`;
          nextMessages = [
            ...priorMessages,
            {
              ...gen.aiMessage,
              text: sanitizeFeaturePlanningUserVisibleKorean(`${prefix}${gen.aiMessage.text}`).slice(0, 32000),
            },
          ];
        } else {
          nextMessages = [gen.aiMessage];
        }

        const patch = await patchProjectRequirementsStateJson(projectId, {
          featurePlanningSlotsV1: gen.artifact,
          sampleDataSpecV1: gen.sampleDataSpecV1,
          featurePlanningWorkspaceChatV1: { messages: nextMessages },
        });
        if (!patch.ok) {
          return NextResponse.json({ success: false, message: "저장에 실패했습니다." }, { status: 500 });
        }

        const mergedState = parseRequirementsStateJson(patch.merged);
        return NextResponse.json({
          success: true,
          data: {
            generated: true,
            artifact: gen.artifact,
            slots: gen.artifact.slots,
            messages: toWorkspaceMessages(mergedState.featurePlanningWorkspaceChatV1?.messages ?? nextMessages),
          },
        });
      })
    );
  } catch (error) {
    console.error("POST /api/features/analyze error:", error);
    return NextResponse.json({ success: false, message: "기능 정리 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
