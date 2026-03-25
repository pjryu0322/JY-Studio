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
    await page.getByTestId("expand-advanced-panel").click();
    await expect(page.getByTestId("ai-action-policy-section")).toBeVisible();
  });

  test("[E2E-POL-001] REVIEW_REQUEST 승인 정책을 MANUAL로 변경 후 복구", async ({ page }) => {
    const sel = page.getByTestId("policy-approval-REVIEW_REQUEST");
    await expect(sel).toBeVisible();
    await sel.selectOption("MANUAL_REVIEW");
    await page.waitForTimeout(1500);
    await expect(sel).toHaveValue("MANUAL_REVIEW");
    await sel.selectOption("AUTO_APPROVE");
    await page.waitForTimeout(1500);
    await expect(sel).toHaveValue("AUTO_APPROVE");
  });
});
