import { beforeAll, describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  fetchActionRowFromProjectList,
  runDispatchUntilIdle,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
} from "./helpers";

describe("AI actions API", () => {
  let ownerCookie: string;
  let projectId: string;
  let aiMemberId: string;

  beforeAll(async () => {
    ownerCookie = await apiLogin(SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    const create = await apiFetch("/api/projects", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `AI Vitest ${Date.now()}`,
        description: "isolated ai action tests",
        projectType: "web-service",
      }),
    });
    if (!create.ok) {
      throw new Error(`create project failed ${create.status}`);
    }
    const cj = (await create.json()) as { data?: { id: string } };
    projectId = cj.data!.id;

    const inv = await apiFetch("/api/project/members/invite", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        memberType: "AI",
        displayName: "Vitest Executor",
        role: "EDITOR",
        aiProvider: "INTERNAL",
        aiAgentKey: `vitest-exec-${Date.now()}`,
      }),
    });
    if (!inv.ok) {
      throw new Error(`invite ai failed ${inv.status}`);
    }
    const ij = (await inv.json()) as { data?: { id: string } };
    aiMemberId = ij.data?.id ?? "";
    if (!aiMemberId) {
      throw new Error("AI member id not resolved");
    }
  });

  it("[AI-001] AI action 생성 성공", async () => {
    const res = await apiFetch("/api/ai-member-actions", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectMemberId: aiMemberId,
        actionType: "SUMMARY_REQUEST",
        executionMode: "STUB",
        requestPayload: { vitest: true },
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean; data?: { id: string; status: string } };
    expect(json.success).toBe(true);
    expect(json.data?.status).toBe("REQUESTED");
    expect(json.data?.id).toBeTruthy();
  });

  it("[AI-002] run-once 후 DONE 및 결과 적재", async () => {
    const create = await apiFetch("/api/ai-member-actions", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectMemberId: aiMemberId,
        actionType: "QA_CHECK_REQUEST",
        executionMode: "STUB",
        requestPayload: { vitest: "dispatch" },
      }),
    });
    expect(create.ok).toBe(true);
    const cj = (await create.json()) as { data?: { id: string } };
    const actionId = cj.data!.id;

    await runDispatchUntilIdle(ownerCookie, projectId);

    const row = await fetchActionRowFromProjectList(ownerCookie, projectId, actionId);
    expect(row?.status).toBe("DONE");
    expect(row?.resultPayload).toBeTruthy();
  });
});
