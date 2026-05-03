import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { buildFeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import { runFeaturePlanningInitializeLlm } from "@/lib/featurePlanning/featurePlanningInitializeLlm";
import {
  composePlannerCategoryIntroduction,
  type FeaturePlanningWorkspaceChatMessageV1,
} from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { buildFallbackCategoryFirstMessage } from "@/lib/featurePlanning/featurePlanningFirstMessageFallback";
import { runFeaturePlanningFirstMessageLlm } from "@/lib/featurePlanning/featurePlanningFirstMessageLlm";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";
import { patchProjectRequirementsStateJson } from "@/lib/featurePlanning/saveFeaturePlanningWorkspace";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
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

async function buildCategorySelectionPlannerMessage(input: {
  readonly row: NonNullable<Awaited<ReturnType<typeof findProjectScalarsByIdSafe>>>;
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly apiKey: string;
  readonly model: string;
  readonly forceRegeneratePrefix: string;
}): Promise<FeaturePlanningWorkspaceChatMessageV1> {
  const now = new Date().toISOString();
  const ctx = buildFeaturePlanningSlotsLlmContext({
    projectName: input.row.name,
    projectDescription: input.row.description,
    requirementsStateJson: input.row.requirementsStateJson,
    requirementsConversationJson: input.row.requirementsConversationJson,
    forceRegenerate: false,
  });
  const fm = await runFeaturePlanningFirstMessageLlm({
    ctx,
    artifact: input.artifact,
    apiKey: input.apiKey,
    model: input.model,
  });
  const data = fm.ok ? fm.data : buildFallbackCategoryFirstMessage(input.artifact);
  const composed = composePlannerCategoryIntroduction(data.firstMessage, data.recommendedCategories);
  const body = `${input.forceRegeneratePrefix}${composed}`.trim();
  const text = sanitizeFeaturePlanningUserVisibleKorean(body).slice(0, 32000);
  return {
    id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    role: "ai",
    text,
    at: now,
    plannerSurface: "category_selection",
  };
}

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
      await requireProjectPermission(projectId, userId, "canEditProject", "POST /api/feature-planning/initialize");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    return await runWithPromptTimelineProject(projectId, async () => {
    const row = await findProjectScalarsByIdSafe(projectId);
    if (!row) {
      return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const state = parseRequirementsStateJson(row.requirementsStateJson);
    const existingArtifact = state.featurePlanningSlotsV1 ?? null;
    const existingChat = state.featurePlanningWorkspaceChatV1 ?? { messages: [] };
    const priorMessages = existingChat.messages ?? [];
    const hasSlots = Boolean(existingArtifact?.slots?.length);

    const apiKeyEarly = process.env.OPENAI_API_KEY?.trim();
    const modelEarly = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    if (!forceRegenerate && hasSlots) {
      const art: FeaturePlanningSlotsArtifactV1 = existingArtifact!;
      let returnArtifact: FeaturePlanningSlotsArtifactV1 = art;
      let returnMessages = toWorkspaceMessages(priorMessages);
      if (priorMessages.length === 0) {
        const repairMsg =
          apiKeyEarly ?
            await buildCategorySelectionPlannerMessage({
              row,
              artifact: art,
              apiKey: apiKeyEarly,
              model: modelEarly,
              forceRegeneratePrefix: "",
            })
          : ((): FeaturePlanningWorkspaceChatMessageV1 => {
              const fb = buildFallbackCategoryFirstMessage(art);
              const composed = composePlannerCategoryIntroduction(fb.firstMessage, fb.recommendedCategories);
              return {
                id: `fp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
                role: "ai",
                text: sanitizeFeaturePlanningUserVisibleKorean(composed).slice(0, 32000),
                at: new Date().toISOString(),
                plannerSurface: "category_selection",
              };
            })();
        const patch = await patchProjectRequirementsStateJson(projectId, {
          featurePlanningWorkspaceChatV1: { messages: [repairMsg] },
        });
        if (patch.ok) {
          const mergedState = parseRequirementsStateJson(patch.merged);
          returnMessages = toWorkspaceMessages(mergedState.featurePlanningWorkspaceChatV1?.messages ?? [repairMsg]);
          const mergedArt = mergedState.featurePlanningSlotsV1;
          if (mergedArt) returnArtifact = mergedArt;
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          generated: false,
          artifact: returnArtifact,
          slots: returnArtifact.slots,
          messages: returnMessages,
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

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const ctx = buildFeaturePlanningSlotsLlmContext({
      projectName: row.name,
      projectDescription: row.description,
      requirementsStateJson: row.requirementsStateJson,
      requirementsConversationJson: row.requirementsConversationJson,
      forceRegenerate: forceRegenerate === true,
    });

    const gen = await runFeaturePlanningInitializeLlm(ctx, apiKey, model);
    if (!gen.ok) {
      return NextResponse.json({ success: false, code: gen.code, message: gen.message }, { status: 200 });
    }

    const now = new Date().toISOString();
    const artifact: FeaturePlanningSlotsArtifactV1 = {
      ...gen.artifact,
      updatedAt: now,
      generatedAt: gen.artifact.generatedAt ?? now,
      userEdited: false,
    };

    const prefix = forceRegenerate && priorMessages.length ? `[기능 정리 초안 다시 만들기]\n\n` : "";
    const aiMsg = await buildCategorySelectionPlannerMessage({
      row,
      artifact,
      apiKey,
      model,
      forceRegeneratePrefix: prefix,
    });

    let nextMessages: FeaturePlanningWorkspaceChatMessageV1[];
    if (forceRegenerate && priorMessages.length) {
      nextMessages = [...priorMessages, aiMsg];
    } else {
      nextMessages = [aiMsg];
    }

    const patch = await patchProjectRequirementsStateJson(projectId, {
      featurePlanningSlotsV1: artifact,
      featurePlanningWorkspaceChatV1: { messages: nextMessages },
    });
    if (!patch.ok) {
      return NextResponse.json({ success: false, message: "저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        generated: true,
        artifact,
        slots: artifact.slots,
        messages: toWorkspaceMessages(nextMessages),
      },
    });
    });
  } catch (error) {
    console.error("POST /api/feature-planning/initialize error:", error);
    return NextResponse.json({ success: false, message: "초기화 중 오류가 발생했습니다." }, { status: 500 });
  }
}
