import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { buildFeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";
import { randomUUID } from "node:crypto";
import { patchProjectRequirementsStateJson } from "@/lib/featurePlanning/saveFeaturePlanningWorkspace";
import { runFeaturePlanningAnalyzeChecklistLlm } from "@/lib/featurePlanning/runFeaturePlanningAnalyzeChecklistLlm";
import { resumeOpeningFromChecklist } from "@/lib/featurePlanning/featurePlanningDynamicChecklist";
import { sanitizeFeaturePlanningUserVisibleKorean } from "@/lib/featurePlanning/featurePlanningUserVisibleSanitize";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import { runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { withFeaturePlanningProjectLock } from "@/lib/featurePlanning/featurePlanningProjectLock";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { findProjectScalarsByIdSafe } from "@/lib/service/projectFindForApi";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  firstFlowStepTitleForFeaturePlanningEntry,
  FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE,
  isServiceFlowApprovedForFeaturePlanning,
} from "@/lib/featurePlanning/featurePlanningServiceFlowGate";

type Body = { projectId?: string };

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

/** 저장된 슬롯을 유지한 채 첫 AI 메시지만 OpenAI로 다시 생성합니다. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canEditProject", "POST /api/feature-planning/reseed-first-message");
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
      const art = state.featurePlanningSlotsV1 ?? null;
      if (!art?.slots?.length) {
        return NextResponse.json(
          { success: false, code: "NO_SLOTS", message: "기능 정리 슬롯이 없습니다. 먼저 초기화를 실행해 주세요." },
          { status: 400 },
        );
      }

      if (!isServiceFlowApprovedForFeaturePlanning(row.requirementsStateJson)) {
        return NextResponse.json(
          {
            success: false,
            code: "SERVICE_FLOW_INCOMPLETE",
            message: FEATURE_PLANNING_SERVICE_FLOW_INCOMPLETE_MESSAGE.trim(),
          },
          { status: 403 },
        );
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
        forceRegenerate: false,
      });

      const firstStepTitle = firstFlowStepTitleForFeaturePlanningEntry(state.serviceFlowV1 ?? null);
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
        featurePlanningWorkspaceChatV1: { messages: [gen.aiMessage] },
      });
      if (!patch.ok) {
        return NextResponse.json({ success: false, message: "저장에 실패했습니다." }, { status: 500 });
      }

      const mergedState = parseRequirementsStateJson(patch.merged);
      return NextResponse.json({
        success: true,
        data: {
          artifact: gen.artifact,
          slots: gen.artifact.slots,
          messages: toWorkspaceMessages(mergedState.featurePlanningWorkspaceChatV1?.messages ?? [gen.aiMessage]),
        },
      });
    })
    );
  } catch (error) {
    console.error("POST /api/feature-planning/reseed-first-message error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
