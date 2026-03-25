import { describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  getSeedProjectId,
  SEED_EDITOR_EMAIL,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
  SEED_VIEWER_EMAIL,
} from "./helpers";

const SEED_PASSWORD = "JyoTest!123";

describe("members API", () => {
  it("[MEM-001] OWNER HUMAN 멤버 초대(기존 사용자 upsert)", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(cookie);
    const res = await apiFetch("/api/project/members/invite", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        memberType: "HUMAN",
        email: SEED_EDITOR_EMAIL,
        role: "EDITOR",
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean };
    expect(json.success).toBe(true);
  });

  it("[MEM-002] OWNER AI 멤버 추가", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(cookie);
    const key = `vitest-ai-${Date.now()}`;
    const res = await apiFetch("/api/project/members/invite", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        memberType: "AI",
        displayName: `Vitest Bot ${key}`,
        role: "EDITOR",
        aiProvider: "INTERNAL",
        aiAgentKey: key,
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { aiAgentKey: string | null } };
    expect(json.success).toBe(true);
    expect(json.data?.aiAgentKey).toBe(key);
  });

  it("[MEM-003] EDITOR는 멤버 초대 불가(OWNER 전용)", async () => {
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const cookie = await apiLogin(SEED_EDITOR_EMAIL, SEED_PASSWORD);
    const res = await apiFetch("/api/project/members/invite", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        memberType: "HUMAN",
        email: SEED_VIEWER_EMAIL,
        role: "VIEWER",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("[MEM-004] VIEWER는 멤버 초대 불가", async () => {
    const cookie = await apiLogin(SEED_VIEWER_EMAIL, SEED_PASSWORD);
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const res = await apiFetch("/api/project/members/invite", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        memberType: "AI",
        displayName: "Should Fail",
        role: "EDITOR",
        aiAgentKey: "should-fail",
      }),
    });
    expect(res.status).toBe(403);
  });
});
