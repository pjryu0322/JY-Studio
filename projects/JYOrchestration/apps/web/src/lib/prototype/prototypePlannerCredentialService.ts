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

  let setup: { openaiPlannerApiKey: string | null; project: { ownerUserId: string } | null } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId: pid },
      select: {
        openaiPlannerApiKey: true,
        project: { select: { ownerUserId: true } },
      },
    });
  } catch (e) {
    /**
     * 로컬/개발 환경에서 마이그레이션이 덜 된 DB(컬럼 누락 등)에서도
     * 플래너가 “무한 대기”로 보이지 않도록 안전하게 missing으로 처리한다.
     */
    console.error("[prototype-planner] executionSetup lookup failed:", e);
    setup = null;
  }

  const projectKey = String(setup?.openaiPlannerApiKey ?? "").trim();
  if (projectKey) {
    return { apiKey: projectKey, source: "project", model };
  }

  const ownerId = String(setup?.project?.ownerUserId ?? "").trim();
  const actorId = String(options?.actorUserId ?? "").trim();

  const tryUser = async (uid: string): Promise<string | null> => {
    if (!uid) return null;
    try {
      const u = await prisma.user.findUnique({
        where: { id: uid },
        select: { defaultOpenaiApiKey: true },
      });
      const k = String(u?.defaultOpenaiApiKey ?? "").trim();
      return k || null;
    } catch (e) {
      /**
       * DB 스키마 불일치(P2022: column does not exist) 등으로 user 조회가 실패할 수 있다.
       * 이 경우 user 키 경로만 포기하고 env fallback(허용 시) 또는 missing으로 진행한다.
       */
      console.error("[prototype-planner] user defaultOpenaiApiKey lookup failed:", e);
      return null;
    }
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
