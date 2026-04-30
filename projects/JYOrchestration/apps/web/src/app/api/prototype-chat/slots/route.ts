import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  templateName?: string;
  ideationSummary?: string;
  actorFlowSummary?: string;
};

type PrototypeSlot = {
  key: string;
  title: string;
  question: string;
  required: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const templateName = String(body.templateName ?? "").trim();
    const ideationSummary = String(body.ideationSummary ?? "").trim();
    const actorFlowSummary = String(body.actorFlowSummary ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-chat/slots");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." },
        { status: 200 },
      );
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const system = `You are a Korean AI product planner for "prototype generation".
Goal: produce a small set of interview slots to guide the user to a concrete prototype scope.
Rules:
- Output ONLY valid JSON. No markdown fences.
- Keep it within prototype generation scope (template choice, target users/roles, main screens, data, auth, integrations, exclusions, success criteria).
- Each slot must have exactly one question sentence ending with "?".`;

    const user = `Project name: ${projectName || "(none)"}
Project description: ${projectDescription || "(none)"}
Template: ${templateName || "(unknown)"}

[Ideation summary]
${ideationSummary || "(none)"}

[Actor/flow summary]
${actorFlowSummary || "(none)"}

Return JSON with this schema:
{
  "slots": [
    { "key": "scope", "title": "범위", "question": "....?", "required": true }
  ]
}

Constraints:
- 6 to 9 slots total
- keys must be short snake_case and unique
- questions must be in Korean`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, code: `HTTP_${res.status}`, message: errText.slice(0, 500) || `HTTP ${res.status}` },
        { status: 200 },
      );
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ success: false, code: "EMPTY", message: "AI 응답 본문이 비어 있습니다." }, { status: 200 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ success: false, code: "PARSE", message: "AI JSON 파싱에 실패했습니다." }, { status: 200 });
    }

    const root = parsed as { slots?: unknown };
    const rawSlots = Array.isArray(root?.slots) ? root.slots : [];
    const slots: PrototypeSlot[] = rawSlots
      .map((s) => {
        const o = s as Record<string, unknown>;
        const key = String(o.key ?? "").trim();
        const title = String(o.title ?? "").trim();
        const question = String(o.question ?? "").trim();
        const required = Boolean(o.required);
        if (!key || !title || !question) return null;
        return { key, title, question, required };
      })
      .filter(Boolean) as PrototypeSlot[];

    if (slots.length < 3) {
      return NextResponse.json({ success: false, code: "SCHEMA", message: "슬롯 생성 결과가 부족합니다." }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: { slots, model } });
  } catch (error) {
    console.error("POST /api/prototype-chat/slots error:", error);
    return NextResponse.json({ success: false, message: "슬롯 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}

