import { describe, expect, it } from "vitest";
import { formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import {
  filterPerTaskRequirementLines,
  filterPerTaskVerificationLines,
} from "@/lib/prototype/codeTaskPlanningDraftPolish";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";
const PID = "p-stage1-structure";

function minimalMeetingList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "DEV-F",
        title: "화면 프레임/앱 Shell 구성",
        description: "Shell",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: ["a", "b", "c"],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("stage 1 CodeTask prompt structure", () => {
  it("lists integration orchestration separately from executable CodeTasks", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    expect(text).toContain("- 실행 CodeTask:");
    expect(text).toContain("- Integration Orchestration Task: 정의됨");
    expect(text).toContain("## Integration Orchestration Task");
    expect(text).toContain("## Integration Orchestration Branch");
    expect(text).toContain("## 실행 CodeTask 목록");
    expect(text).not.toContain("## CodeTask 목록");
    expect(text).toContain("sampleData 최종 연결 책임");
    expect(text).not.toMatch(new RegExp(`### \\d+\\..*${INTEGRATION_WIRING_CODE_TASK_ID}`));
    const execSection = text.split("## 실행 CodeTask 목록")[1]?.split("## Integration Orchestration Task 상세")[0] ?? "";
    expect(execSection).not.toContain(INTEGRATION_WIRING_CODE_TASK_ID);
  });

  it("does not list integration in executable branch group order", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    const branchSummary = text.split("## Branch Plan 요약")[1]?.split("## Branch Group")[0] ?? "";
    expect(branchSummary).toContain("실행 CodeTask branch group 순서");
    expect(branchSummary).not.toMatch(/5\.\s*integration/);
    expect(text).toContain("## Integration Orchestration Branch");
  });

  it("reports integration readiness separately and avoids CSV markdown artifacts", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    expect(text).toContain("- Integration ready:");
    expect(text).toContain("- Integration missing:");
    expect(text).toContain("#### Orchestration 품질 상태");
    expect(text).not.toMatch(/,##\s/);
    expect(text).not.toMatch(/,####\s/);
    const integrationDetail = text.split("## Integration Orchestration Task 상세")[1] ?? "";
    expect(integrationDetail).not.toContain("ready: false");
    expect(integrationDetail).not.toContain("integration_task_not_final_wiring");
    expect(integrationDetail).toContain("`src/data/sampleData.ts`");
    expect(integrationDetail).toContain("`src/types/meeting.ts`");
  });

  it("does not inject direct screen wiring verification into common/feature sections", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    const execSection = text.split("## 실행 CodeTask 목록")[1]?.split("## Integration Orchestration Task 상세")[0] ?? "";
    expect(execSection).not.toMatch(/최소\s*1곳에\s*연동/);
    expect(execSection).toContain("requiresIntegrationChange");
  });

  it("uses type-specific common verification and omits global screen-flow checks", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    const commonSection = text.split("## 공통 검증 기준")[1]?.split("## 실행 CodeTask 목록")[0] ?? "";
    expect(commonSection).toContain("CodeTask 유형에 맞는 검증 기준");
    expect(commonSection).not.toContain("화면 또는 상태 흐름에서 재현");
    expect(commonSection).not.toContain("관련 화면·상태 흐름의 회귀");
  });

  it("applies common/feature/screen verification polish per role kind", () => {
    const commonReq = filterPerTaskRequirementLines([], "common_loading");
    expect(commonReq.some((line) => line.includes("화면에 직접 연결하지 않는다"))).toBe(true);
    const commonVer = filterPerTaskVerificationLines(["완료 후 정상 화면 복귀 확인"], "common_loading");
    expect(commonVer).not.toContain("완료 후 정상 화면 복귀 확인");
    expect(commonVer).toContain("props 상태에 따라 정상/로딩/오류/빈 결과/권한 없음/재시도/저장 상태를 표현할 수 있다.");
    const featureVer = filterPerTaskVerificationLines(["시작 액션 표시 및 동작 확인"], "feature_start");
    expect(featureVer).not.toContain("시작 액션 표시 및 동작 확인");
    expect(featureVer).toContain("flow 모듈이 독립적으로 import/export 가능하다.");
    const screenVer = filterPerTaskVerificationLines([], "screen_input");
    expect(screenVer).toContain("placeholder-only 화면이 아니다.");
    expect(screenVer).toContain("undefined/null/빈 문자열이 그대로 노출되지 않는다.");
  });

  it("includes integration preview wiring guardrails in orchestration detail", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    const integrationDetail = text.split("## Integration Orchestration Task 상세")[1] ?? "";
    expect(integrationDetail).toContain("screen Task가 제공한 실제 화면형 컴포넌트");
    expect(integrationDetail).toContain("placeholder-only 금지 기준이 최종 Preview에서도 유지");
  });
});
