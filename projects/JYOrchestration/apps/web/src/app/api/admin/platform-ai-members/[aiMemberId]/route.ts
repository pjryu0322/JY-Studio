import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { canAccessPlatformAdminConsole } from "@/lib/admin/platformAdmin";
import {
  diffPlatformAiMemberFromDefault,
  getPlatformAiMemberById,
  type PlatformAiCapability,
  type PlatformAiMember,
} from "@/lib/ai/platformAiMembers";
import { getMergedPlatformAiMemberById } from "@/lib/server/platformAiMembersMerged";
import { upsertMemberDiffOverride } from "@/lib/server/platformAiMemberOverridesStore";

const CAPS = new Set<PlatformAiCapability>(["LLM", "CODE", "SECURITY"]);

function validatePayload(base: PlatformAiMember, body: unknown): { ok: true; value: PlatformAiMember } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "본문이 올바르지 않습니다." };
  const o = body as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (id !== base.id) return { ok: false, message: "id가 일치하지 않습니다." };
  const name = String(o.name ?? "").trim();
  const role = String(o.role ?? "").trim();
  const capability = o.capability as PlatformAiCapability;
  if (!CAPS.has(capability)) return { ok: false, message: "capability가 올바르지 않습니다." };
  const persona = String(o.persona ?? "");
  const behaviorRules = String(o.behaviorRules ?? "");
  const knowledge = String(o.knowledge ?? "");
  const policy = o.policy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    return { ok: false, message: "policy는 객체여야 합니다." };
  }
  const defaultEngine = String(o.defaultEngine ?? "").trim();
  if (!defaultEngine) return { ok: false, message: "기본 엔진을 선택하세요." };

  return {
    ok: true,
    value: {
      id: base.id,
      name,
      role,
      capability,
      persona,
      behaviorRules,
      knowledge,
      policy: policy as Record<string, unknown>,
      defaultEngine,
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ aiMemberId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    if (!actor || !canAccessPlatformAdminConsole(actor.globalRole, actor.email)) {
      return NextResponse.json({ success: false, message: "플랫폼 관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const { aiMemberId } = await context.params;
    const id = String(aiMemberId ?? "").trim();
    const member = await getMergedPlatformAiMemberById(id);
    if (!member) {
      return NextResponse.json({ success: false, message: "해당 AI 멤버를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { member } });
  } catch (error) {
    console.error("GET /api/admin/platform-ai-members/[aiMemberId] error:", error);
    return NextResponse.json({ success: false, message: "불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ aiMemberId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    if (!actor || !canAccessPlatformAdminConsole(actor.globalRole, actor.email)) {
      return NextResponse.json({ success: false, message: "플랫폼 관리자만 수정할 수 있습니다." }, { status: 403 });
    }

    const { aiMemberId } = await context.params;
    const id = String(aiMemberId ?? "").trim();
    const base = getPlatformAiMemberById(id);
    if (!base) {
      return NextResponse.json({ success: false, message: "해당 AI 멤버를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const parsed = validatePayload(base, body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
    }

    const patch = diffPlatformAiMemberFromDefault(base, parsed.value);
    await upsertMemberDiffOverride(id, patch);
    const member = await getMergedPlatformAiMemberById(id);
    return NextResponse.json({ success: true, data: { member }, message: "저장했습니다." });
  } catch (error) {
    console.error("PUT /api/admin/platform-ai-members/[aiMemberId] error:", error);
    return NextResponse.json({ success: false, message: "저장하지 못했습니다." }, { status: 500 });
  }
}
