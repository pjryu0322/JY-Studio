import { describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  getSeedProjectId,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
} from "./helpers";

describe("projects API", () => {
  it("[PRJ-001] 프로젝트 생성 성공", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const name = `Vitest Project ${Date.now()}`;
    const res = await apiFetch("/api/projects", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "api test",
        projectType: "web-service",
        defaultBranch: "main",
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { success?: boolean; data?: { id: string; name: string } };
    expect(json.success).toBe(true);
    expect(json.data?.name).toBe(name);
    expect(json.data?.id).toBeTruthy();
  });

  it("[PRJ-002] 프로젝트 목록 조회 (소유·멤버십)", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const res = await apiFetch("/api/projects", { cookie });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { name: string }[] };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data!.some((p) => p.name === "Web Meeting MVP")).toBe(true);
  });

  it("[PRJ-003] 미로그인 시 목록 401", async () => {
    const res = await apiFetch("/api/projects", {});
    expect(res.status).toBe(401);
  });

  it("[PRJ-004] 시드 프로젝트 owner 스코프 — owner가 id 조회 가능", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(cookie);
    const res = await apiFetch(`/api/project/session-context?projectId=${encodeURIComponent(projectId)}`, {
      cookie,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { myRole: string } };
    expect(json.success).toBe(true);
    expect(json.data?.myRole).toBe("OWNER");
  });
});
