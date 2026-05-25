import {
  CURSOR_WORK_ITEM_MIN_QUALITY_SCORE,
  evaluateCursorWorkItemQuality,
  type CursorWorkItemQualityGate,
} from "@/lib/prototype/implementationCursorPromptQuality";
import { appendWipPolicyToCursorPrompt } from "@/lib/prototype/cursorWipExecution";
import type { ImplementationTaskPlanItem, ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { evaluateImplementationTaskPlanReadiness } from "@/lib/prototype/implementationTaskPlan";

export type { CursorWorkItemQualityGate } from "@/lib/prototype/implementationCursorPromptQuality";

export type CursorWorkItem = Readonly<{
  id: string;
  taskId: string;
  title: string;
  prompt: string;
  requiredFilesHint: readonly string[];
  expectedOutput: readonly string[];
  testCommands: readonly string[];
  forbiddenPaths: readonly string[];
  blocked: boolean;
  blockers: readonly string[];
  qualityGate: CursorWorkItemQualityGate;
}>;

export function collectCursorWorkItemGateMissing(item: CursorWorkItem): readonly string[] {
  const missing: string[] = [];
  if (!item.testCommands.length) missing.push(`${item.title}: 테스트 명령 없음`);
  if (!item.forbiddenPaths.length) missing.push(`${item.title}: 금지 경로 없음`);
  if (!item.qualityGate.promptReady || item.qualityGate.score < CURSOR_WORK_ITEM_MIN_QUALITY_SCORE) {
    missing.push(`${item.title}: Cursor prompt 품질 부족 (score=${item.qualityGate.score})`);
    const detail = item.qualityGate.missing.slice(0, 4).map((m) => `${item.title}: ${m}`);
    missing.push(...detail);
  }
  const hasLocation =
    item.prompt.includes("## 4. 예상 수정 위치") &&
    (item.requiredFilesHint.length > 0 || item.prompt.includes("### 후보 폴더"));
  if (!hasLocation) missing.push(`${item.title}: 예상 수정 위치 없음`);
  return missing;
}

export function buildCursorWorkItemsFromImplementationTaskPlan(
  plan: ImplementationTaskPlanV1,
): readonly CursorWorkItem[] {
  return plan.items.map((item) => toCursorWorkItem(item));
}

function toCursorWorkItem(item: ImplementationTaskPlanItem): CursorWorkItem {
  const h = item.executionHints;
  const requiredFilesHint = [
    ...item.sourceArtifactTypes.map((t) => `artifact:${t}`),
    ...h.candidateFiles.slice(0, 6),
    ...h.candidateDirectories.slice(0, 4).map((d) => `dir:${d}`),
  ];
  const draft: CursorWorkItem = {
    id: `cursor-wi-${item.id}`,
    taskId: item.id,
    title: item.title,
    prompt: appendWipPolicyToCursorPrompt(item.cursorPromptDraft),
    requiredFilesHint,
    expectedOutput: [
      "변경된 소스 파일 목록",
      "실행한 테스트 명령과 결과 요약",
      "핵심 동작 검증 요약",
      "미해결 이슈(있을 경우)",
    ],
    testCommands: h.testCommands,
    forbiddenPaths: h.forbiddenPaths,
    blocked: item.status === "blocked" || item.blockers.length > 0,
    blockers: item.blockers,
    qualityGate: { promptReady: false, missing: [], score: 0 },
  };
  return { ...draft, qualityGate: evaluateCursorWorkItemQuality(draft) };
}

export type CursorExecutionRequestGateInput = Readonly<{
  readonly plan: ImplementationTaskPlanV1 | null | undefined;
  readonly workItems: readonly CursorWorkItem[] | null | undefined;
  readonly envOk: boolean;
  readonly designOk: boolean;
}>;

export function evaluateCursorExecutionRequestGate(input: CursorExecutionRequestGateInput): Readonly<{
  allowed: boolean;
  missing: readonly string[];
}> {
  const missing: string[] = [];
  const readiness = evaluateImplementationTaskPlanReadiness({
    plan: input.plan,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  if (!readiness.ready) missing.push(...readiness.missing);
  const items = input.workItems ?? [];
  if (!items.length) missing.push("Cursor work item 없음");
  if (items.some((w) => w.blocked)) missing.push("차단된 task 존재");

  for (const w of items) {
    missing.push(...collectCursorWorkItemGateMissing(w));
  }

  const uniq = [...new Set(missing)];
  return { allowed: uniq.length === 0, missing: uniq };
}

export function formatCursorExecutionBlockedMessage(missing: readonly string[]): string {
  return [
    "아직 Cursor WIP 작업 요청을 진행할 수 없습니다.",
    "",
    "부족 항목:",
    ...missing.map((m) => `- ${m}`),
  ].join("\n");
}
