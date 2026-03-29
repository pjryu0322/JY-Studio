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

  test("[E2E-PRJ-003] 상세 — 실행 환경 탭은 런타임 연결·검증 중심(중복 프로젝트 요약 없음)", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-detail-tab-execution").click();
    const env = page.getByTestId("project-execution-environment-panel");
    await expect(env).toBeVisible();
    await expect(env.getByTestId("project-advanced-settings-panel")).toHaveCount(0);
    await expect(env.getByText("Project Type")).toHaveCount(0);
    await expect(env.locator("#execution-setup-panel")).toBeVisible();
  });

  test("[E2E-PRJ-004] 상세 — 실행 환경 탭 연결 UI", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-detail-tab-execution").click();
    const envPanel = page.getByTestId("project-execution-environment-panel");
    await expect(envPanel).toBeVisible();
    await expect(envPanel.getByRole("heading", { name: /실행 환경/i })).toBeVisible();
    await expect(envPanel.getByText("실행 준비 상태")).toBeVisible();
    await expect(envPanel.getByRole("button", { name: "저장소 연결 검증" })).toBeVisible();
    await expect(envPanel.getByRole("button", { name: "Cursor API 검증" })).toBeVisible();
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
