import { describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  getSeedProjectId,
  SEED_EDITOR_EMAIL,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
  SEED_REVIEWER_EMAIL,
  SEED_VIEWER_EMAIL,
} from "./helpers";

const PW = "JyoTest!123";

describe("RBAC API", () => {
  it("[RBAC-001] EDITOR는 git 정책 PATCH 불가", async () => {
    const cookie = await apiLogin(SEED_EDITOR_EMAIL, PW);
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const res = await apiFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gitApprovalMode: "NO_APPROVAL" }),
    });
    expect(res.status).toBe(403);
  });

  it("[RBAC-002] REVIEWER는 프로젝트 세션 컨텍스트 조회 가능", async () => {
    const cookie = await apiLogin(SEED_REVIEWER_EMAIL, PW);
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const res = await apiFetch(`/api/project/session-context?projectId=${encodeURIComponent(projectId)}`, {
      cookie,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: { myRole: string } };
    expect(json.data?.myRole).toBe("REVIEWER");
  });

  it("[RBAC-003] VIEWER는 session-context 조회만 가능(역할 VIEWER)", async () => {
    const cookie = await apiLogin(SEED_VIEWER_EMAIL, PW);
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const res = await apiFetch(`/api/project/session-context?projectId=${encodeURIComponent(projectId)}`, {
      cookie,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: { myRole: string } };
    expect(json.data?.myRole).toBe("VIEWER");
  });

  it("[RBAC-004] VIEWER는 AI 액션 생성 불가", async () => {
    const cookie = await apiLogin(SEED_VIEWER_EMAIL, PW);
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const members = await apiFetch(`/api/project/members?projectId=${encodeURIComponent(projectId)}`, {
      cookie: ownerCookie,
    });
    const mj = (await members.json()) as {
      data?: { memberId: string; aiAgentKey: string | null; memberType: string }[];
    };
    const ai = mj.data?.find((m) => m.aiAgentKey === "openai-reviewer-01");
    expect(ai).toBeTruthy();
    const res = await apiFetch("/api/ai-member-actions", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectMemberId: ai!.memberId,
        actionType: "SUMMARY_REQUEST",
        requestPayload: { test: true },
      }),
    });
    expect(res.status).toBe(403);
  });

  it("[RBAC-005] cross-project: 타 프로젝트 session-context 403", async () => {
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const isolatedName = `RBAC Isolated ${Date.now()}`;
    const create = await apiFetch("/api/projects", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: isolatedName,
        description: "no members except owner",
        projectType: "web-service",
      }),
    });
    expect(create.status).toBe(201);
    const cj = (await create.json()) as { data?: { id: string } };
    const isolatedId = cj.data!.id;

    const viewerCookie = await apiLogin(SEED_VIEWER_EMAIL, PW);
    const res = await apiFetch(`/api/project/session-context?projectId=${encodeURIComponent(isolatedId)}`, {
      cookie: viewerCookie,
    });
    expect(res.status).toBe(403);
  });
});
