import { randomUUID } from "node:crypto";
import { buildWorkUnitBranchName } from "@/lib/prototype/prototypeBranchNames";
import {
  generatePrototypeWorkUnitsWithOpenAI,
  type PrototypePlannerLlmDraftUnit,
  type PrototypePlannerLlmInput,
} from "@/lib/prototype/prototypePlannerLlm";
import {
  resolvePrototypePlannerOpenAiCredential,
  type PrototypePlannerCredentialSource,
} from "@/lib/prototype/prototypePlannerCredentialService";
import type { PrototypeRun, PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";

export type PlanPrototypeWorkUnitsInput = Readonly<{
  projectId: string;
  /** 재생성 등 세션 사용자 키 우선 시 사용 */
  plannerActorUserId?: string | null;
  projectName: string;
  projectDescription: string;
  ideationSummary: string;
  actorFlowSummary: string;
  selectedTemplate: string;
  featureDraftTitles: readonly string[];
  promptSnapshot: string;
  repositoryStructureHint: string;
  userFeedback: string;
  previousWorkUnitsSummary: string;
}>;

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function countSignals(input: PlanPrototypeWorkUnitsInput): number {
  let n = 3;
  const desc = input.projectDescription.trim().length;
  if (desc > 120) n += 1;
  if (desc > 400) n += 1;
  const flow = input.actorFlowSummary.trim().length;
  if (flow > 80) n += 1;
  if (flow > 240) n += 1;
  if (input.featureDraftTitles.length >= 3) n += 1;
  if (input.featureDraftTitles.length >= 6) n += 1;
  const snap = input.promptSnapshot.trim().length;
  if (snap > 2000) n += 1;
  return n;
}

function workUnitFromDraft(
  d: PrototypePlannerLlmDraftUnit,
  runId: string,
  branchBase: string,
): PrototypeWorkUnit {
  return {
    id: randomUUID(),
    order: d.order,
    title: d.title,
    description: d.description,
    targetArea: d.targetArea,
    implementationScope: d.implementationScope,
    dependencies: [...d.dependencies],
    acceptanceCriteria: [...d.acceptanceCriteria],
    riskLevel: d.riskLevel,
    estimatedComplexity: d.estimatedComplexity,
    status: "PENDING",
    branchName: buildWorkUnitBranchName(branchBase, runId, d.order),
    cursorRunId: null,
    commitSha: null,
    changedFiles: [],
    prNumber: null,
    prUrl: null,
    mergeSha: null,
    reviewSummary: null,
    cursorPrompt: null,
    cursorPromptGeneratedAt: null,
    cursorPromptVersion: 0,
    cursorPromptSource: null,
    executionStartedAt: null,
    executionCompletedAt: null,
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * 결정적 규칙 기반 WorkUnit (LLM 실패 시 내부적으로 fallback 전용).
 */
export function planPrototypeWorkUnitsFallback(input: PlanPrototypeWorkUnitsInput, runId: string): PrototypeWorkUnit[] {
  const tpl = String(input.selectedTemplate ?? "").trim();
  const lower = `${tpl}\n${input.projectDescription}\n${input.actorFlowSummary}\n${input.promptSnapshot}`.toLowerCase();
  const meetingSignals = /meeting-workspace|회의록|녹취|음성파일|화자|화자분리|스크립트|stt|전사/.test(lower);

  const unitCount = clampInt(countSignals(input), 3, 7);
  const branchBase = input.projectName.trim() || "project";

  const titles: string[] =
    tpl === "meeting-workspace" || meetingSignals
      ? [
          "기본 레이아웃 및 라우팅(3컬럼 워크스페이스)",
          "좌측 패널(파일·참여자·화자·상태)",
          "중앙 업로드 카드·타임라인·메시지 입력",
          "우측 요약 탭(안건·결정·할 일)",
          "우측 스크립트 탭(화자별 발언) 및 탭 전환",
          "반응형 레이아웃·카드 UI 정리",
          "README·GitHub Pages 배포 설정",
        ].slice(0, unitCount)
      : [
          "기본 레이아웃 및 라우팅",
          "좌측 패널(탐색/필터) 구현",
          "중앙 작업 영역(목록·상세·폼 흐름)",
          "우측 결과/미리보기 패널",
          "Mock 데이터·상호작용(모달·탭)",
          "반응형 UI·접근성 정리",
          "README 및 배포/실행 안내",
        ].slice(0, unitCount);

  return titles.map((title, i) => {
    const order = i + 1;
    const draft: PrototypePlannerLlmDraftUnit = {
      order,
      title,
      description: `${title}을(를) 코드로 구현하고 화면에서 확인 가능한 상태로 만듭니다.`,
      targetArea: order === 1 ? "src/layout, 라우팅" : "src/components, src/pages",
      implementationScope: "관련 컴포넌트·스타일·목 데이터를 추가/수정합니다.",
      dependencies: order > 1 ? [String(order - 1)] : [],
      acceptanceCriteria: [`${title} 범위가 빌드 가능한 상태로 반영됨`],
      riskLevel: "medium",
      estimatedComplexity: order <= 2 ? "medium" : "low",
    };
    return workUnitFromDraft(draft, runId, branchBase);
  });
}

/** @deprecated 이름 호환 — planPrototypeWorkUnitsFallback 사용 */
export function planPrototypeWorkUnits(input: PlanPrototypeWorkUnitsInput, runId: string): PrototypeWorkUnit[] {
  return planPrototypeWorkUnitsFallback(input, runId);
}

function toLlmInput(input: PlanPrototypeWorkUnitsInput): PrototypePlannerLlmInput {
  return {
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    ideationSummary: input.ideationSummary,
    actorFlowSummary: input.actorFlowSummary,
    featureDraftTitles: input.featureDraftTitles,
    selectedTemplate: input.selectedTemplate,
    promptSnapshot: input.promptSnapshot,
    repositoryStructureHint: input.repositoryStructureHint,
    userFeedback: input.userFeedback,
    previousWorkUnitsSummary: input.previousWorkUnitsSummary,
  };
}

export type PlanPrototypeWorkUnitsResolved = Readonly<{
  workUnits: PrototypeWorkUnit[];
  plannerSource: "llm" | "fallback";
  plannerError: string | null;
  plannerCredentialSource: PrototypePlannerCredentialSource;
}>;

function sanitizePlannerErrorForStorage(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > 400 ? `${t.slice(0, 400)}…` : t;
}

/**
 * LLM 우선, 실패 시 결정적 fallback. plannerSource·plannerError는 호출부에서 기록.
 */
export async function planPrototypeWorkUnitsResolved(
  input: PlanPrototypeWorkUnitsInput,
  runId: string,
): Promise<PlanPrototypeWorkUnitsResolved> {
  const branchBase = input.projectName.trim() || "project";
  const cred = await resolvePrototypePlannerOpenAiCredential(input.projectId, {
    actorUserId: input.plannerActorUserId ?? null,
  });

  if (!cred.apiKey) {
    return {
      workUnits: planPrototypeWorkUnitsFallback(input, runId),
      plannerSource: "fallback",
      plannerError: null,
      plannerCredentialSource: "missing",
    };
  }

  const llm = await generatePrototypeWorkUnitsWithOpenAI(toLlmInput(input), {
    apiKey: cred.apiKey,
    model: cred.model,
  });
  if (llm.ok) {
    const sorted = [...llm.units].sort((a, b) => a.order - b.order);
    const normalized = sorted.map((u, idx) => ({ ...u, order: idx + 1 }));
    return {
      workUnits: normalized.map((u) => workUnitFromDraft(u, runId, branchBase)),
      plannerSource: "llm",
      plannerError: null,
      plannerCredentialSource: cred.source,
    };
  }
  return {
    workUnits: planPrototypeWorkUnitsFallback(input, runId),
    plannerSource: "fallback",
    plannerError: sanitizePlannerErrorForStorage(llm.error),
    plannerCredentialSource: cred.source,
  };
}

/** UI/요약용: (현재 order / 총 개수) 또는 완료 시 총개 표기. */
export function workUnitProgressFromRun(run: PrototypeRun): { current: number; total: number; allMerged: boolean } | null {
  const total = run.totalWorkUnits > 0 ? run.totalWorkUnits : run.workUnits.length;
  if (!total) return null;
  const doneCount = run.workUnits.filter((u) => u.status === "MERGED" || u.status === "SKIPPED").length;
  if (doneCount >= total) return { current: total, total, allMerged: true };
  const failed = run.workUnits.find((u) => u.status === "FAILED");
  const unfinished =
    failed ?? run.workUnits.find((u) => u.status !== "MERGED" && u.status !== "SKIPPED");
  const order = unfinished?.order ?? run.currentWorkUnitOrder ?? 1;
  return { current: order, total, allMerged: false };
}

export function summarizeWorkUnitsForPlanner(run: PrototypeRun): string {
  if (!run.workUnits.length) return "";
  return run.workUnits
    .map((u) => `[${u.order}] ${u.title}\n${u.description.slice(0, 400)}`)
    .join("\n\n");
}
