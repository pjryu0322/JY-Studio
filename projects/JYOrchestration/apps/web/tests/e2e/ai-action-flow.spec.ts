import { expect, test } from "@playwright/test";

test.describe("E2E AI action", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("owner@jyo.local");
    await page.getByTestId("login-password").fill("JyoTest!123");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-detail-tab-ai-members").click();
    await expect(page.getByTestId("ai-dispatch-run-once")).toBeVisible();
  });

  test("[E2E-AI-001] SUMMARY 요청 후 run-once로 DONE", async ({ page }) => {
    const projectId = new URL(page.url()).pathname.split("/projects/")[1] ?? "";
    expect(projectId.length).toBeGreaterThan(4);

    const membersRes = await page.request.get(
      `/api/project/members?projectId=${encodeURIComponent(projectId)}`
    );
    expect(membersRes.ok()).toBeTruthy();
    const membersJson = (await membersRes.json()) as {
      data?: { memberId: string; aiAgentKey: string | null }[];
    };
    const qa = membersJson.data?.find((m) => m.aiAgentKey === "qa-checker-01");
    expect(qa?.memberId).toBeTruthy();

    const post = await page.request.post("/api/ai-member-actions", {
      data: {
        projectId,
        projectMemberId: qa!.memberId,
        actionType: "SUMMARY_REQUEST",
        executionMode: "STUB",
        requestPayload: { e2e: true },
      },
    });
    expect(post.ok()).toBeTruthy();

    for (let i = 0; i < 20; i++) {
      await page.getByTestId("ai-dispatch-run-once").click();
      await page.waitForTimeout(500);
    }

    await expect(page.getByText("DONE").first()).toBeVisible({ timeout: 45_000 });
  });
});
