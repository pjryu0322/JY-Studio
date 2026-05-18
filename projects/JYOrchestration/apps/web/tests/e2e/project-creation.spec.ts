import { expect, test } from "@playwright/test";

import { E2E_SEED_OWNER_EMAIL, E2E_SEED_PASSWORD } from "./seedCredentials";

test.describe("E2E project", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(E2E_SEED_OWNER_EMAIL);
    await page.getByTestId("login-password").fill(E2E_SEED_PASSWORD);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/$/, { timeout: 30_000 });
  });

  test("[E2E-PRJ-001] 생성 폼은 이름·설명 입력만, 생성 후 홈 유지 → 프로젝트 열기 → 아이디어 구체화", async ({ page }) => {
    const form = page.getByTestId("home-create-project-form");
    await expect(form.locator('input[type="text"]')).toHaveCount(1);
    await expect(form.locator("textarea")).toHaveCount(1);
    await expect(form.locator("select")).toHaveCount(0);

    const name = `E2E Project ${Date.now()}`;
    await page.getByTestId("home-project-name").fill(name);
    await page.getByTestId("home-project-description").fill("E2E 설명");

    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/projects") && r.request().method() === "POST" && r.ok()),
      page.getByTestId("home-create-project").click(),
    ]);
    const createJson = (await createRes.json()) as { data?: { id?: string } };
    const projectId = createJson.data?.id;
    expect(projectId).toBeTruthy();

    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByTestId("home-project-created-toast")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`project-card-${projectId}`)).toBeVisible({ timeout: 15_000 });

    const ideaPagePromise = page.context().waitForEvent("page");
    await page.getByTestId(`project-open-${projectId}`).click();
    const ideaPage = await ideaPagePromise;
    await ideaPage.waitForLoadState("domcontentloaded");
    await expect(ideaPage).toHaveURL(
      (url) => {
        try {
          const u = new URL(url);
          return u.pathname === "/requirements" && u.searchParams.get("projectId") === projectId;
        } catch {
          return false;
        }
      },
      { timeout: 20_000 }
    );
    await expect(ideaPage.getByText(name).first()).toBeVisible({ timeout: 15_000 });

    await ideaPage.getByTestId("requirements-chat-input").fill(`E2E 아이디어: ${name}`);
    await ideaPage.getByRole("button", { name: "전송" }).click();
    await expect(ideaPage.getByText(`E2E 아이디어: ${name}`)).toBeVisible({ timeout: 15_000 });
    await ideaPage.getByTestId("requirements-scope-in").fill("회의록 업로드·요약·액션 항목 추출");
    await ideaPage.getByTestId("requirements-scope-out").fill("결제·모바일 네이티브 앱");
    await ideaPage.getByTestId("requirements-target-users").fill("팀 리더·PM");
    await ideaPage.getByTestId("requirements-success-criteria").fill("회의록 1건을 1분 내 요약 초안 생성");
    await ideaPage.getByTestId("requirements-confirm-button").click();
    await expect(ideaPage.getByRole("link", { name: "기능 정리" })).toBeVisible({ timeout: 20_000 });
    await ideaPage.getByRole("link", { name: "기능 정리" }).click();
    await expect(ideaPage).toHaveURL(/\/features/, { timeout: 20_000 });
    await page.goto("/");
    const ideaPage2Promise = page.context().waitForEvent("page");
    await page.getByTestId(`project-open-${projectId}`).click();
    const ideaPage2 = await ideaPage2Promise;
    await ideaPage2.waitForLoadState("domcontentloaded");
    await expect(ideaPage2).toHaveURL(
      (url) => {
        try {
          const u = new URL(url);
          return u.pathname === "/requirements" && u.searchParams.get("projectId") === projectId;
        } catch {
          return false;
        }
      },
      { timeout: 20_000 }
    );
    await expect(ideaPage2.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  });

  test("[E2E-PRJ-003] 상세 — 실행 환경은 프로젝트 관리 설정으로 이동(요약만 상세에 유지)", async ({ page }) => {
    await page.getByTestId("project-settings-seed").click();
    await page.getByRole("link", { name: "설정으로 이동" }).click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-execution-readiness-settings-link").click();
    await expect(page).toHaveURL(/\/project-admin\/settings\?projectId=/, { timeout: 15_000 });
    const env = page.getByTestId("project-execution-environment-panel");
    await expect(env).toBeVisible();
    await expect(env.getByTestId("project-advanced-settings-panel")).toHaveCount(0);
    await expect(env.getByText("Project Type")).toHaveCount(0);
    await expect(env.locator("#execution-setup-panel")).toBeVisible();
  });

  test("[E2E-PRJ-004] 설정 — 실행 환경 연결 UI", async ({ page }) => {
    await page.getByTestId("project-settings-seed").click();
    await page.getByRole("link", { name: "설정으로 이동" }).click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 30_000 });
    await page.getByTestId("project-execution-readiness-settings-link").click();
    await expect(page).toHaveURL(/\/project-admin\/settings\?projectId=/, { timeout: 15_000 });
    await expect(page.getByTestId("project-admin-settings-page")).toBeVisible();
    const envPanel = page.getByTestId("project-execution-environment-panel");
    await expect(envPanel).toBeVisible();
    await expect(envPanel.getByRole("heading", { name: /실행 환경/i })).toBeVisible();
    await expect(envPanel.getByRole("button", { name: "저장소 연결 검증" })).toBeVisible();
    await expect(envPanel.getByRole("button", { name: "Cursor API 검증" })).toBeVisible();
  });

  test("[E2E-PRJ-002] 시드 프로젝트 진입", async ({ page }) => {
    const seedPromise = page.context().waitForEvent("page");
    await page.getByTestId("project-open-seed").click();
    const seedPage = await seedPromise;
    await seedPage.waitForLoadState("domcontentloaded");
    await expect(seedPage).toHaveURL(/\/requirements\?.*projectId=/, { timeout: 20_000 });
    await expect(seedPage.getByText("Web Meeting MVP").first()).toBeVisible({ timeout: 15_000 });
  });

  test("[E2E-PRJ-AI-001] Overview: 워크스페이스·저장 계획 기반 Spec 생성 UI (프롬프트 노출 없음)", async ({ page }) => {
    test.skip(true, "프로젝트 허브 MVP에서 ProjectSpecWorkspace 임베드가 제거되어 이 시나리오는 더 이상 허브에서 검증할 수 없습니다.");
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
