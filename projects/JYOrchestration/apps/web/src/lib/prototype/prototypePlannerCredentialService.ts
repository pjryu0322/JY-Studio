import { prisma } from "@/lib/prisma";

const DEFAULT_MODEL = "gpt-4o-mini";

export type PrototypePlannerCredentialSource = "project" | "user" | "env-dev" | "missing";

export type ResolvedPrototypePlannerOpenAiCredential = Readonly<{
  apiKey: string | null;
  source: PrototypePlannerCredentialSource;
  model: string;
}>;

function resolveModel(): string {
  const m = String(process.env.OPENAI_MODEL ?? "").trim();
  return m || DEFAULT_MODEL;
}

function allowEnvOpenAiFallback(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.JYO_PROTOTYPE_PLANNER_ALLOW_ENV_OPENAI === "1") return true;
  if (process.env.JYO_ALLOW_OPENAI_ENV_FALLBACK === "1") return true;
  return false;
}

/**
 * 프로토타입 AI 기획자용 OpenAI 키 해석.
 * 우선순위: 프로젝트 실행 설정 → 프로젝트 소유자 사용자 기본 → (로컬/명시 허용 시에만) 환경 변수.
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

  const setup = await prisma.executionSetup.findUnique({
    where: { projectId: pid },
    select: {
      openaiPlannerApiKey: true,
      project: { select: { ownerUserId: true } },
    },
  });

  const projectKey = String(setup?.openaiPlannerApiKey ?? "").trim();
  if (projectKey) {
    return { apiKey: projectKey, source: "project", model };
  }

  const ownerId = String(setup?.project?.ownerUserId ?? "").trim();
  const actorId = String(options?.actorUserId ?? "").trim();

  const tryUser = async (uid: string): Promise<string | null> => {
    if (!uid) return null;
    const u = await prisma.user.findUnique({
      where: { id: uid },
      select: { defaultOpenaiApiKey: true },
    });
    const k = String(u?.defaultOpenaiApiKey ?? "").trim();
    return k || null;
  };

  const ownerKey = await tryUser(ownerId);
  if (ownerKey) {
    return { apiKey: ownerKey, source: "user", model };
  }

  if (actorId && actorId !== ownerId) {
    const actorKey = await tryUser(actorId);
    if (actorKey) {
      return { apiKey: actorKey, source: "user", model };
    }
  }

  const envKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (envKey && allowEnvOpenAiFallback()) {
    return { apiKey: envKey, source: "env-dev", model };
  }

  return { apiKey: null, source: "missing", model };
}
