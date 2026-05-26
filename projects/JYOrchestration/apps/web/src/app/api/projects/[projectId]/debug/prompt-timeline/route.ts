import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { getPromptTimelineEntries, listMessengerPromptTimelineEntriesForProject } from "@/lib/debug/promptTimelineStore";
import type { PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";
import type { FeaturePlanningPromptLogStatus } from "@/lib/debug/featurePlanningPromptPurpose";
import { prisma } from "@/lib/prisma";
import { coerceRequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { formatAiPlannerContextBlocksForTimeline } from "@/lib/requirements/aiPlannerContextBlocks";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { buildRequirementsPromptTimelineDebugEntryId } from "@/lib/debug/requirementsPromptTimelineDebugEntry";

function mapRequirementsPromptTimelineToDebugEntries(promptTimeline: unknown, projectId: string): PromptTimelineEntry[] {
  // `proj.requirementsStateJson` 전체를 받아도 promptTimeline을 파싱할 수 있어야 한다.
  const state = parseRequirementsStateJson(promptTimeline);
  const list = Array.isArray(state.promptTimeline) ? state.promptTimeline : [];
  const out: PromptTimelineEntry[] = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const e = coerceRequirementsPromptTimelineEntry(raw);
    if (!e) continue;
    const at = e.createdAt.trim();
    const action = e.action.trim();
    const stage = e.stage.trim();
    const source = e.source.trim();
    const promptText = String(e.promptText ?? e.fallbackText ?? "").trim();
    const responseText = String(e.responseText ?? "").trim();
    const error = String(e.error ?? "").trim();
    const model = e.model ?? null;
    const provider = String(e.provider ?? "").trim();
    const routingDecision = String(e.routingDecision ?? "").trim();
    const mode = e.aiPlannerMode ?? "project_single_chat";
    const ctxLine = e.contextBlocks ? formatAiPlannerContextBlocksForTimeline(e.contextBlocks) : "";
    const domainInjected = e.domainContextInjected ?? [];
    const label = [stage || "requirements", action || "promptTrace", mode].filter(Boolean).join(" · ");
    const outbound = [
      `mode=${mode}`,
      `projectId=${projectId}`,
      e.roomId ? `roomId=${e.roomId}` : "",
      `domainContextInjected=[${domainInjected.join(", ")}]`,
      ctxLine,
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
    const isPlatformTrace =
      provider === "platform" ||
      source === "platform" ||
      String(e.orchestrationTraceGroup ?? "").trim() === "platform_fast_plan";
    const status: FeaturePlanningPromptLogStatus =
      error && !responseText ?
        "FAILED"
      : responseText || isPlatformTrace ?
        "SUCCESS"
      : "FAILED";
    const overlay = extractOverlayPromptTraceMetadata(raw as Record<string, unknown>);
    const hasOverlayMetadata = Object.keys(overlay).length > 0;
    const channel: PromptTimelineEntry["channel"] =
      provider === "platform" || source === "platform" ? "platform" : "openai";
    out.push({
      id: buildRequirementsPromptTimelineDebugEntryId({ createdAt: at, action, ordinal: i }),
      at: at || new Date().toISOString(),
      channel,
      label,
      model,
      outbound,
      inbound,
      status,
      errorMessage: !responseText && error ? error : null,
      ...(hasOverlayMetadata ? { overlay } : {}),
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
