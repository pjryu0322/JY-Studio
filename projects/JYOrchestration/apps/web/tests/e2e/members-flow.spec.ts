import { expect, test } from "@playwright/test";

import { E2E_SEED_OWNER_EMAIL, E2E_SEED_PASSWORD } from "./seedCredentials";

test.describe("E2E members", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(E2E_SEED_OWNER_EMAIL);
    await page.getByTestId("login-password").fill(E2E_SEED_PASSWORD);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
    await page.getByTestId("project-settings-seed").click();
    await page.getByRole("link", { name: "설정으로 이동" }).click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByRole("link", { name: "멤버 관리로 이동" }).click();
    await expect(page).toHaveURL(/\/project-admin\/members\?projectId=/, { timeout: 15_000 });
    await expect(page.getByTestId("project-unified-members-section")).toBeVisible({ timeout: 20_000 });
  });

  test("[E2E-MEM-001] HUMAN 멤버 패널 — 기존 Editor 표시", async ({ page }) => {
    await expect(page.getByText("Editor Lee").first()).toBeVisible();
  });

  test("[E2E-MEM-002] AI 멤버 추가", async ({ page }) => {
    const panel = page.getByTestId("project-unified-members-section");
    await page.getByTestId("member-invite-toggle").click();
    await panel.locator("select").first().selectOption("AI");
    const key = `e2e-ai-${Date.now()}`;
    await page.getByTestId("invite-ai-display-name").fill(`E2E Bot ${key}`);
    await page.getByTestId("invite-ai-provider").fill("INTERNAL");
    await page.getByTestId("invite-ai-agent-key").fill(key);
    await panel.locator("select").first().selectOption("EDITOR");
    await page.getByTestId("invite-submit").click();
    await expect(page.getByText(`E2E Bot ${key}`).first()).toBeVisible({ timeout: 20_000 });
  });
});
