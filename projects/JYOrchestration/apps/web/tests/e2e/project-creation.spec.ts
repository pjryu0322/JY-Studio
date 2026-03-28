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
    await page.getByTestId("project-detail-settings-toggle").click();
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
    await page.getByTestId("project-detail-settings-toggle").click();
    await page.getByTestId("project-detail-tab-git").click();
    const gitPanel = page.getByTestId("project-git-integration-panel");
    await expect(gitPanel).toBeVisible();
    await expect(gitPanel.getByText("등록된 저장소 없음")).toBeVisible();
    await page.getByTestId("project-git-connect-tab").click();
    await expect(gitPanel.getByText(/연결 마법사는 준비 중입니다/)).toBeVisible();
  });

  test("[E2E-PRJ-002] 시드 프로젝트 진입", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.getByText("Web Meeting MVP").first()).toBeVisible({ timeout: 15_000 });
  });

  test("[E2E-PRJ-AI-001] Overview: 워크스페이스·저장 계획 기반 Spec 생성 UI (프롬프트 노출 없음)", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });

    // 기존 파싱/생성 버튼은 제거되어야 합니다.
    await expect(page.getByRole("button", { name: /파싱 실행/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Task 생성$/i })).toHaveCount(0);

    await expect(page.getByTestId("project-spec-workspace")).toBeVisible();
    await expect(page.getByTestId("spec-workspace-ai-model")).toBeVisible();
    await expect(page.getByTestId("spec-workspace-ai-request")).toBeVisible();

    await expect(page.getByTestId("spec-workspace-toggle-prompt")).toHaveCount(0);
    await expect(page.getByTestId("spec-workspace-copy-prompt")).toHaveCount(0);
    await expect(page.getByTestId("spec-workspace-regenerate-prompt")).toHaveCount(0);

    // 실행 관측은 Task 관리/수행 영역에서만 보입니다(워크스페이스에는 없음).
    await expect(page.getByTestId("project-spec-workspace").getByTestId("execution-observability-panel")).toHaveCount(0);
    await expect(page.locator("#guided-flow-tasks").getByTestId("execution-observability-panel")).toHaveCount(1);

    await expect(page.locator("#guided-flow-tasks")).toBeVisible();
  });
});
