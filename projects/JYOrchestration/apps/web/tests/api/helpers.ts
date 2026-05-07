/**
 * API 통합 테스트용 HTTP 헬퍼 (실행 중인 Next 서버에 대해 fetch).
 * TEST_BASE_URL 기본: http://127.0.0.1:3000
 */

export const BASE_URL = (process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

export const SEED_OWNER_EMAIL = "owner@jyo.local";
export const SEED_OWNER_PASSWORD = "JyoTest!123";
export const SEED_EDITOR_EMAIL = "editor@jyo.local";
/** 시드 스크립트에서 모든 테스트 사용자에 동일 비밀번호 부여 */
export const SEED_EDITOR_PASSWORD = SEED_OWNER_PASSWORD;
export const SEED_REVIEWER_EMAIL = "reviewer@jyo.local";
export const SEED_REVIEWER_PASSWORD = SEED_OWNER_PASSWORD;
export const SEED_VIEWER_EMAIL = "viewer@jyo.local";
export const SEED_VIEWER_PASSWORD = SEED_OWNER_PASSWORD;
export const SEED_PROJECT_NAME = "Web Meeting MVP";

export function cookieHeaderFromResponse(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    const parts = headers.getSetCookie();
    return parts.map((c) => c.split(";")[0]?.trim()).filter(Boolean).join("; ");
  }
  const single = res.headers.get("set-cookie");
  if (!single) return "";
  return single
    .split(/,(?=[^;]+?=)/)
    .map((s) => s.trim().split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

export async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`login failed ${res.status}: ${j.message ?? res.statusText}`);
  }
  return cookieHeaderFromResponse(res);
}

export async function apiFetch(
  path: string,
  init: RequestInit & { cookie?: string } = {}
): Promise<Response> {
  const { cookie, headers: h, ...rest } = init;
  const headers = new Headers(h);
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  const url = path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...rest, headers });
}

export async function getSeedProjectId(ownerCookie: string): Promise<string> {
  const res = await apiFetch("/api/projects", { cookie: ownerCookie });
  const json = (await res.json()) as { success?: boolean; data?: { id: string; name: string }[] };
  if (!res.ok || !json.success || !Array.isArray(json.data)) {
    throw new Error("프로젝트 목록 조회 실패 — seed:test 를 먼저 실행하세요.");
  }
  const p = json.data.find((x) => x.name === SEED_PROJECT_NAME);
  if (!p) {
    throw new Error(`시드 프로젝트 "${SEED_PROJECT_NAME}" 없음 — npm run seed:test`);
  }
  return p.id;
}

export async function findAiMemberId(
  ownerCookie: string,
  projectId: string,
  aiAgentKey: string
): Promise<string> {
  const res = await apiFetch(`/api/project/members?projectId=${encodeURIComponent(projectId)}`, {
    cookie: ownerCookie,
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { memberId: string; aiAgentKey: string | null; memberType: string }[];
  };
  if (!res.ok || !json.success || !Array.isArray(json.data)) {
    throw new Error("멤버 목록 조회 실패");
  }
  const row = json.data.find((m) => m.memberType === "AI" && m.aiAgentKey === aiAgentKey);
  if (!row) {
    throw new Error(`AI 멤버 ${aiAgentKey} 없음`);
  }
  return row.memberId;
}

export async function fetchActionRowFromProjectList(
  cookie: string,
  projectId: string,
  actionId: string
): Promise<{
  id: string;
  status: string;
  reviewStatus: string | null;
  resultPayload: unknown;
} | undefined> {
  const res = await apiFetch(`/api/ai-member-actions?projectId=${encodeURIComponent(projectId)}`, { cookie });
  if (!res.ok) {
    return undefined;
  }
  const json = (await res.json()) as {
    data?: {
      id: string;
      status: string;
      reviewStatus?: string | null;
      resultPayload?: unknown;
    }[];
  };
  return json.data?.find((x) => x.id === actionId);
}

export async function runDispatchUntilIdle(
  cookie: string,
  projectId: string,
  maxRounds = 25
): Promise<void> {
  for (let i = 0; i < maxRounds; i++) {
    const res = await apiFetch("/api/ai-member-actions/dispatch/run-once", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(`run-once failed ${res.status}: ${j.message}`);
    }
    const json = (await res.json()) as { data?: { result?: string } };
    if (json.data?.result === "idle") {
      return;
    }
  }
  throw new Error("run-once: 최대 라운드 초과");
}
