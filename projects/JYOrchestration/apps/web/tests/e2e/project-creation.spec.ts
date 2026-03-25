import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

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
    await expect(gitPanel.getByText("연결 안됨")).toBeVisible();
    await page.getByTestId("project-git-connect-tab").click();
    await expect(gitPanel.getByText(/Git 연결 기능은 준비 중입니다/)).toBeVisible();
  });

  test("[E2E-PRJ-002] 시드 프로젝트 진입", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.getByText("Web Meeting MVP").first()).toBeVisible({ timeout: 15_000 });
  });

  test("[E2E-PRJ-AI-001] AI 분석 시작: 업로드 → 분석 → Task 자동 생성", async ({ page }) => {
    await page.getByTestId("project-open-seed").click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });

    // 기존 파싱/생성 버튼은 제거되어야 합니다.
    await expect(page.getByRole("button", { name: /파싱 실행/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Task 생성$/i })).toHaveCount(0);

    // Prompt Guide는 기본적으로 프롬프트 원문을 노출하지 않습니다.
    await expect(page.getByTestId("project-spec-prompt-guide-content")).toHaveCount(0);

    // 실행 관측은 Task 관리/수행 영역에서만 보입니다.
    await expect(page.locator("#guided-flow-upload").getByTestId("execution-observability-panel")).toHaveCount(0);
    await expect(page.locator("#guided-flow-tasks").getByTestId("execution-observability-panel")).toHaveCount(1);

    // Prompt Guide 버튼 동작 및 "원문 노출"은 클릭 후에만 발생합니다.
    await page.getByTestId("project-spec-prompt-guide-open").click();
    await expect(page.getByTestId("project-spec-prompt-guide-content")).toBeVisible();
    // 다시 접기
    await page.getByRole("button", { name: "닫기" }).click();

    const tmpMdPath = path.join(__dirname, `tmp-projectspec-${Date.now()}.md`);
    fs.writeFileSync(
      tmpMdPath,
      `# Spec\n\n- 목표: E2E용 ProjectSpec 업로드\n- 기능: AI가 Task를 자동 생성\n- 제약: 없음\n`
    );

    const fileInput = page.locator("#projectspec-file-input");
    await fileInput.setInputFiles(tmpMdPath);

    const analyzeBtn = page.getByTestId("project-spec-ai-analyze-start");
    await expect(analyzeBtn).toBeEnabled();
    await analyzeBtn.click();

    await expect(page.getByTestId("ai-pipeline-status-panel")).toContainText("Task 생성 완료", {
      timeout: 60_000,
    });
    await expect(page.getByText(/AI가 .*개의 Task를 생성했습니다/)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#guided-flow-tasks")).toBeVisible();

    fs.unlinkSync(tmpMdPath);
  });
});
