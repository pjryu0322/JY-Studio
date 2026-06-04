import { describe, expect, it } from "vitest";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import {
  extractReferencedCodeTaskIds,
  validateCodeTaskDeveloperPromptSafety,
  validateRuntimeCursorPromptProductQuality,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";

const REPO = "pjryu0322/aiprogect";
const CODE_TASK_ID = "CODE-DEV-FRAME-001-001";
const WORK_BRANCH = buildCodeTaskWorkBranch(CODE_TASK_ID);

function buildNormalAppShellPrompt(overrides?: { extra?: string }): string {
  return [
    "# CodeTask 개발 요청",
    "",
    "## 작업 저장소",
    `- 작업 대상 저장소: \`${REPO}\``,
    "- base branch: `main`",
    `- work branch: \`${WORK_BRANCH}\``,
    "- 이 저장소 밖의 파일은 수정하지 않는다.",
    "- PR 생성·merge는 하지 않는다. commit 후 work branch에 push만 한다.",
    "",
    "## 작업 목표",
    "화면 프레임/앱 Shell 구성 · 앱 Shell/공통 화면 프레임",
    "",
    "## 기획 맥락",
    "- 핵심 사용자: 회의 녹취를 업로드하고 회의록 초안·요약·스크립트를 확인하는 사용자",
    "",
    "## 이번 CodeTask의 역할",
    "- 역할: 선택된 템플릿의 전체 IA, 공통 레이아웃, 컨테이너, 주요 패널 구조를 제공한다.",
    "- 관련 상태: uploading, stt_processing, speaker_waiting, draft_pending",
    "",
    "## 구현 요구사항",
    "- 반응형 3열 workspace shell/container를 구현한다.",
    "- 좌열, 중앙, 우열 패널을 명확한 컴포넌트 단위로 분리한다.",
    "- 좌열에는 회의 파일/참여자 영역을 배치한다.",
    "- 프레임 상단에는 변환 단계 칩 또는 진행 상태 영역을 배치한다.",
    "- 모바일에서는 주요 패널이 세로 스택 또는 탭 구조로 전환될 수 있어야 한다.",
    "",
    "## 수정 대상 탐색 기준",
    "- 대상 저장소 내부에서 관련 화면, 컴포넌트, 상태 모듈을 탐색한다.",
    "- 우선 탐색 경로:",
    "- src/**",
    "- app/**",
    "- components/**",
    "- lib/**",
    "",
    "## 검증 기준",
    "- 좌열/중앙/우열 패널이 렌더링된다.",
    "- 입력 화면과 결과 화면이 동일한 shell/container 안에서 배치될 수 있다.",
    "",
    "## 금지사항",
    "- package.json 수정 금지",
    "",
    "## 참조 ID",
    "- Process Task: DEV-FRAME-001",
    `- CodeTask: ${CODE_TASK_ID}`,
    overrides?.extra ?? "",
  ].join("\n");
}

describe("codeTaskRuntimePromptQuality (P3-M25)", () => {
  it("passes normal App Shell prompt including role section and progress wording", () => {
    const prompt = buildNormalAppShellPrompt();
    const result = validateCodeTaskDeveloperPromptSafety({
      prompt,
      targetRepoFullName: REPO,
      targetRepoKind: "generated_project",
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
      roleKind: "app_shell",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(extractReferencedCodeTaskIds(prompt)).toEqual([CODE_TASK_ID]);
  });

  it("does not treat work branch slug as a second CodeTask id", () => {
    const prompt = buildNormalAppShellPrompt();
    expect(WORK_BRANCH).toContain("code-dev-frame");
    const product = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
      roleKind: "app_shell",
    });
    expect(product.ok).toBe(true);
    expect(product.errors).not.toContain("multiple_or_unexpected_code_task_ids");
  });

  it("fails on multiple runtime headings", () => {
    const prompt = `${buildNormalAppShellPrompt()}\n# CodeTask 개발 요청\n`;
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("multiple_runtime_prompt_headings");
  });

  it("fails on multiple work branch lines", () => {
    const prompt = buildNormalAppShellPrompt().replace(
      `- work branch: \`${WORK_BRANCH}\``,
      `- work branch: \`wip/cursor/a\`\n- work branch: \`wip/cursor/b\``,
    );
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("multiple_work_branches");
  });

  it("fails when another CodeTask reference line is present", () => {
    const prompt = buildNormalAppShellPrompt({
      extra: "- CodeTask: CODE-DEV-COMMON-001-001",
    });
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("multiple_or_unexpected_code_task_ids");
  });

  it("fails App Shell prompt with LoadingState", () => {
    const prompt = `${buildNormalAppShellPrompt()}\nLoadingState\n`;
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
      roleKind: "app_shell",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("app_shell_contains_loading_component_template");
  });

  it("allows progress status wording on App Shell", () => {
    const prompt = buildNormalAppShellPrompt();
    expect(prompt).toContain("진행 상태 영역");
    expect(prompt).toContain("변환 단계 칩");
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
      roleKind: "app_shell",
    });
    expect(result.ok).toBe(true);
  });

  it("ok with warnings only when verification checks are insufficient", () => {
    const prompt = buildNormalAppShellPrompt().replace(
      "## 검증 기준\n- 좌열/중앙/우열 패널이 렌더링된다.\n- 입력 화면과 결과 화면이 동일한 shell/container 안에서 배치될 수 있다.",
      "## 검증 기준\n- 단일 검증만 있음",
    );
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("insufficient_verification_checks");
  });
});
