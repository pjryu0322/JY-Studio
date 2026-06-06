import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  getCodeTaskPromptContextFromMap,
  type CodeTaskPromptContextMapV1,
  type CodeTaskPromptContextV1,
} from "@/lib/prototype/codeTaskPromptContext";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";
import {
  sanitizePlanningPromptLine,
  sanitizePlanningPromptText,
} from "@/lib/prototype/codeTaskPromptPlanningSanitize";
import {
  resolveCodeTaskSpecificRole,
  type CodeTaskRoleKind,
} from "@/lib/prototype/codeTaskPromptRoleResolver";
import {
  buildBranchPlanGroupListingSections,
  buildBranchPlanSummarySections,
  buildCodeTaskBranchPlanBlockLines,
  buildCodeTaskFileBoundaryStageOneBlockLines,
  STAGE_ONE_CONFLICT_PREVENTION_POLICY_LINES,
  summarizeStageOnePromptQuality,
} from "@/lib/prototype/codeTaskStageOnePromptSections";
import {
  appendOptionalScreenMockVerification,
  filterPerTaskRequirementLines,
  filterPerTaskVerificationLines,
  PLANNING_DRAFT_COMMON_VERIFICATION_CRITERIA,
} from "@/lib/prototype/codeTaskPlanningDraftPolish";
import { formatTemplateLayoutSnippetForRole } from "@/lib/prototype/codeTaskTemplateLayoutDraft";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import {
  INTEGRATION_WIRING_PROCESS_TASK_TITLE,
  isIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";

function resolveStageOneProcessTaskLabel(
  codeTask: ImplementationCodeTaskV1,
  parentTask: ImplementationTaskV1 | null | undefined,
): string {
  if (isIntegrationWiringCodeTask(codeTask)) return INTEGRATION_WIRING_PROCESS_TASK_TITLE;
  return parentTask?.title?.trim() || codeTask.parentTaskId;
}

const PLANNING_SERVICE_FLOW_SUMMARY =
  "녹취 업로드·변환·화자 분리·회의록 초안/요약·스크립트 확인을 한 화면에서 처리" as const;

function bulletLines(items: readonly string[]): string[] {
  return items.map((item) => `- ${sanitizePlanningPromptLine(item)}`);
}

function orMissing(value: string | undefined, label: string): string {
  const v = sanitizePlanningPromptLine(value?.trim() ?? "");
  return v ? v : `누락 정보 (${label})`;
}

function planningContextBullets(
  ctx: CodeTaskPromptContextV1 | null | undefined,
  roleKind: CodeTaskRoleKind,
): string[] {
  const bullets: string[] = [PLANNING_SERVICE_FLOW_SUMMARY];
  if (roleKind === "app_shell") {
    bullets.push("선택된 템플릿은 반응형 3열 회의 분석 워크스페이스 구조를 가진다.");
    return bullets;
  }
  const screens = (ctx?.featureContext.relatedScreens ?? []).slice(0, 2);
  const states = (ctx?.featureContext.relatedStates ?? []).slice(0, 2);
  if (screens.length) {
    bullets.push(`관련 화면: ${screens.join(", ")}`);
  } else if (states.length) {
    bullets.push(`관련 상태: ${states.join(", ")}`);
  }
  return bullets.slice(0, 3);
}

function templateLayoutSections(roleKind: CodeTaskRoleKind, templateId?: string): string[] {
  const snippet = formatTemplateLayoutSnippetForRole({ roleKind, templateId });
  if (!snippet?.trim()) return [];
  const lines = snippet
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^관련\s*템플릿\s*영역:?\s*$/i.test(l));
  if (!lines.length) return [];
  return [
    "",
    "## 관련 템플릿 영역",
    ...lines.map((l) => (l.startsWith("-") ? l : `- ${l}`)),
  ];
}

function templateLayoutSectionsBundle(roleKind: CodeTaskRoleKind, templateId?: string): string[] {
  const snippet = formatTemplateLayoutSnippetForRole({ roleKind, templateId });
  if (!snippet?.trim()) return [];
  const lines = snippet
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^관련\s*템플릿\s*영역:?\s*$/i.test(l));
  if (!lines.length) return [];
  return ["", "#### 관련 템플릿 영역", ...lines.map((l) => (l.startsWith("-") ? l : `- ${l}`))];
}

function intentBullets(ctx: CodeTaskPromptContextV1 | null | undefined, codeTask: ImplementationCodeTaskV1): string[] {
  const raw = ctx?.implementationContext.intent?.trim() || "";
  const cleaned = sanitizePlanningPromptLine(raw);
  if (cleaned && !cleaned.includes("하위 작업:") && !/에 맞는 UI·상태·연동/.test(cleaned)) {
    return [cleaned];
  }
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: codeTask.title,
    codeTaskDescription: codeTask.description,
    changeType: codeTask.changeType,
  });
  return [role.role];
}

function requirementBullets(
  ctx: CodeTaskPromptContextV1 | null | undefined,
  codeTask: ImplementationCodeTaskV1,
  parentTask: ImplementationTaskV1 | null | undefined,
  roleKind: CodeTaskRoleKind,
): string[] {
  if (roleKind === "integration_wiring") {
    const fromTask = filterPerTaskRequirementLines(codeTask.acceptanceCriteria ?? [], roleKind);
    if (fromTask.length >= 3) {
      return fromTask.map((r) => sanitizePlanningPromptLine(r)).slice(0, 9);
    }
  }
  const fromCtx = filterPerTaskRequirementLines(
    ctx?.implementationContext.requirements ?? [],
    roleKind,
  );
  if (fromCtx.length >= 3) {
    return fromCtx.map((r) => sanitizePlanningPromptLine(r)).slice(0, 7);
  }
  const tpl = resolveCodeTaskFeaturePromptTemplate({
    title: codeTask.title,
    description: codeTask.description,
    requirements: codeTask.acceptanceCriteria,
    changeType: codeTask.changeType,
    parentTitle: parentTask?.title,
    roleKind,
  });
  return filterPerTaskRequirementLines(
    uniqStrings([...tpl.implementationRequirements, ...codeTask.acceptanceCriteria]),
    roleKind,
  )
    .map((r) => sanitizePlanningPromptLine(r))
    .slice(0, 7);
}

function verificationBullets(
  ctx: CodeTaskPromptContextV1 | null | undefined,
  codeTask: ImplementationCodeTaskV1,
  parentTask: ImplementationTaskV1 | null | undefined,
  roleKind: CodeTaskRoleKind,
  options?: { readonly includeOptionalMockVerify?: boolean },
): string[] {
  const raw = uniqStrings([
    ...(ctx?.verificationContext.acceptanceCriteria ?? []),
    ...(ctx?.verificationContext.manualChecks ?? []),
  ]);
  let lines =
    raw.length >= 2
      ? filterPerTaskVerificationLines(raw)
      : filterPerTaskVerificationLines(
          uniqStrings([...resolveCodeTaskFeaturePromptTemplate({
            title: codeTask.title,
            description: codeTask.description,
            requirements: codeTask.acceptanceCriteria,
            changeType: codeTask.changeType,
            parentTitle: parentTask?.title,
            roleKind,
          }).verificationChecklist, ...codeTask.acceptanceCriteria]),
        );
  if (options?.includeOptionalMockVerify) {
    lines = appendOptionalScreenMockVerification(lines, roleKind);
  }
  return lines.map((r) => sanitizePlanningPromptLine(r)).slice(0, 5);
}

function uniqStrings(items: readonly string[]): string[] {
  return [...new Set(items.map((x) => sanitizePlanningPromptLine(String(x).trim())).filter(Boolean))];
}

function formatQualityBlock(ctx: CodeTaskPromptContextV1 | null | undefined): string[] {
  const quality = ctx?.quality;
  if (!quality) {
    return ["## 품질 상태", "- ready: unknown", "- missing: (없음)", "- warnings: (없음)"];
  }
  return [
    "## 품질 상태",
    `- ready: ${String(quality.ready)}`,
    `- missing: ${quality.missing?.length ? quality.missing.join(", ") : "(없음)"}`,
    `- warnings: ${quality.warnings?.length ? quality.warnings.join(", ") : "(없음)"}`,
  ];
}

function formatQualityBlockBundle(ctx: CodeTaskPromptContextV1 | null | undefined): string[] {
  const base = formatQualityBlock(ctx);
  return base.map((line) => (line.startsWith("## ") ? line.replace("## ", "#### ") : line));
}

export function formatCodeTaskPromptDraft(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly index?: number;
  readonly templateId?: string;
}): string {
  const ctx = input.promptContext;
  const parentTitle = resolveStageOneProcessTaskLabel(input.codeTask, input.parentTask);
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: input.codeTask.title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTask?.title,
    parentTaskDescription: input.parentTask?.description,
    requirements: input.codeTask.acceptanceCriteria,
    changeType: input.codeTask.changeType,
  });

  const sections = [
    "# CodeTask 1단계 프롬프트 초안",
    "",
    "## CodeTask",
    `- 제목: ${orMissing(input.codeTask.title, "제목")}`,
    `- CodeTask ID: ${input.codeTask.codeTaskId}`,
    `- Process Task: ${parentTitle}`,
    "",
    "## 이번 CodeTask의 역할",
    `- 역할: ${role.role}`,
    "",
    "## 기획 맥락",
    ...bulletLines(planningContextBullets(ctx, role.roleKind)),
    "",
    "## 관련 화면/상태",
    `- 화면: ${(ctx?.featureContext.relatedScreens ?? []).length ? ctx!.featureContext.relatedScreens.join(", ") : "누락 정보 (화면)"}`,
    `- 상태: ${(ctx?.featureContext.relatedStates ?? []).length ? ctx!.featureContext.relatedStates.join(", ") : "누락 정보 (상태)"}`,
    `- 관련 데이터: ${(ctx?.featureContext.relatedFeatures ?? []).join(", ") || "누락 정보 (관련 데이터)"}`,
    ...templateLayoutSections(role.roleKind, input.templateId),
    "",
    "## 구현 의도",
    ...bulletLines(intentBullets(ctx, input.codeTask)),
    "",
    "## 구현 요구사항 초안",
    ...bulletLines(requirementBullets(ctx, input.codeTask, input.parentTask, role.roleKind)),
    "",
    "## 검증 기준 초안",
    ...bulletLines(
      verificationBullets(ctx, input.codeTask, input.parentTask, role.roleKind, {
        includeOptionalMockVerify: true,
      }),
    ),
    "",
    ...buildCodeTaskBranchPlanBlockLines(input.codeTask, 3),
    "",
    ...buildCodeTaskFileBoundaryStageOneBlockLines(input.codeTask, 3),
    "",
    ...formatQualityBlock(ctx),
  ];

  if (input.index != null) {
    sections.splice(1, 0, `(목록 ${input.index}번째 CodeTask)`, "");
  }

  return sanitizePlanningPromptText(sections.join("\n"));
}

function formatCodeTaskSectionInBundle(input: {
  readonly index: number;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly templateId?: string;
}): string {
  const ctx = input.promptContext;
  const parentTitle = resolveStageOneProcessTaskLabel(input.codeTask, input.parentTask);
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: input.codeTask.title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTask?.title,
    parentTaskDescription: input.parentTask?.description,
    requirements: input.codeTask.acceptanceCriteria,
    changeType: input.codeTask.changeType,
  });

  const lines = [
    `### ${input.index}. ${orMissing(input.codeTask.title, "제목")}`,
    `- Process Task: ${parentTitle}`,
    `- CodeTask ID: ${input.codeTask.codeTaskId}`,
    `- 역할: ${role.role}`,
    "",
    "#### 기획 맥락",
    ...bulletLines(planningContextBullets(ctx, role.roleKind)),
    "",
    "#### 관련 화면/상태",
    `- 화면: ${(ctx?.featureContext.relatedScreens ?? []).join(", ") || "누락 정보 (화면)"}`,
    `- 상태: ${(ctx?.featureContext.relatedStates ?? []).join(", ") || "누락 정보 (상태)"}`,
    `- 관련 데이터: ${(ctx?.featureContext.relatedFeatures ?? []).join(", ") || "누락 정보 (관련 데이터)"}`,
    ...templateLayoutSectionsBundle(role.roleKind, input.templateId),
    "",
    "#### 구현 의도",
    ...bulletLines(intentBullets(ctx, input.codeTask)),
    "",
    "#### 구현 요구사항 초안",
    ...bulletLines(requirementBullets(ctx, input.codeTask, input.parentTask, role.roleKind)),
    "",
    "#### 검증 기준 초안",
    ...bulletLines(
      verificationBullets(ctx, input.codeTask, input.parentTask, role.roleKind, {
        includeOptionalMockVerify: true,
      }),
    ),
    "",
    ...buildCodeTaskBranchPlanBlockLines(input.codeTask, 4),
    "",
    ...buildCodeTaskFileBoundaryStageOneBlockLines(input.codeTask, 4),
    "",
    ...formatQualityBlockBundle(ctx),
  ];
  return sanitizePlanningPromptText(lines.join("\n"));
}

export function formatCodeTaskPromptDraftBundle(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly promptContextMap?: CodeTaskPromptContextMapV1 | null;
  readonly templateId?: string;
}): string {
  const tasks = input.codeTaskPlan.tasks;
  const qualitySummary = summarizeStageOnePromptQuality({
    codeTaskPlan: input.codeTaskPlan,
    promptContextMap: input.promptContextMap ?? null,
  });
  let contextCount = 0;
  let readyCount = 0;
  let warningTaskCount = 0;
  let missingItemCount = 0;

  for (const ct of tasks) {
    const ctx = getCodeTaskPromptContextFromMap(input.promptContextMap ?? null, ct.codeTaskId);
    if (ctx) contextCount += 1;
    if (ctx?.quality.ready) readyCount += 1;
    if (ctx?.quality.warnings?.length || ctx?.quality.missing?.length) warningTaskCount += 1;
    missingItemCount += ctx?.quality.missing?.length ?? 0;
  }

  const parentById = new Map((input.taskList?.tasks ?? []).map((t) => [t.taskId, t] as const));

  const sections: string[] = [
    "# CodeTask 1단계 프롬프트 초안",
    "",
    "## 프로젝트 구현 준비 요약",
    `- 전체 CodeTask: ${tasks.length}개`,
    `- PromptContext 생성: ${contextCount}개`,
    `- Branch Plan 생성: ${qualitySummary.branchPlanCount}개`,
    `- File Boundary 생성: ${qualitySummary.fileBoundaryCount}개`,
    `- Integration Task: ${qualitySummary.integrationTaskPresent ? "있음" : "없음"}`,
    `- ready CodeTask: ${readyCount}개`,
    `- warning CodeTask: ${warningTaskCount}개`,
    `- missing 항목 수: ${missingItemCount}개`,
    "",
    ...STAGE_ONE_CONFLICT_PREVENTION_POLICY_LINES,
    "",
    ...buildBranchPlanSummarySections(input.codeTaskPlan),
    ...buildBranchPlanGroupListingSections(input.codeTaskPlan),
    "",
    "## 공통 검증 기준",
    ...bulletLines([...PLANNING_DRAFT_COMMON_VERIFICATION_CRITERIA]),
    "",
    "## CodeTask 목록",
  ];

  let index = 0;
  for (const codeTask of tasks) {
    index += 1;
    const parentTask = parentById.get(codeTask.parentTaskId) ?? null;
    const ctx = getCodeTaskPromptContextFromMap(input.promptContextMap ?? null, codeTask.codeTaskId);
    sections.push(
      "",
      formatCodeTaskSectionInBundle({
        index,
        codeTask,
        parentTask,
        promptContext: ctx,
        templateId: input.templateId,
      }),
    );
  }

  return sanitizePlanningPromptText(sections.join("\n"));
}
