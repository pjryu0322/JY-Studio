import { expect, test } from "@playwright/test";

test.describe("E2E project", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("owner@jyo.local");
    await page.getByTestId("login-password").fill("JyoTest!123");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
  });

  test("[E2E-PRJ-001] 프로젝트 생성 후 목록에 표시", async ({ page }) => {
    const name = `E2E Project ${Date.now()}`;
    await page.getByTestId("home-project-name").fill(name);
    await page.getByTestId("home-create-project").click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
  });

  test("[E2E-PRJ-002] 시드 프로젝트 진입", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.getByText("Web Meeting MVP").first()).toBeVisible({ timeout: 15_000 });
  });
});
