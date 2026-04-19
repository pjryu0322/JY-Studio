import { expect, test } from "@playwright/test";

test.describe("E2E auth", () => {
  test("[E2E-AUTH-001] 회원가입 후 홈", async ({ page }) => {
    const email = `e2e.${Date.now()}@jyo.test`;
    await page.goto("/login");
    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("register-name").fill("E2E User");
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill("JyoTest!123");
    await page.getByTestId("register-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByText("E2E User").first()).toBeVisible();
  });

  test("[E2E-AUTH-002] Owner 로그인", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("owner@jyo.local");
    await page.getByTestId("login-password").fill("JyoTest!123");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByText("Owner Kim").first()).toBeVisible();
  });

  test("[E2E-AUTH-003] 로그아웃", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("owner@jyo.local");
    await page.getByTestId("login-password").fill("JyoTest!123");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
    await page.getByTestId("platform-top-logout").click();
    await expect(page.getByText("로그인이 필요합니다.").first()).toBeVisible({ timeout: 15_000 });
  });
});
