import { describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  getSeedProjectId,
  SEED_EDITOR_EMAIL,
  SEED_EDITOR_PASSWORD,
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
    const json = (await res.json()) as {
      success?: boolean;
      data?: { id: string; name: string; workflowStatus?: string | null };
    };
    expect(json.success).toBe(true);
    expect(json.data?.name).toBe(name);
    expect(json.data?.id).toBeTruthy();
    expect(json.data?.workflowStatus).toBe("REQUIREMENTS_PENDING");
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

  it("[PRJ-005] GET 단일 프로젝트", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(cookie);
    const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, { cookie });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { id: string; status: string } };
    expect(json.success).toBe(true);
    expect(json.data?.id).toBe(projectId);
    expect(json.data?.status).toBeTruthy();
  });

  it("[PRJ-006] EDITOR는 시드 프로젝트 DELETE 403", async () => {
    const cookie = await apiLogin(SEED_EDITOR_EMAIL, SEED_EDITOR_PASSWORD);
    const ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const projectId = await getSeedProjectId(ownerCookie);
    const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      cookie,
    });
    expect(res.status).toBe(403);
  });

  it("[PRJ-007] OWNER 소프트 삭제 후 목록에서 제외 · includeDeleted 시 포함", async () => {
    const cookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const name = `SoftDel ${Date.now()}`;
    const create = await apiFetch("/api/projects", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "soft delete test",
        projectType: "web-service",
        defaultBranch: "main",
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { data?: { id: string } };
    const pid = created.data?.id;
    expect(pid).toBeTruthy();

    const prev = await apiFetch("/api/projects", { cookie });
    const prevJson = (await prev.json()) as { data?: { id: string }[] };
    expect(prevJson.data?.some((p) => p.id === pid)).toBe(true);

    const del = await apiFetch(`/api/projects/${encodeURIComponent(pid!)}`, { method: "DELETE", cookie });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as { data?: { status: string; deletedAt: string | null } };
    expect(delBody.data?.status).toBe("DELETED");
    expect(delBody.data?.deletedAt).toBeTruthy();

    const list = await apiFetch("/api/projects", { cookie });
    const listJson = (await list.json()) as { data?: { id: string }[] };
    expect(listJson.data?.some((p) => p.id === pid)).toBe(false);

    const listAll = await apiFetch("/api/projects?includeDeleted=1", { cookie });
    const allJson = (await listAll.json()) as { data?: { id: string; status: string }[] };
    const row = allJson.data?.find((p) => p.id === pid);
    expect(row?.status).toBe("DELETED");
  });
});
