import { NextRequest, NextResponse } from "next/server";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  refineImplementationCodeTaskPlanWithLlm,
} from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import { CODE_TASK_LLM_JSON_SYSTEM_INSTRUCTIONS } from "@/lib/prototype/llmJsonParseRecovery";
import { resolveLlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

type PromptBody = Readonly<{
  readonly projectId?: string;
  readonly prompt?: string;
}>;

type PlanBody = Readonly<{
  readonly mode?: "plan";
  readonly projectId?: string;
  readonly taskList?: ImplementationTaskListV1;
  readonly heuristicPlan?: ImplementationCodeTaskPlanV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk?: boolean;
  readonly designOk?: boolean;
  readonly nowIso?: string;
  readonly forceLlm?: boolean;
}>;

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const userId = await requireSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as PromptBody & PlanBody;
  const projectId = String(body.projectId ?? "").trim();
  if (!projectId) {
    return NextResponse.json({ ok: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(userId, projectId, "project:edit");
  } catch (error) {
    return rbacErrorResponse(error);
  }

  const providerContext = await resolveLlmCodeTaskRefinementProviderContext({
    projectId,
    actorUserId: userId,
  });

  if (body.mode === "plan" && body.taskList && body.heuristicPlan) {
    const result = await refineImplementationCodeTaskPlanWithLlm({
      projectId,
      taskList: body.taskList,
      heuristicPlan: body.heuristicPlan,
      projectArtifacts: body.projectArtifacts,
      implementationSeedV1: body.implementationSeedV1,
      envOk: body.envOk === true,
      designOk: body.designOk === true,
      nowIso: body.nowIso,
      forceLlm: body.forceLlm,
      providerContext,
      llmCaller: undefined,
    });
    return NextResponse.json({ ok: true, result });
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ ok: false, message: "prompt 또는 plan payload가 필요합니다." }, { status: 400 });
  }

  const apiKey = String(providerContext.apiKey ?? "").trim();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "OpenAI Planner API key가 설정되어 있지 않습니다." },
      { status: 503 },
    );
  }

  const llmResult = await postOpenAiChatCompletion({
    apiKey,
    model: String(providerContext.model ?? "gpt-4o-mini"),
    temperature: 0.2,
    responseFormatJsonObject: true,
    maxTokens: 4096,
    returnUsage: true,
    messages: [
      {
        role: "system",
        content: CODE_TASK_LLM_JSON_SYSTEM_INSTRUCTIONS,
      },
      { role: "user", content: prompt },
    ],
  });

  if (!llmResult.ok) {
    return NextResponse.json({ ok: false, message: llmResult.message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    text: llmResult.text,
    ...(llmResult.usage
      ? {
          usage: {
            promptTokens: llmResult.usage.promptTokens,
            completionTokens: llmResult.usage.completionTokens,
            totalTokens: llmResult.usage.totalTokens,
            model: String(providerContext.model ?? "gpt-4o-mini"),
          },
        }
      : {}),
  });
}
