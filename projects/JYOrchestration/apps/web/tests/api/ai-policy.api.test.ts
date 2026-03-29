import { describe, expect, it } from "vitest";
import {
  apiFetch,
  apiLogin,
  fetchActionRowFromProjectList,
  runDispatchUntilIdle,
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
} from "./helpers";

describe("AI policy API", () => {
  const PW = SEED_OWNER_PASSWORD;
  let ownerCookie: string;
  let projectId: string;
  let aiMemberId: string;

  async function setupIsolation() {
    ownerCookie = await apiLogin(SEED_OWNER_EMAIL, PW);
    const create = await apiFetch("/api/projects", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Policy Vitest ${Date.now()}`,
        description: "approval policy api tests",
        projectType: "web-service",
      }),
    });
    expect(create.status).toBe(201);
    const cj = (await create.json()) as { data?: { id: string } };
    projectId = cj.data!.id;

    const inv = await apiFetch("/api/project/members/invite", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        memberType: "AI",
        displayName: "Policy Reviewer",
        role: "REVIEWER",
        aiProvider: "OPENAI",
        aiAgentKey: `policy-openai-${Date.now()}`,
      }),
    });
    expect(inv.status).toBe(200);
    const ij = (await inv.json()) as { data?: { id: string } };
    aiMemberId = ij.data!.id;
  }

  it("[POL-001] 기본 AUTO_APPROVE — 완료 후 APPROVED", async () => {
    await setupIsolation();
    const post = await apiFetch("/api/ai-member-actions", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectMemberId: aiMemberId,
        actionType: "TASK_DRAFT_REQUEST",
        executionMode: "STUB",
        requestPayload: { policy: "auto" },
      }),
    });
    expect(post.status).toBe(200);
    const pj = (await post.json()) as { data?: { id: string } };
    const actionId = pj.data!.id;

    await runDispatchUntilIdle(ownerCookie, projectId);

    const row = await fetchActionRowFromProjectList(ownerCookie, projectId, actionId);
    expect(row?.status).toBe("DONE");
    expect(row?.reviewStatus).toBe("APPROVED");
  });

  it("[POL-002] MANUAL_REVIEW 전환 시 PENDING_REVIEW", async () => {
    await setupIsolation();

    const patch = await apiFetch(`/api/project/members/${encodeURIComponent(aiMemberId)}`, {
      method: "PATCH",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiActionApprovalModeOverride: "MANUAL_REVIEW",
        aiActionApplyModeOverride: "MANUAL_APPLY",
      }),
    });
    expect(patch.status).toBe(200);

    const post = await apiFetch("/api/ai-member-actions", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectMemberId: aiMemberId,
        actionType: "REVIEW_REQUEST",
        executionMode: "STUB",
        requestPayload: { policy: "manual" },
      }),
    });
    expect(post.status).toBe(200);
    const pj = (await post.json()) as { data?: { id: string } };
    const actionId = pj.data!.id;

    await runDispatchUntilIdle(ownerCookie, projectId);

    const row = await fetchActionRowFromProjectList(ownerCookie, projectId, actionId);
    expect(row?.status).toBe("DONE");
    expect(row?.reviewStatus).toBe("PENDING_REVIEW");

    const reset = await apiFetch(`/api/project/members/${encodeURIComponent(aiMemberId)}`, {
      method: "PATCH",
      cookie: ownerCookie,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiActionApprovalModeOverride: null,
        aiActionApplyModeOverride: null,
      }),
    });
    expect(reset.status).toBe(200);
  });
});
