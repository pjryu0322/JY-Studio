import { expect, test } from "@playwright/test";

test.describe("E2E AI policy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("owner@jyo.local");
    await page.getByTestId("login-password").fill("JyoTest!123");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-detail-tab-members").click();
    await page.getByTestId("project-unified-members-table-wrap").getByRole("button", { name: "AI" }).click();
    await page.getByTestId("project-unified-members-row").filter({ hasText: "OpenAI Reviewer" }).click();
    await expect(page.getByTestId("ai-reviewer-policy-section").first()).toBeVisible();
  });

  test("[E2E-POL-001] 리뷰어 승인 정책을 검토 후 실행으로 변경 후 자동 실행으로 복구", async ({ page }) => {
    const sel = page.getByTestId("ai-reviewer-policy-approval").first();
    await expect(sel).toBeVisible();
    await sel.selectOption("MANUAL_REVIEW");
    await page.getByTestId("ai-reviewer-policy-save").first().click();
    await page.waitForTimeout(1500);
    await expect(sel).toHaveValue("MANUAL_REVIEW");
    await sel.selectOption("AUTO_APPROVE");
    await page.getByTestId("ai-reviewer-policy-save").first().click();
    await page.waitForTimeout(1500);
    await expect(sel).toHaveValue("AUTO_APPROVE");
  });
});
