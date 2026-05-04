import { getOpenAiApiKeyForProject } from "@/lib/integrations/providerAdapters/openaiAdapter";

const DEFAULT_MODEL = "gpt-4o-mini";

export type PrototypePlannerCredentialSource = "project" | "user" | "env-dev" | "missing" | "integrations";

export type ResolvedPrototypePlannerOpenAiCredential = Readonly<{
  apiKey: string | null;
  source: PrototypePlannerCredentialSource;
  model: string;
}>;

function resolveModel(): string {
  const m = String(process.env.OPENAI_MODEL ?? "").trim();
  return m || DEFAULT_MODEL;
}

/**
 * 프로토타입 생성(작업계획)용 OpenAI 키 해석.
 * `resolveProvider(projectId, LLM)` 체인(연동 테이블·실행 설정·레거시 사용자 키·env)을 따릅니다.
 */
export async function resolvePrototypePlannerOpenAiCredential(
  projectId: string,
  options?: { actorUserId?: string | null },
): Promise<ResolvedPrototypePlannerOpenAiCredential> {
  const pid = String(projectId ?? "").trim();
  const model = resolveModel();
  if (!pid) {
    return { apiKey: null, source: "missing", model };
  }

  try {
    const resolved = await getOpenAiApiKeyForProject(pid, { actorUserId: options?.actorUserId ?? null });
    const apiKey = resolved.apiKey;
    if (!apiKey) {
      return { apiKey: null, source: "missing", model };
    }
    let source: PrototypePlannerCredentialSource = "integrations";
    if (resolved.source.startsWith("execution_setup")) source = "project";
    else if (resolved.source.startsWith("legacy.") || resolved.source.startsWith("user_integrations")) source = "user";
    else if (resolved.source.startsWith("integration.")) source = "integrations";
    else if (resolved.source.startsWith("env.")) source = "env-dev";
    return { apiKey, source, model };
  } catch (e) {
    console.error("[prototype-planner] getOpenAiApiKeyForProject failed:", e);
    return { apiKey: null, source: "missing", model };
  }
}
