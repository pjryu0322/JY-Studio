import { expect, test } from "@playwright/test";

test.describe("E2E project", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill("owner@jyo.local");
    await page.getByTestId("login-password").fill("JyoTest!123");
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
  });

  test("[E2E-PRJ-001] 생성 폼은 이름·설명 입력만, 생성 후 상세로 이동", async ({ page }) => {
    const form = page.getByTestId("home-create-project-form");
    await expect(form.locator('input[type="text"]')).toHaveCount(1);
    await expect(form.locator("textarea")).toHaveCount(1);
    await expect(form.locator("select")).toHaveCount(0);

    const name = `E2E Project ${Date.now()}`;
    await page.getByTestId("home-project-name").fill(name);
    await page.getByTestId("home-project-description").fill("E2E 설명");
    await page.getByTestId("home-create-project").click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  });

  test("[E2E-PRJ-003] 상세 — 고급 설정 탭에서 유형·저장소·브랜치 확인", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-detail-tab-advanced").click();
    const panel = page.getByTestId("project-advanced-settings-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("combobox")).toHaveValue("web-service");
    await expect(panel.getByLabel("Repository URL")).toBeVisible();
    await expect(panel.getByLabel("Default Branch")).toHaveValue("main");
  });

  test("[E2E-PRJ-004] 상세 — Git Integration 탭 연결 UI", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-detail-tab-git").click();
    const gitPanel = page.getByTestId("project-git-integration-panel");
    await expect(gitPanel).toBeVisible();
    await expect(gitPanel.getByText("연결 안됨")).toBeVisible();
    await page.getByTestId("project-git-connect-tab").click();
    await expect(gitPanel.getByText(/Git 연결 기능은 준비 중입니다/)).toBeVisible();
  });

  test("[E2E-PRJ-002] 시드 프로젝트 진입", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.getByText("Web Meeting MVP").first()).toBeVisible({ timeout: 15_000 });
  });
});
