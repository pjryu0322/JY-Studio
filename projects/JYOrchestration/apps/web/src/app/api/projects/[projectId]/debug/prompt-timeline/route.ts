import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { getPromptTimelineEntries, listMessengerPromptTimelineEntriesForProject } from "@/lib/debug/promptTimelineStore";
import type { PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";
import type { FeaturePlanningPromptLogStatus } from "@/lib/debug/featurePlanningPromptPurpose";
import { prisma } from "@/lib/prisma";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

function mapRequirementsPromptTimelineToDebugEntries(promptTimeline: unknown, projectId: string): PromptTimelineEntry[] {
  // `proj.requirementsStateJson` 전체를 받아도 promptTimeline을 파싱할 수 있어야 한다.
  const state = parseRequirementsStateJson(promptTimeline);
  const list = Array.isArray(state.promptTimeline) ? state.promptTimeline : [];
  const out: PromptTimelineEntry[] = [];
  for (const e of list) {
    const at = String((e as any).createdAt ?? "").trim();
    const action = String((e as any).action ?? "").trim();
    const stage = String((e as any).stage ?? "").trim();
    const source = String((e as any).source ?? "").trim();
    const promptText = String((e as any).promptText ?? (e as any).fallbackText ?? "").trim();
    const responseText = String((e as any).responseText ?? "").trim();
    const error = String((e as any).error ?? "").trim();
    const model = (typeof (e as any).model === "string" || (e as any).model === null) ? ((e as any).model as string | null) : null;
    const provider = String((e as any).provider ?? "").trim();
    const routingDecision = String((e as any).routingDecision ?? "").trim();
    const label = [stage || "requirements", action || "promptTrace"].filter(Boolean).join(" · ");
    const outbound = [
      `projectId=${projectId}`,
      source ? `source=${source}` : "",
      provider ? `provider=${provider}` : "",
      routingDecision ? `routingDecision=${routingDecision}` : "",
      promptText ? `\n[prompt]\n${promptText}` : "\n[prompt]\n(없음)",
    ]
      .filter(Boolean)
      .join("\n");
    const inbound =
      responseText
        ? `[response]\n${responseText}`
        : error
          ? `[FAILED]\n${error}`
          : "[response]\n(없음)";
    const status: FeaturePlanningPromptLogStatus = responseText ? "SUCCESS" : "FAILED";
    out.push({
      id: `req_${String(at || Date.now())}_${action || "trace"}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 48),
      at: at || new Date().toISOString(),
      channel: "openai",
      label,
      model,
      outbound,
      inbound,
      status,
      errorMessage: !responseText && error ? error : null,
    });
  }
  return out.reverse(); // newest first (match debug store behavior)
}

export async function GET(request: NextRequest, segmentData: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: rawId } = await segmentData.params;
    const projectId = String(rawId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/projects/[projectId]/debug/prompt-timeline");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const debugEntries = [...getPromptTimelineEntries(projectId)];
    const messengerEntries = await listMessengerPromptTimelineEntriesForProject(projectId);
    const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { requirementsStateJson: true } });
    const reqEntries = mapRequirementsPromptTimelineToDebugEntries(proj?.requirementsStateJson ?? null, projectId);
    const entries = [...reqEntries, ...debugEntries, ...messengerEntries].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return NextResponse.json({ success: true, data: { entries } });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/debug/prompt-timeline error:", error);
    return NextResponse.json({ success: false, message: "프롬프트 타임라인 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
